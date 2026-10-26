// validate-skill-evals.mjs のテスト。node --test scripts/validate-skill-evals.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = dirname(fileURLToPath(import.meta.url));
const validator = join(scripts, "validate-skill-evals.mjs");
const devCoreSuite = join(scripts, "../dev-core/evals/skill-behavior-cases.json");

function validate(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "validate-skill-evals-"));
  try {
    const suite = JSON.parse(readFileSync(devCoreSuite, "utf8"));
    mutate?.(suite);
    const path = join(dir, "suite.json");
    writeFileSync(path, JSON.stringify(suite));
    return spawnSync(process.execPath, [validator, "--plugin", "dev-core", path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("同梱の suite は警告なしで通る", () => {
  for (const plugin of ["dev-core"]) {
    const result = spawnSync(process.execPath, [validator, "--plugin", plugin], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "", `${plugin} に警告が出た: ${result.stderr}`);
  }
});

test("手動起動専用のスキルをスラッシュなしで呼ぶケースは、警告する（自動発火しないので測れない）", () => {
  const result = validate((suite) => {
    suite.cases.find((c) => c.skill === "execute").prompt = "計画を実行して";
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /警告: .*execute/);
});

test("自動発火のスキルに紛らわしい依頼の負例が無ければ、警告する", () => {
  const result = validate((suite) => {
    suite.cases = suite.cases.filter((c) => !(c.skill === "verify" && c.shouldTrigger === false));
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /警告: verify/);
});

test("expectedSkill は、あるなら非空の文字列でなければならない", () => {
  const result = validate((suite) => {
    suite.cases.find((c) => c.shouldTrigger === false).expectedSkill = 3;
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expectedSkill/);
});
