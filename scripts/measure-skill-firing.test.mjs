// measure-skill-firing.mjs の解析部分のテスト。node --test scripts/measure-skill-firing.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectEvent, verdict } from "./measure-skill-firing.mjs";

const init = (tools) => JSON.stringify({ type: "system", subtype: "init", tools });
const skillUse = (skill) => JSON.stringify({
  type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
});

test("init のツールが読み取り系と Skill だけなら通し、それ以外が1つでもあれば止める", () => {
  assert.deepEqual(inspectEvent(init(["Read", "Glob", "Grep", "Skill"])), { kind: "init", unsafe: [] });
  assert.deepEqual(inspectEvent(init(["Read", "Bash", "mcp__slack__send_message"])).unsafe,
    ["Bash", "mcp__slack__send_message"]);
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
  assert.equal(verdict({ skill: "verify", shouldTrigger: false }, ["verify"], "dev-core"), "fail");
  // 別のプラグインの同名スキルは、対象の発火に数えない
  assert.equal(verdict({ skill: "verify", shouldTrigger: true }, ["other:verify"], "dev-core"), "fail");
});
