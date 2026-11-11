// measure-skill-firing.mjs の解析部分のテスト。node --test scripts/measure-skill-firing.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  inspectEvent, observation, parseArgs, preflightWarnings, runCase, summaryLine, verdict,
} from "./measure-skill-firing.mjs";

const init = (tools) => JSON.stringify({ type: "system", subtype: "init", tools });
const skillUse = (skill) => JSON.stringify({
  type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
});

test("init のツールが読み取り系と Skill だけなら通し、それ以外が1つでもあれば止める", () => {
  assert.deepEqual(inspectEvent(init(["Read", "Glob", "Grep", "Skill"])), { kind: "init", unsafe: [] });
  assert.deepEqual(inspectEvent(init(["Read", "Bash", "mcp__slack__send_message"])).unsafe,
    ["Bash", "mcp__slack__send_message"]);
  // ツールの一覧が無い init は、安全と確かめられないので止める
  assert.notDeepEqual(inspectEvent(JSON.stringify({ type: "system", subtype: "init" })).unsafe, []);
});

test("Skill の呼び出しから、発火したスキルの名前を取り出す", () => {
  assert.deepEqual(inspectEvent(skillUse("dev-core:verify")), { kind: "skills", skills: ["dev-core:verify"] });
  assert.equal(inspectEvent("not json"), null);
  assert.equal(inspectEvent(JSON.stringify({ type: "user" })), null);
});

test("正例は対象が発火したら、負例は対象が発火しなかったら合格", () => {
  assert.equal(verdict({ skill: "verify", shouldTrigger: true }, ["dev-core:verify"], "dev-core"), "pass");
  assert.equal(verdict({ skill: "verify", shouldTrigger: true }, ["dev-core:debug"], "dev-core"), "fail");
  assert.equal(verdict({ skill: "verify", shouldTrigger: false }, [], "dev-core"), "pass");
  assert.equal(verdict({ skill: "verify", shouldTrigger: false }, ["dev-core:verify"], "dev-core"), "fail");
  // 別のプラグインの同名スキルは、対象の発火に数えない
  assert.equal(verdict({ skill: "verify", shouldTrigger: true }, ["other:verify"], "dev-core"), "fail");
  assert.equal(verdict({ skill: "verify", shouldTrigger: false }, ["other:verify"], "dev-core"), "pass");
  // 名前空間の無い同名の発火は、組み込みや個人のスキルかもしれないので判定しない
  assert.equal(verdict({ skill: "debug", shouldTrigger: true }, ["debug"], "dev-core"), "ambiguous");
  assert.equal(verdict({ skill: "debug", shouldTrigger: false }, ["debug"], "dev-core"), "ambiguous");
});

test("正常に終わった run（max turns に達した場合を含む）だけを観測として数える", () => {
  assert.equal(observation({ subtype: "success", is_error: false }), "ok");
  assert.equal(observation({ subtype: "error_max_turns", is_error: true }), "ok");
  assert.equal(observation({ subtype: "error_during_execution", is_error: true }), "error");
  assert.equal(observation({ subtype: "success", is_error: true }), "error");
  assert.equal(observation(null), "error");
});

// runCase を、偽の claude（stream-json を出すだけのスクリプト）で動かす

function fakeClaude(body) {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  const path = join(dir, "claude");
  writeFileSync(path, `#!/usr/bin/env node\nconst out = (e) => process.stdout.write(JSON.stringify(e) + "\\n");\n${body}\n`);
  chmodSync(path, 0o755);
  return { path, dir };
}

const safeInit = 'out({ type: "system", subtype: "init", tools: ["Read", "Glob", "Grep", "Skill"] });';
const fast = { model: "m", maxTurns: 2, initTimeoutMs: 10000, runTimeoutMs: 10000, closeTimeoutMs: 500 };

test("init・Skill の呼び出し・成功の result が来たら、発火を観測として返し、一時ディレクトリを消す", async () => {
  const fake = fakeClaude(`${safeInit}
out({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "dev-core:verify" } }] } });
out({ type: "result", subtype: "success", is_error: false, total_cost_usd: 0.01 });`);
  try {
    const state = await runCase("p", { ...fast, command: fake.path });
    assert.equal(state.status, "ok");
    assert.deepEqual(state.fired, ["dev-core:verify"]);
    assert.ok(!existsSync(state.cwd));
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("init を受け取らないまま終わった run は、成功の result があっても測定全体を中止する", async () => {
  const fake = fakeClaude('out({ type: "result", subtype: "success", is_error: false });');
  try {
    for (const dryRun of [false, true]) {
      const state = await runCase("p", { ...fast, command: fake.path, dryRun });
      assert.equal(state.status, "abort");
    }
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("安全でないツールが使える init なら、待たずに止める", async () => {
  const fake = fakeClaude('out({ type: "system", subtype: "init", tools: ["Read", "Bash"] }); setTimeout(() => {}, 30000);');
  try {
    const started = Date.now();
    const state = await runCase("p", { ...fast, command: fake.path });
    assert.equal(state.status, "unsafe");
    assert.ok(Date.now() - started < 8000, "止めるまで待ちすぎている");
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("孫のプロセスが出力を開いたままでも、時間の上限で打ち切って中止として返す", async () => {
  // 別のプロセスグループの孫が stdout を持ち続け、子は応答しない
  const fake = fakeClaude(`require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 8000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] }).unref();
${safeInit}
setTimeout(() => {}, 30000);`);
  try {
    const started = Date.now();
    const state = await runCase("p", { ...fast, command: fake.path, runTimeoutMs: 1500, closeTimeoutMs: 300 });
    assert.equal(state.status, "abort");
    assert.ok(state.initSeen, "孫を起こして init を出した後で止めている");
    assert.ok(Date.now() - started < 7000, "close を待ち続けている");
    assert.ok(!existsSync(state.cwd));
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("init が来ないうちに run の上限に達しても、測定全体を中止にする", async () => {
  const fake = fakeClaude("setTimeout(() => {}, 30000);");
  try {
    for (const dryRun of [false, true]) {
      const state = await runCase("p", { ...fast, command: fake.path, dryRun, runTimeoutMs: 300, initTimeoutMs: 10000 });
      assert.equal(state.status, "abort");
    }
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("子を止められなくても（kill がどちらも失敗）、測定する側のプロセスは終われる", async () => {
  // 別のプロセスで runCase を動かし、kill を失敗させても、そのプロセスが自分で終わることを確かめる
  const fake = fakeClaude(`${safeInit}\nsetTimeout(() => {}, 30000);`);
  const runner = join(fake.dir, "runner.mjs");
  writeFileSync(runner, `import { runCase } from ${JSON.stringify(new URL("./measure-skill-firing.mjs", import.meta.url).href)};
const fail = () => { const e = new Error("EPERM"); e.code = "EPERM"; throw e; };
const state = await runCase("p", { model: "m", maxTurns: 2, command: ${JSON.stringify(fake.path)},
  initTimeoutMs: 10000, runTimeoutMs: 1500, closeTimeoutMs: 300, killGroup: fail, killChild: fail });
console.log(JSON.stringify({ status: state.status, pid: state.pid }));`);
  let pid;
  try {
    const result = spawnSync(process.execPath, [runner], { encoding: "utf8", timeout: 15000 });
    assert.equal(result.error, undefined, "測定する側のプロセスが終わらなかった");
    const out = JSON.parse(result.stdout.trim());
    pid = out.pid;
    assert.equal(out.status, "abort");
  } finally {
    if (pid) { try { process.kill(pid, "SIGKILL"); } catch { /* 既に終わっている */ } }
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("claude を起動できなければ、中止として返す", async () => {
  const state = await runCase("p", { ...fast, command: join(tmpdir(), "no-such-claude-binary") });
  assert.equal(state.status, "abort");
  assert.ok(!existsSync(state.cwd));
});

// effort と費用の上限（Fable 5.2 の追加と、alias・effort の変化を受けた変更）

test("--effort と --max-budget-usd を読み、範囲外の値は始める前に止める", () => {
  const base = ["--plugin", "dev-core", "--model", "claude-opus-5-5"];
  const options = parseArgs([...base, "--effort", "high", "--max-budget-usd", "0.5"]);
  assert.equal(options.effort, "high");
  assert.equal(options.maxBudgetUsd, 0.5);
  assert.equal(parseArgs(base).effort, undefined);
  assert.equal(parseArgs(base).maxBudgetUsd, undefined);
  for (const level of ["low", "medium", "high", "xhigh", "max"]) {
    assert.equal(parseArgs([...base, "--effort", level]).effort, level);
  }
  assert.throws(() => parseArgs([...base, "--effort", "ultra"]));
  assert.throws(() => parseArgs([...base, "--effort", "ultracode"]));
  assert.throws(() => parseArgs([...base, "--effort"]));
  for (const value of ["0", "-1", "abc", "Infinity"]) {
    assert.throws(() => parseArgs([...base, "--max-budget-usd", value]), undefined, value);
  }
  assert.throws(() => parseArgs([...base, "--max-budget-usd"]));
  assert.throws(() => parseArgs(["--plugin", "dev-core"]));
  assert.throws(() => parseArgs([...base, "--unknown"]));
});

test("effort を指定しないときは、利用者の環境変数か保存した effort が効くと警告する", () => {
  const unset = preflightWarnings({ model: "claude-opus-5-5" }, {});
  assert.equal(unset.length, 1);
  assert.match(unset[0], /CLAUDE_CODE_EFFORT_LEVEL/);
  assert.match(unset[0], /保存した effort/);
  assert.deepEqual(preflightWarnings({ model: "claude-opus-5-5", effort: "medium" }, {}), []);
});

test("--model が fable か claude-fable- で始まるときは、usage credits への課金を警告する", () => {
  for (const model of ["fable", "claude-fable-5-2", "fable[1m]", "Claude-Fable-5-2"]) {
    const warnings = preflightWarnings({ model, effort: "high" }, {});
    assert.equal(warnings.length, 1, model);
    assert.match(warnings[0], /usage credits/);
    assert.match(warnings[0], /-p/);
  }
  for (const model of ["claude-opus-5-5", "opus", "best", "sonnet"]) {
    assert.deepEqual(preflightWarnings({ model, effort: "high" }, {}), [], model);
  }
});

test("合計の行に、指定した effort と 1 件あたりの費用の上限を出す", () => {
  const pinned = summaryLine(0.1234, 3, { maxTurns: 2, model: "claude-opus-5-5", effort: "high", maxBudgetUsd: 0.5 });
  assert.match(pinned, /0\.1234 USD/);
  assert.match(pinned, /3 件/);
  assert.match(pinned, /--model claude-opus-5-5/);
  assert.match(pinned, /--effort high/);
  assert.match(pinned, /--max-budget-usd 0\.5（1 件あたり）/);
  const unpinned = summaryLine(0, 1, { maxTurns: 2, model: "claude-opus-5-5" });
  assert.match(unpinned, /--effort 未指定/);
  assert.doesNotMatch(unpinned, /--effort (low|medium|high|xhigh|max)/);
  assert.match(unpinned, /--max-budget-usd なし/);
});

// 偽の claude は、受け取った引数と CLAUDE_CODE_EFFORT_LEVEL を result に入れて返す
const echoArgs = `${safeInit}
out({ type: "result", subtype: "success", is_error: false,
  argv: process.argv.slice(2), effortEnv: process.env.CLAUDE_CODE_EFFORT_LEVEL ?? null });`;

async function withEffortEnv(value, run) {
  const saved = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (value === undefined) delete process.env.CLAUDE_CODE_EFFORT_LEVEL;
  else process.env.CLAUDE_CODE_EFFORT_LEVEL = value;
  try {
    return await run();
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_EFFORT_LEVEL;
    else process.env.CLAUDE_CODE_EFFORT_LEVEL = saved;
  }
}

test("--effort を子に渡し、子の CLAUDE_CODE_EFFORT_LEVEL を指定した値で上書きする", async () => {
  const fake = fakeClaude(echoArgs);
  try {
    // 利用者の環境変数（low）が --effort（high）より優先されるので、子の環境変数も上書きする
    const state = await withEffortEnv("low", () => runCase("プロンプト",
      { ...fast, command: fake.path, model: "claude-opus-5-5", effort: "high", maxBudgetUsd: 0.5 }));
    assert.equal(state.status, "ok");
    const { argv, effortEnv } = state.result;
    assert.equal(effortEnv, "high");
    assert.deepEqual(argv.slice(argv.indexOf("--model"), argv.indexOf("--model") + 4),
      ["--model", "claude-opus-5-5", "--effort", "high"]);
    assert.deepEqual(argv.slice(argv.indexOf("--max-budget-usd"), argv.indexOf("--max-budget-usd") + 2),
      ["--max-budget-usd", "0.5"]);
    assert.equal(argv.at(-1), "プロンプト");
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("effort を指定しないときは、--effort を渡さず、利用者の環境変数をそのまま子に渡す", async () => {
  const fake = fakeClaude(echoArgs);
  try {
    const state = await withEffortEnv("low", () => runCase("p", { ...fast, command: fake.path }));
    assert.equal(state.status, "ok");
    assert.ok(!state.result.argv.includes("--effort"));
    assert.ok(!state.result.argv.includes("--max-budget-usd"));
    assert.equal(state.result.effortEnv, "low");
    assert.equal(state.result.argv.at(-1), "p");
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});
