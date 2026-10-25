#!/usr/bin/env node
// 実際のインストール構成（利用者の設定・インストール済みの全プラグイン）で、行動ケースのプロンプトに
// どのスキルが発火するかを測る。`claude plugin eval` は対象のプラグインだけを読み込む隔離環境なので、
// 他のプラグインや組み込みのスキルとの取り合いはこのスクリプトで見る。CI では使わない（手で回す）。
//
// 使い方:
//   node scripts/measure-skill-firing.mjs --plugin dev-core --model <固定> [--case id1,id2] [--dry-run]
//
// 安全のため:
//   - 空の一時ディレクトリで、使えるツールを Skill と読み取り系（Read・Glob・Grep）だけにし、MCP を
//     読み込まない（--tools と --strict-mcp-config）
//   - 起動直後の init イベントでツールの一覧を確かめ、それ以外のツールが1つでもあれば、モデルの応答を
//     待たずに止めて、測定全体を中止する
//   - 自動発火のケース（プロンプトが /<plugin>: で始まらない）だけを測る。外部への投稿などを頼むケースは
//     --case で除く
//   - --dry-run は最初のケースの init だけを確かめて止める（モデルの応答を待たない）
// 測るのはインストール済みの版。作業ツリーの版ではない（結果に版を書く）。

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_TOOLS = new Set(["Read", "Glob", "Grep", "Skill"]);

// stream-json の1行を調べる。init ならツールの一覧の中で安全でないものを、Skill の呼び出しなら
// スキルの名前を返す。関係のない行は null
export function inspectEvent(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (event.type === "system" && event.subtype === "init") {
    return { kind: "init", unsafe: (event.tools ?? []).filter((tool) => !SAFE_TOOLS.has(tool)) };
  }
  if (event.type === "assistant" && Array.isArray(event.message?.content)) {
    const skills = event.message.content
      .filter((block) => block.type === "tool_use" && block.name === "Skill" && typeof block.input?.skill === "string")
      .map((block) => block.input.skill);
    if (skills.length > 0) return { kind: "skills", skills };
  }
  return null;
}

// 対象のスキルが発火したか。名前空間の無い名前は対象のプラグインのものとみなす
export function verdict(testCase, fired, plugin) {
  const hit = fired.some((name) => name === testCase.skill || name === `${plugin}:${testCase.skill}`);
  return hit === testCase.shouldTrigger ? "pass" : "fail";
}

function runCase(prompt, model, maxTurns, dryRun) {
  return new Promise((resolvePromise, reject) => {
    const cwd = mkdtempSync(join(tmpdir(), "skill-firing-"));
    const child = spawn("claude", ["-p", "--output-format", "stream-json", "--verbose",
      "--tools", [...SAFE_TOOLS].join(","), "--strict-mcp-config", "--max-turns", String(maxTurns),
      "--model", model, prompt], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const fired = [];
    let buffer = "";
    let costUsd = null;
    let checked = false;
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const found = inspectEvent(line);
        if (found?.kind === "init") {
          checked = true;
          if (found.unsafe.length > 0) {
            child.kill("SIGKILL");
            reject(new Error(`安全でないツールが使える状態だったので中止した: ${found.unsafe.join(", ")}`));
            return;
          }
          if (dryRun) {
            child.kill("SIGKILL");
            resolvePromise({ fired, costUsd, dryRun: true });
            return;
          }
        }
        if (found?.kind === "skills") fired.push(...found.skills);
        try {
          const event = JSON.parse(line);
          if (event.type === "result") costUsd = event.total_cost_usd ?? null;
        } catch {
          // 解釈できない行は無視する
        }
      }
    });
    child.on("close", () => {
      rmSync(cwd, { recursive: true, force: true });
      if (!checked) reject(new Error("init イベントを受け取れなかった"));
      else resolvePromise({ fired, costUsd });
    });
  });
}

async function main() {
  const args = { maxTurns: 2, dryRun: false };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--plugin") args.plugin = argv[++index];
    else if (arg === "--model") args.model = argv[++index];
    else if (arg === "--case") args.cases = new Set(argv[++index].split(","));
    else if (arg === "--max-turns") args.maxTurns = Number(argv[++index]);
    else throw new Error(`未知の引数: ${arg}`);
  }
  if (!args.plugin || !args.model) throw new Error("--plugin と --model を指定する");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  const entry = marketplace.plugins.find((item) => item.name === args.plugin);
  const suite = JSON.parse(readFileSync(join(root, entry.source, "evals/skill-behavior-cases.json"), "utf8"));
  // 手動起動専用（disable-model-invocation）のスキルは Skill ツールで発火しないので測らない
  const manualOnly = (skill) => ["skills", "workflows"].map((kind) => join(root, entry.source, kind, skill, "SKILL.md"))
    .filter((path) => existsSync(path))
    .some((path) => /^disable-model-invocation:\s*true\s*$/m.test(readFileSync(path, "utf8").split(/^---$/m)[1] ?? ""));
  const cases = suite.cases.filter((testCase) => !testCase.prompt.startsWith(`/${args.plugin}:`)
    && !manualOnly(testCase.skill) && (!args.cases || args.cases.has(testCase.id)));
  let total = 0;
  console.log("| id | 期待 | 発火したスキル | 判定 | 費用(USD) |\n|---|---|---|---|---|");
  for (const testCase of cases) {
    const result = await runCase(testCase.prompt, args.model, args.maxTurns, args.dryRun);
    if (result.dryRun) {
      console.log(`dry-run: ${testCase.id} の init は Skill と読み取り系のツールだけだった`);
      return;
    }
    total += result.costUsd ?? 0;
    const expected = `${testCase.shouldTrigger ? "発火" : "発火しない"}: ${testCase.skill}`;
    console.log(`| ${testCase.id} | ${expected} | ${result.fired.join(", ") || "-"} | ${verdict(testCase, result.fired, args.plugin)} | ${result.costUsd ?? "?"} |`);
  }
  console.log(`\n合計の費用: ${total.toFixed(4)} USD（${cases.length} 件、--max-turns ${args.maxTurns}、--model ${args.model}）`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
