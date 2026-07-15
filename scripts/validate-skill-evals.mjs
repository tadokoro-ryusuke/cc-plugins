#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const defaultSuite = join(root, "dev-core/evals/skill-behavior-cases.json");
const suitePath = process.argv[2]
  ? isAbsolute(process.argv[2])
    ? process.argv[2]
    : resolve(process.cwd(), process.argv[2])
  : defaultSuite;
const errors = [];

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function skillExists(name) {
  return ["skills", "workflows"].some((kind) => existsSync(join(root, "dev-core", kind, name, "SKILL.md")));
}

let suite;
try {
  suite = JSON.parse(readFileSync(suitePath, "utf8"));
} catch (error) {
  console.error(`${suitePath}: eval suiteを読み込めない (${error.message})`);
  process.exit(1);
}

if (suite.schemaVersion !== 1) errors.push("schemaVersion は 1 でなければならない");
if (typeof suite.suite !== "string" || suite.suite.trim().length === 0) errors.push("suite は非空文字列でなければならない");
if (!nonEmptyStrings(suite.evaluatorNotes)) errors.push("evaluatorNotes は非空文字列配列でなければならない");
if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
  errors.push("cases は非空配列でなければならない");
} else {
  if (suite.cases.length < 9) errors.push("casesには自律性・安全性のscenarioを9件以上維持する");
  const ids = new Set();
  for (const [index, testCase] of suite.cases.entries()) {
    const label = `cases[${index}]`;
    if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) {
      errors.push(`${label} はobjectでなければならない`);
      continue;
    }
    if (typeof testCase.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(testCase.id)) {
      errors.push(`${label}.id は一意なkebab-caseでなければならない`);
    } else if (ids.has(testCase.id)) {
      errors.push(`${label}.id が重複している: ${testCase.id}`);
    } else {
      ids.add(testCase.id);
    }
    if (typeof testCase.skill !== "string" || testCase.skill.trim().length === 0) {
      errors.push(`${label}.skill は非空文字列でなければならない`);
    } else if (!skillExists(testCase.skill)) {
      errors.push(`${label}.skill が存在しないskillを参照している: ${testCase.skill}`);
    }
    if (typeof testCase.prompt !== "string" || testCase.prompt.trim().length === 0) errors.push(`${label}.prompt は非空でなければならない`);
    if (typeof testCase.shouldTrigger !== "boolean") errors.push(`${label}.shouldTrigger はbooleanでなければならない`);
    if (!nonEmptyStrings(testCase.expectedBehaviors)) errors.push(`${label}.expectedBehaviors は非空文字列配列でなければならない`);
    if (!nonEmptyStrings(testCase.forbiddenBehaviors)) errors.push(`${label}.forbiddenBehaviors は非空文字列配列でなければならない`);
  }

  const grillCases = suite.cases.filter((testCase) => testCase?.skill === "grill");
  if (!grillCases.some((testCase) => testCase.shouldTrigger === true)) errors.push("grillにはpositive trigger caseが必要");
  if (!grillCases.some((testCase) => testCase.shouldTrigger === false)) errors.push("grillにはnegative trigger caseが必要");
  for (const requiredSkill of ["task", "execute", "tdd", "refactor", "debug-team"]) {
    if (!suite.cases.some((testCase) => testCase?.skill === requiredSkill && testCase.shouldTrigger === true)) {
      errors.push(`${requiredSkill}にはpositive behavior caseが必要`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`skill behavior eval validation passed (${suite.cases.length} cases)`);
