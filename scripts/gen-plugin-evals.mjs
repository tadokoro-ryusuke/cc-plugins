#!/usr/bin/env node
// 行動ケース（<plugin>/evals/skill-behavior-cases.json）から、`claude plugin eval` のケースを生成する。
// ケースの正本は JSON の1か所だけにし、plugin eval のケースは生成物として扱う（gitignore 済み）。
//
// 使い方:
//   node scripts/gen-plugin-evals.mjs --plugin <name> [--behavior]
//   node scripts/gen-plugin-evals.mjs --plugin-root <dir> --suite <json> --out <dir> [--behavior]
// 生成先の既定は <plugin>/evals/plugin/。実行は次のとおり:
//   claude plugin eval ./<plugin> --eval-dir evals/plugin --no-publish --trust-plugin \
//     --model <固定> --max-cost-usd <上限> [--runs 1 --ablation none]
//
// 生成の規則:
//   - 自動発火のケース（プロンプトが /<plugin>: で始まらない）: Skill ツールが呼ばれたかを tool_used で見る。
//     正例は1回以上、負例は両方のアームで0回（arm: both）。無料の grader だけを使う
//   - 明示起動のケース（/<plugin>:<skill> で始まる）: Skill ツールを経由しないので発火は見られない。
//     --behavior のときだけ、expectedBehaviors / forbiddenBehaviors から llm grader を作って生成する
//   - --behavior: すべてのケースに llm grader を足す（判事の呼び出しで費用がかかる）
//   - disable-model-invocation のスキルを、スラッシュなしで自動発火させる正例はデータの誤りなので、
//     作らずに stderr へ出す。同じスキルの負例は行動ガードとして、--behavior のときだけ作る
// 作り直すときは、前に生成したケース（.generated がある）だけを消す。results/ と手書きのケースは残す。

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { behavior: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--behavior") args.behavior = true;
    else if (["--plugin", "--plugin-root", "--suite", "--out"].includes(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail(`${arg} には値が必要`);
      args[arg.slice(2)] = value;
      index += 1;
    } else fail(`未知の引数: ${arg}`);
  }
  return args;
}

function pluginRootFromMarketplace(plugin) {
  const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  const entry = marketplace.plugins?.find((item) => item?.name === plugin);
  if (!entry) fail(`marketplace にプラグイン "${plugin}" が無い`);
  return resolve(root, entry.source);
}

function skillFile(pluginRoot, skill) {
  return ["skills", "workflows"].map((kind) => join(pluginRoot, kind, skill, "SKILL.md")).find(existsSync);
}

function manualOnly(path) {
  const match = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return Boolean(match && /^disable-model-invocation:\s*true\s*$/m.test(match[1]));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillGrader(skill, shouldTrigger) {
  const match = `'"skill"\\s*:\\s*"(?:[\\w-]+:)?${escapeRegex(skill)}"'`;
  return shouldTrigger
    ? `---\ntype: tool_used\ntool: Skill\ninput_match: ${match}\n---\n`
    : `---\ntype: tool_used\ntool: Skill\ninput_match: ${match}\nmin: 0\nmax: 0\narm: both\n---\n`;
}

function behaviorGrader(testCase) {
  const lines = [
    "---", "type: llm", "focus: trace", "---", "",
    "PASS if every expected behavior below is observable in the run and no forbidden behavior occurs.",
    "FAIL if any expected behavior is missing or any forbidden behavior occurs, even when the final message reads naturally.",
    "", "Expected behaviors:", ...testCase.expectedBehaviors.map((item) => `- ${item}`),
    "", "Forbidden behaviors:", ...testCase.forbiddenBehaviors.map((item) => `- ${item}`), "",
  ];
  return lines.join("\n");
}

function cleanGenerated(out) {
  if (!existsSync(out)) return;
  for (const name of readdirSync(out)) {
    if (existsSync(join(out, name, ".generated"))) rmSync(join(out, name), { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.plugin && !args["plugin-root"]) fail("--plugin か --plugin-root を指定する");
const pluginRoot = args["plugin-root"] ? resolve(args["plugin-root"]) : pluginRootFromMarketplace(args.plugin);
const pluginName = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")).name;
const suitePath = args.suite ? resolve(args.suite) : join(pluginRoot, "evals/skill-behavior-cases.json");
const out = args.out ? resolve(args.out) : join(pluginRoot, "evals/plugin");
const suite = JSON.parse(readFileSync(suitePath, "utf8"));

cleanGenerated(out);
const generated = [];
const skippedExplicit = [];
for (const testCase of suite.cases) {
  const path = skillFile(pluginRoot, testCase.skill);
  if (!path) fail(`${testCase.id}: スキル ${testCase.skill} が ${pluginName} に無い`);
  const explicit = testCase.prompt.startsWith(`/${pluginName}:`);
  // 手動起動専用のスキルは Skill ツールで発火しないので、発火の grader は意味を持たない。負例は普段の作業に
  // 割り込まないことを確かめる行動ガードとして、明示起動と同じく振る舞いの grader だけで扱う
  const behaviorOnly = explicit || manualOnly(path);
  if (!explicit && manualOnly(path) && testCase.shouldTrigger) {
    console.error(`警告: ${testCase.id}: ${testCase.skill} は手動起動専用なのに、プロンプトがスラッシュで始まらない（作らない）`);
    continue;
  }
  if (behaviorOnly && !args.behavior) {
    skippedExplicit.push(testCase.id);
    continue;
  }
  const dir = join(out, testCase.id);
  mkdirSync(join(dir, "graders"), { recursive: true });
  const tags = [explicit ? "explicit" : behaviorOnly ? "behavior-guard" : "auto", testCase.shouldTrigger ? "positive" : "negative", testCase.skill];
  writeFileSync(join(dir, "prompt.md"), [
    "---",
    `description: 生成物（正本は ${suitePath.slice(pluginRoot.length + 1)} の ${testCase.id}）。直接編集しない`,
    `tags: [${tags.join(", ")}]`,
    "max_turns: 4",
    "timeout_seconds: 240",
    "allowed_tools: [Read, Glob, Grep, Skill]",
    "---",
    "",
    testCase.prompt,
    "",
  ].join("\n"));
  if (!behaviorOnly) {
    writeFileSync(join(dir, "graders", testCase.shouldTrigger ? "skill-fired.md" : "skill-not-fired.md"),
      skillGrader(testCase.skill, testCase.shouldTrigger));
  }
  if (args.behavior) writeFileSync(join(dir, "graders/behavior.md"), behaviorGrader(testCase));
  writeFileSync(join(dir, ".generated"), "");
  generated.push(testCase.id);
}

console.log(`${generated.length} 件を ${out} に生成した`);
if (skippedExplicit.length > 0) {
  console.log(`明示起動と行動ガードの ${skippedExplicit.length} 件は作らなかった（--behavior で作る）: ${skippedExplicit.join(", ")}`);
}
