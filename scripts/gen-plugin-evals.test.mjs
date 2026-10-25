// gen-plugin-evals.mjs のテスト。node --test scripts/gen-plugin-evals.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "gen-plugin-evals.mjs");

function fixturePlugin() {
  const root = mkdtempSync(join(tmpdir(), "gen-plugin-evals-"));
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(join(root, ".claude-plugin/plugin.json"), JSON.stringify({ name: "fixture", version: "0.0.0" }));
  mkdirSync(join(root, "skills/auto-skill"), { recursive: true });
  writeFileSync(join(root, "skills/auto-skill/SKILL.md"), "---\nname: auto-skill\ndescription: x\n---\nbody\n");
  mkdirSync(join(root, "workflows/manual"), { recursive: true });
  writeFileSync(join(root, "workflows/manual/SKILL.md"),
    "---\nname: manual\ndescription: x\ndisable-model-invocation: true\n---\nbody\n");
  const base = { expectedBehaviors: ["期待する振る舞い"], forbiddenBehaviors: ["禁止する振る舞い"] };
  const suite = {
    schemaVersion: 1, suite: "fixture", evaluatorNotes: ["note"],
    cases: [
      { id: "auto-pos", skill: "auto-skill", prompt: "検証して", shouldTrigger: true, ...base },
      { id: "auto-neg", skill: "auto-skill", prompt: "アプリを起動して", shouldTrigger: false, expectedSkill: "builtin:/run", ...base },
      { id: "explicit", skill: "manual", prompt: "/fixture:manual 計画を実行して", shouldTrigger: true, ...base },
      { id: "manual-without-slash", skill: "manual", prompt: "計画を実行して", shouldTrigger: true, ...base },
      { id: "manual-guard", skill: "manual", prompt: "README の誤字を直して", shouldTrigger: false, ...base },
    ],
  };
  writeFileSync(join(root, "suite.json"), JSON.stringify(suite));
  return root;
}

function generate(root, ...flags) {
  return spawnSync(process.execPath, [script, "--plugin-root", root, "--suite", join(root, "suite.json"),
    "--out", join(root, "evals/plugin"), ...flags], { encoding: "utf8" });
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "frontmatter が無い");
  return match[1];
}

test("自動発火の正例は、Skill が呼ばれたかだけを無料の grader で見る", () => {
  const root = fixturePlugin();
  try {
    const result = generate(root);
    assert.equal(result.status, 0, result.stderr);
    const dir = join(root, "evals/plugin/auto-pos");
    assert.match(readFileSync(join(dir, "prompt.md"), "utf8"), /\n検証して\n$/);
    assert.match(frontmatter(readFileSync(join(dir, "prompt.md"), "utf8")), /allowed_tools: \[Read, Glob, Grep, Skill\]/);
    const grader = frontmatter(readFileSync(join(dir, "graders/skill-fired.md"), "utf8"));
    assert.match(grader, /type: tool_used/);
    assert.match(grader, /tool: Skill/);
    const pattern = new RegExp(grader.match(/input_match: '(.*)'/)[1]);
    assert.ok(pattern.test('{"skill":"fixture:auto-skill"}'));
    assert.ok(pattern.test('{"skill": "auto-skill"}'));
    assert.ok(!pattern.test('{"skill":"fixture:auto-skill-extra"}'));
    assert.ok(!existsSync(join(dir, "graders/behavior.md")), "既定では有料の llm grader を作らない");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("負例は、両方のアームで Skill が一度も呼ばれないことを見る", () => {
  const root = fixturePlugin();
  try {
    assert.equal(generate(root).status, 0);
    const grader = frontmatter(readFileSync(join(root, "evals/plugin/auto-neg/graders/skill-not-fired.md"), "utf8"));
    assert.match(grader, /min: 0/);
    assert.match(grader, /max: 0/);
    assert.match(grader, /arm: both/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("明示起動のケースは既定で作らず、--behavior で振る舞いの grader 付きで作る", () => {
  const root = fixturePlugin();
  try {
    const plain = generate(root);
    assert.ok(!existsSync(join(root, "evals/plugin/explicit")));
    assert.match(plain.stdout, /explicit/);
    const withBehavior = generate(root, "--behavior");
    assert.equal(withBehavior.status, 0, withBehavior.stderr);
    const grader = readFileSync(join(root, "evals/plugin/explicit/graders/behavior.md"), "utf8");
    assert.match(frontmatter(grader), /type: llm/);
    assert.match(grader, /期待する振る舞い/);
    assert.match(grader, /禁止する振る舞い/);
    assert.ok(!existsSync(join(root, "evals/plugin/explicit/graders/skill-fired.md")),
      "明示起動は Skill ツールを経由しないので、発火の grader を付けない");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("手動起動専用のスキルを、スラッシュなしで自動発火させるケースは作らず警告する", () => {
  const root = fixturePlugin();
  try {
    const result = generate(root, "--behavior");
    assert.equal(result.status, 0);
    assert.ok(!existsSync(join(root, "evals/plugin/manual-without-slash")));
    assert.match(result.stderr, /manual-without-slash/);
    // 同じスキルの負例は、割り込まないことを確かめる行動ガードとして振る舞いの grader だけで作る
    assert.ok(existsSync(join(root, "evals/plugin/manual-guard/graders/behavior.md")));
    assert.ok(!existsSync(join(root, "evals/plugin/manual-guard/graders/skill-not-fired.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("作り直すときは、前に生成したケースだけを消し、実行結果と手書きのケースは残す", () => {
  const root = fixturePlugin();
  try {
    assert.equal(generate(root, "--behavior").status, 0);
    mkdirSync(join(root, "evals/plugin/results/old"), { recursive: true });
    mkdirSync(join(root, "evals/plugin/hand-written"), { recursive: true });
    writeFileSync(join(root, "evals/plugin/hand-written/prompt.md"), "---\n---\nx\n");
    assert.equal(generate(root).status, 0);
    assert.ok(!existsSync(join(root, "evals/plugin/explicit")), "前回の生成物は消す");
    assert.ok(existsSync(join(root, "evals/plugin/results/old")));
    assert.ok(existsSync(join(root, "evals/plugin/hand-written/prompt.md")));
    assert.ok(existsSync(join(root, "evals/plugin/auto-pos/.generated")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
