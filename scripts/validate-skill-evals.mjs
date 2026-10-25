#!/usr/bin/env node
// 使い方: node scripts/validate-skill-evals.mjs [--plugin <name>] [<suite.json>]
//   --plugin  検査するプラグイン（marketplace の name）。既定は dev-core。
//   <suite>   eval suite のパス。既定は <plugin の source>/evals/skill-behavior-cases.json。
//             位置引数だけを渡す従来の呼び出し（plugin は dev-core）も受け付ける。
// 終了コード: 0 = 検査に合格、1 = 違反あり、または引数・入力を読み込めない。
// 警告（stderr に「警告:」で出し、終了コードは 0）: 手動起動専用のスキルをスラッシュなしで呼ぶケース、
// 自動発火のスキルに紛らわしい依頼の負例が無いこと。新しい検査なので、運用が回るまでは警告にとどめる。

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const defaultPlugin = "dev-core";
const errors = [];
const warnings = [];

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

function skillPath(name) {
  return ["skills", "workflows"].map((kind) => join(pluginRoot, kind, name, "SKILL.md")).find((path) => existsSync(path));
}

function skillExists(name) {
  return skillPath(name) !== undefined;
}

// disable-model-invocation: true のスキルは、モデルが自分では呼ばない（スラッシュでだけ起動する）
function manualOnly(name) {
  const path = skillPath(name);
  if (!path) return false;
  const match = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return Boolean(match && /^disable-model-invocation:\s*true\s*$/m.test(match[1]));
}

// プロンプトが /<plugin>:<skill> で始まるケースは明示起動。それ以外は自動発火を前提にする
function explicitInvocation(testCase) {
  return typeof testCase.prompt === "string" && testCase.prompt.startsWith(`/${plugin}:`);
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
    if (testCase.expectedSkill !== undefined && (typeof testCase.expectedSkill !== "string" || testCase.expectedSkill.trim().length === 0)) {
      errors.push(`${label}.expectedSkill は、あるなら非空文字列でなければならない（例: dev-core:verify、builtin:/run）`);
    }
    // 手動起動専用のスキルの負例（shouldTrigger: false）は、普段の作業に割り込まないことを確かめる行動ガードなので対象外
    if (typeof testCase.skill === "string" && testCase.shouldTrigger === true && !explicitInvocation(testCase) && manualOnly(testCase.skill)) {
      warnings.push(`警告: ${testCase.id}: ${testCase.skill} は手動起動専用（disable-model-invocation）なのに、プロンプトが /${plugin}: で始まらない`);
    }
  }

  // 自動発火の正例を持つスキルには、紛らわしい依頼で発火しないことを確かめる負例を1件以上置く
  const autoSkills = new Set(suite.cases
    .filter((testCase) => testCase?.shouldTrigger === true && !explicitInvocation(testCase) && !manualOnly(testCase.skill))
    .map((testCase) => testCase.skill));
  for (const skill of autoSkills) {
    if (!suite.cases.some((testCase) => testCase?.skill === skill && testCase.shouldTrigger === false && !explicitInvocation(testCase))) {
      warnings.push(`警告: ${skill}: 自動発火の正例はあるが、紛らわしい依頼で発火しないことを確かめる負例（shouldTrigger: false）が無い`);
    }
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

if (warnings.length > 0) console.error(warnings.join("\n"));
console.log(`skill behavior eval validation passed (${plugin}: ${suite.cases.length} cases)`);
