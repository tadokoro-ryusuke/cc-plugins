#!/usr/bin/env node
// 使い方: node scripts/validate-skill-evals.mjs [--plugin <name>] [<suite.json>]
//   --plugin  検査するプラグイン（marketplace の name）。既定は dev-core。
//   <suite>   eval suite のパス。既定は <plugin の source>/evals/skill-behavior-cases.json。
//             位置引数だけを渡す従来の呼び出し（plugin は dev-core）も受け付ける。
// 終了コード: 0 = 検査に合格、1 = 違反あり、または引数・入力を読み込めない。

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const defaultPlugin = "dev-core";
const errors = [];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  let plugin = defaultPlugin;
  let suitePath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plugin") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail("--plugin にはプラグイン名が必要");
      plugin = value;
      index += 1;
    } else if (arg.startsWith("--plugin=")) {
      plugin = arg.slice("--plugin=".length);
    } else if (arg.startsWith("-")) {
      fail(`未知のオプション: ${arg}（使い方: validate-skill-evals.mjs [--plugin <name>] [<suite.json>]）`);
    } else if (suitePath === null) {
      suitePath = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
    } else {
      fail(`suite のパスは1つだけ指定できる: ${arg}`);
    }
  }
  return { plugin, suitePath };
}

// プラグイン名から marketplace の source（プラグインのルート）を引く。名前の誤りは黙って通さない。
function resolvePluginRoot(plugin) {
  const marketplacePath = join(root, ".claude-plugin/marketplace.json");
  let marketplace;
  try {
    marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
  } catch (error) {
    fail(`${marketplacePath}: marketplaceを読み込めない (${error.message})`);
  }
  const entry = Array.isArray(marketplace?.plugins) ? marketplace.plugins.find((item) => item?.name === plugin) : undefined;
  if (!entry || typeof entry.source !== "string") fail(`marketplaceにプラグイン "${plugin}" が無い`);
  return resolve(root, entry.source);
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

const { plugin, suitePath: suitePathArg } = parseArgs(process.argv.slice(2));
const pluginRoot = resolvePluginRoot(plugin);
const suitePath = suitePathArg ?? join(pluginRoot, "evals/skill-behavior-cases.json");

function skillExists(name) {
  return ["skills", "workflows"].some((kind) => existsSync(join(pluginRoot, kind, name, "SKILL.md")));
}

let suite;
try {
  suite = JSON.parse(readFileSync(suitePath, "utf8"));
} catch (error) {
  fail(`${suitePath}: eval suiteを読み込めない (${error.message})`);
}

if (suite.schemaVersion !== 1) errors.push("schemaVersion は 1 でなければならない");
if (typeof suite.suite !== "string" || suite.suite.trim().length === 0) errors.push("suite は非空文字列でなければならない");
if (!nonEmptyStrings(suite.evaluatorNotes)) errors.push("evaluatorNotes は非空文字列配列でなければならない");
if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
  errors.push("cases は非空配列でなければならない");
} else {
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
      errors.push(`${label}.skill が ${plugin} に存在しないskillを参照している: ${testCase.skill}`);
    }
    if (typeof testCase.prompt !== "string" || testCase.prompt.trim().length === 0) errors.push(`${label}.prompt は非空でなければならない`);
    if (typeof testCase.shouldTrigger !== "boolean") errors.push(`${label}.shouldTrigger はbooleanでなければならない`);
    if (!nonEmptyStrings(testCase.expectedBehaviors)) errors.push(`${label}.expectedBehaviors は非空文字列配列でなければならない`);
    if (!nonEmptyStrings(testCase.forbiddenBehaviors)) errors.push(`${label}.forbiddenBehaviors は非空文字列配列でなければならない`);
  }

  // dev-core 固有の下限と必須ケース。他のプラグインの suite には適用しない。
  if (plugin === "dev-core") {
    if (suite.cases.length < 9) errors.push("casesには自律性・安全性のscenarioを9件以上維持する");
    const grillCases = suite.cases.filter((testCase) => testCase?.skill === "grill");
    if (!grillCases.some((testCase) => testCase.shouldTrigger === true)) errors.push("grillにはpositive trigger caseが必要");
    if (!grillCases.some((testCase) => testCase.shouldTrigger === false)) errors.push("grillにはnegative trigger caseが必要");
    for (const requiredSkill of ["task", "execute", "tdd", "refactor", "debug-team"]) {
      if (!suite.cases.some((testCase) => testCase?.skill === requiredSkill && testCase.shouldTrigger === true)) {
        errors.push(`${requiredSkill}にはpositive behavior caseが必要`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`skill behavior eval validation passed (${plugin}: ${suite.cases.length} cases)`);
