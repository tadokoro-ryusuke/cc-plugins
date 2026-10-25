#!/usr/bin/env node
// 実際のインストール構成（利用者の設定・インストール済みの全プラグイン）で、行動ケースのプロンプトに
// どのスキルが発火するかを測る。`claude plugin eval` は対象のプラグインだけを読み込む隔離環境なので、
// 他のプラグインや組み込みのスキルとの取り合いはこのスクリプトで見る。CI では使わない（手で回す）。
//
// 使い方:
//   node scripts/measure-skill-firing.mjs --plugin dev-core --model <固定> [--case id1,id2] [--dry-run] [--with-hooks]
//
// 安全のため:
//   - 空の一時ディレクトリで、使えるツールを Skill と読み取り系（Read・Glob・Grep）だけにし、MCP を
//     読み込まない（--tools と --strict-mcp-config）
//   - hooks は切る（--settings '{"disableAllHooks":true}'）。hooks はツールの一覧に出ず、利用者の権限で
//     書き込みや通信ができるため。--with-hooks で有効にできるが、その場合は OS やコンテナの側で書き込みと
//     通信を制限してから回す。管理者が配った managed hooks は切れない
//   - 起動直後の init イベントでツールの一覧を確かめ、それ以外のツールが1つでもあれば（一覧が無い場合も）、
//     モデルの応答を待たずに止めて、測定全体を中止する。これは事後の確認であって、承認の関門ではない
//   - init が来ない・run が終わらないときは時間で止める。どの終わり方でも一時ディレクトリを消してから次へ進む
//   - 自動発火のケース（プロンプトが /<plugin>: で始まらない）だけを測る。外部への投稿などを頼むケースは
//     --case で除く。手動起動専用のスキルは自動では発火しないので測らない
//   - --dry-run は最初のケースの init だけを確かめて止める（モデルの応答を待たない）
//   - 子はプロセスグループの先頭として起こし、グループごと止める（POSIX 前提。Windows は対象外）
// 測るのはインストール済みの版。作業ツリーの版ではない（結果に版を書く）。

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_TOOLS = new Set(["Read", "Glob", "Grep", "Skill"]);
const INIT_TIMEOUT_MS = 60_000;
const RUN_TIMEOUT_MS = 300_000;
const STDERR_LIMIT = 8_192;
const CLOSE_TIMEOUT_MS = 10_000;

// stream-json の1行を調べる。init ならツールの一覧の中で安全でないものを、Skill の呼び出しなら
// スキルの名前を、result なら終わり方を返す。関係のない行は null
export function inspectEvent(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (event.type === "system" && event.subtype === "init") {
    if (!Array.isArray(event.tools)) return { kind: "init", unsafe: ["（ツールの一覧が無い）"] };
    return { kind: "init", unsafe: event.tools.filter((tool) => !SAFE_TOOLS.has(tool)) };
  }
  if (event.type === "assistant" && Array.isArray(event.message?.content)) {
    const skills = event.message.content
      .filter((block) => block.type === "tool_use" && block.name === "Skill" && typeof block.input?.skill === "string")
      .map((block) => block.input.skill);
    if (skills.length > 0) return { kind: "skills", skills };
  }
  if (event.type === "result") return { kind: "result", result: event };
  return null;
}

// 発火の観測として数えてよい run か。正常に終わったか、max turns に達して終わった run だけを数える
// （発火は最初のターンで起きるので、max turns に達しても観測には使える）
export function observation(result) {
  if (!result) return "error";
  if (result.subtype === "success" && result.is_error !== true) return "ok";
  if (result.subtype === "error_max_turns") return "ok";
  return "error";
}

// 対象のスキル（<plugin>:<skill>）が発火したか。名前空間の無い同名の発火は、組み込みや個人のスキルかも
// しれないので判定しない（ambiguous）。別のプラグインの同名スキルは対象の発火に数えない
export function verdict(testCase, fired, plugin) {
  if (fired.includes(`${plugin}:${testCase.skill}`)) return testCase.shouldTrigger ? "pass" : "fail";
  if (fired.includes(testCase.skill)) return "ambiguous";
  return testCase.shouldTrigger ? "fail" : "pass";
}

// 1件のプロンプトを流す。状態（status）は ok・error（この run だけ判定から外す）・unsafe と abort
// （測定全体を中止する）・dry-run のどれか。どの終わり方でも、一時ディレクトリを消してから1回だけ返す
export function runCase(prompt, options) {
  const command = options.command ?? "claude";
  const initTimeoutMs = options.initTimeoutMs ?? INIT_TIMEOUT_MS;
  const runTimeoutMs = options.runTimeoutMs ?? RUN_TIMEOUT_MS;
  const closeTimeoutMs = options.closeTimeoutMs ?? CLOSE_TIMEOUT_MS;
  // 止め方（テストで失敗を模せるように差し替えられる）。POSIX のプロセスグループが前提
  const killGroup = options.killGroup ?? ((pid) => process.kill(-pid, "SIGKILL"));
  const killChild = options.killChild ?? ((target) => target.kill("SIGKILL"));
  return new Promise((resolvePromise) => {
    const cwd = mkdtempSync(join(tmpdir(), "skill-firing-"));
    const args = ["-p", "--output-format", "stream-json", "--verbose",
      "--tools", [...SAFE_TOOLS].join(","), "--strict-mcp-config", "--max-turns", String(options.maxTurns),
      "--model", options.model];
    if (!options.withHooks) args.push("--settings", JSON.stringify({ disableAllHooks: true }));
    args.push(prompt);
    const state = { fired: [], result: null, status: null, detail: "", stderr: "", initSeen: false, cwd };
    const timers = [];
    let buffer = "";
    let settled = false;
    let stopping = false;
    let child;

    const setStatus = (status, detail) => {
      if (state.status === null) { state.status = status; state.detail = detail; }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      for (const timer of timers) clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      resolvePromise(state);
    };
    // 止めるのは1回だけ。子のプロセスグループごと止め（孫も含む）、close を待つ。close が来なければ
    // （グループの外の子孫が出力を持ち続けるなど）、出力を閉じて中止として返す
    const stop = (status, detail) => {
      setStatus(status, detail);
      if (stopping) return;
      stopping = true;
      try {
        killGroup(child.pid);
      } catch {
        try { killChild(child); } catch { /* 止められない。下の上限で打ち切る */ }
      }
      timers.push(setTimeout(() => {
        state.status = "abort";
        state.detail = `${state.detail}（子の終了を確認できなかった）`;
        // 出力を閉じ、子への参照を外して、測定する側のプロセスが子を待たずに終われるようにする
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
        finish();
      }, closeTimeoutMs));
    };

    try {
      child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], detached: true });
      state.pid = child.pid;
    } catch (error) {
      setStatus("abort", `${command} を起動できなかった: ${error.message}`);
      finish();
      return;
    }
    child.on("error", (error) => {
      // 起動できなかった（pid が無い）なら中止。動いている子のエラーは記録だけして、止め直さない
      if (child.pid === undefined) {
        setStatus("abort", `${command} を起動できなかった: ${error.message}`);
        finish();
      } else {
        setStatus("error", `子プロセスのエラー: ${error.message}`);
      }
    });
    timers.push(setTimeout(() => { if (!state.initSeen) stop("abort", "init が時間内に来なかった"); }, initTimeoutMs));
    timers.push(setTimeout(() => stop("error", "run が時間内に終わらなかった"), runTimeoutMs));
    // stderr は詰まらないように読み続け、診断用に先頭だけ残す
    child.stderr.on("data", (chunk) => {
      if (state.stderr.length < STDERR_LIMIT) state.stderr = (state.stderr + chunk).slice(0, STDERR_LIMIT);
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const found = inspectEvent(line);
        if (found?.kind === "init") {
          if (found.unsafe.length > 0) {
            stop("unsafe", `安全でないツールが使える状態だった: ${found.unsafe.join(", ")}`);
          } else {
            state.initSeen = true;
            if (options.dryRun) stop("dry-run", "");
          }
        } else if (found?.kind === "skills") {
          state.fired.push(...found.skills);
        } else if (found?.kind === "result") {
          state.result = found.result;
        }
      }
    });
    child.on("close", () => {
      if (!state.initSeen) {
        // ツールの一覧を確かめていない run は、result が成功でも、先に error になっていても数えず、
        // 測定全体を中止する（unsafe と abort はそのまま）
        if (state.status !== "unsafe" && state.status !== "abort") {
          state.status = "abort";
          state.detail = `init を受け取らないまま終わった${state.detail ? `（${state.detail}）` : ""}`;
        }
      } else if (state.status === null) {
        setStatus(observation(state.result), state.result ? `result: ${state.result.subtype}` : "result が無い");
      }
      finish();
    });
  });
}

async function main() {
  const options = { maxTurns: 2, dryRun: false, withHooks: false };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--with-hooks") options.withHooks = true;
    else if (arg === "--plugin") options.plugin = argv[++index];
    else if (arg === "--model") options.model = argv[++index];
    else if (arg === "--case") options.cases = new Set(argv[++index].split(","));
    else if (arg === "--max-turns") options.maxTurns = Number(argv[++index]);
    else throw new Error(`未知の引数: ${arg}`);
  }
  if (!options.plugin || !options.model) throw new Error("--plugin と --model を指定する");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  const entry = marketplace.plugins.find((item) => item.name === options.plugin);
  if (!entry) throw new Error(`marketplace にプラグイン "${options.plugin}" が無い`);
  const suite = JSON.parse(readFileSync(join(root, entry.source, "evals/skill-behavior-cases.json"), "utf8"));
  // 手動起動専用（disable-model-invocation）のスキルは Skill ツールで発火しないので測らない
  const manualOnly = (skill) => ["skills", "workflows"].map((kind) => join(root, entry.source, kind, skill, "SKILL.md"))
    .filter((path) => existsSync(path))
    .some((path) => /^disable-model-invocation:\s*true\s*$/m.test(readFileSync(path, "utf8").split(/^---$/m)[1] ?? ""));
  const cases = suite.cases.filter((testCase) => !testCase.prompt.startsWith(`/${options.plugin}:`)
    && !manualOnly(testCase.skill) && (!options.cases || options.cases.has(testCase.id)));
  let total = 0;
  console.log(`hooks: ${options.withHooks ? "有効" : "無効（disableAllHooks）"}`);
  console.log("| id | 期待 | 発火したスキル | 判定 | 費用(USD) |\n|---|---|---|---|---|");
  for (const testCase of cases) {
    const state = await runCase(testCase.prompt, options);
    if (state.status === "unsafe" || state.status === "abort") {
      console.error(`中止: ${testCase.id}: ${state.detail}`);
      process.exitCode = 1;
      return;
    }
    if (state.status === "dry-run") {
      console.log(`dry-run: ${testCase.id} の init は Skill と読み取り系のツールだけだった`);
      return;
    }
    const cost = state.result?.total_cost_usd ?? null;
    total += cost ?? 0;
    const expected = `${testCase.shouldTrigger ? "発火" : "発火しない"}: ${testCase.skill}`;
    const judged = state.status === "ok" ? verdict(testCase, state.fired, options.plugin) : `error（${state.detail}）`;
    console.log(`| ${testCase.id} | ${expected} | ${state.fired.join(", ") || "-"} | ${judged} | ${cost ?? "?"} |`);
  }
  console.log(`\n合計の費用: ${total.toFixed(4)} USD（${cases.length} 件、--max-turns ${options.maxTurns}、--model ${options.model}）`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
