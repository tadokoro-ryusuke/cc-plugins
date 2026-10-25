// measure-skill-firing.mjs の解析部分のテスト。node --test scripts/measure-skill-firing.test.mjs
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectEvent, observation, runCase, verdict } from "./measure-skill-firing.mjs";

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
const fast = { model: "m", maxTurns: 2, initTimeoutMs: 2000, runTimeoutMs: 2000, closeTimeoutMs: 500 };

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
    assert.ok(Date.now() - started < 1500);
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("孫のプロセスが出力を開いたままでも、時間の上限で打ち切って中止として返す", async () => {
  // 別のプロセスグループの孫が stdout を持ち続け、子は応答しない
  const fake = fakeClaude(`${safeInit}
require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 4000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] }).unref();
setTimeout(() => {}, 30000);`);
  try {
    const started = Date.now();
    const state = await runCase("p", { ...fast, command: fake.path, runTimeoutMs: 300, closeTimeoutMs: 300 });
    assert.equal(state.status, "abort");
    assert.ok(Date.now() - started < 3000);
    assert.ok(!existsSync(state.cwd));
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});

test("claude を起動できなければ、中止として返す", async () => {
  const state = await runCase("p", { ...fast, command: join(tmpdir(), "no-such-claude-binary") });
  assert.equal(state.status, "abort");
  assert.ok(!existsSync(state.cwd));
});
