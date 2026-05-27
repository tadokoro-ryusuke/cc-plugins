#!/usr/bin/env node
// @ts-check
/**
 * check-skills-drift.mjs
 *
 * dev-core プラグインのスキル構成とマニフェストの「ずれ（drift）」を静的に検証する。
 * Node 標準モジュールのみで実装し、追加依存を持たない（ESM .mjs）。
 *
 * 実行: リポジトリルートから `node scripts/check-skills-drift.mjs`
 * 終了コード: 検証成功で 0、違反が1つ以上あれば 1。
 *
 * Iteration 0: 「dev-core/.codex-plugin/plugin.json が存在すること」だけを検証する骨格。
 * Iteration 1: 全 SKILL.md の frontmatter スキーマを検証する。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** スクリプト自身の絶対パス。 */
const SCRIPT_PATH = fileURLToPath(import.meta.url);
/** scripts/ ディレクトリ。 */
const SCRIPTS_DIR = dirname(SCRIPT_PATH);
/** リポジトリルート（scripts/ の親）。相対パス起点。 */
const REPO_ROOT = resolve(SCRIPTS_DIR, "..");

/** Codex 用プラグインマニフェストのリポジトリルートからの相対パス。 */
const CODEX_PLUGIN_MANIFEST_REL = join(
  "dev-core",
  ".codex-plugin",
  "plugin.json",
);

/** dev-core のスキルを格納するディレクトリのリポジトリルートからの相対パス。 */
const SKILLS_DIR_REL = join("dev-core", "skills");

/** 各スキルディレクトリ内のスキル定義ファイル名。 */
const SKILL_FILE_NAME = "SKILL.md";

/** frontmatter の `name` フィールドの最大文字数（Agent Skills 標準）。 */
const NAME_MAX_LENGTH = 64;

/** frontmatter の `description` フィールドの最大文字数（Agent Skills 標準）。 */
const DESCRIPTION_MAX_LENGTH = 1024;

/** frontmatter の `name` に許可される形式。小文字英数とハイフンのみ。 */
const NAME_PATTERN = /^[a-z0-9-]+$/;

/**
 * frontmatter のトップレベルに存在してはならないフィールド（Claude 独自拡張）。
 * Agent Skills 標準への混入を防ぐ deny-list。
 */
const DENIED_TOP_LEVEL_KEYS = ["model", "color", "tools"];

/** 終了コード定数。 */
const EXIT_OK = 0;
const EXIT_DRIFT = 1;

/**
 * SKILL.md 本文から frontmatter ブロックの中身を取り出す。
 * 仕様: ファイル先頭の `---` 行から次の `---` 行までを frontmatter とみなす。
 * @param {string} content SKILL.md の全文。
 * @returns {string | null} frontmatter 本体（区切り `---` を含まない）。存在しなければ null。
 */
function extractFrontmatterBlock(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return null;
  }
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    return null;
  }
  return lines.slice(1, closingIndex).join("\n");
}

/**
 * frontmatter ブロックからインデントの無いトップレベルキーを行ベースで抽出する。
 * 単純な `key: value` のみ対象とし、YAML パーサは使わない（外部依存禁止）。
 * value は quote 付き/無しの両方に対応し、前後の囲み quote を除去する。
 * @param {string} block frontmatter 本体。
 * @returns {Map<string, string>} トップレベルキー → 値のマップ。
 */
function parseTopLevelKeys(block) {
  /** @type {Map<string, string>} */
  const result = new Map();
  for (const rawLine of block.split("\n")) {
    // インデント行（ネスト）・空行・コメント行はトップレベルではないのでスキップ。
    if (rawLine.length === 0 || /^\s/.test(rawLine) || rawLine.startsWith("#")) {
      continue;
    }
    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = rawLine.slice(0, separatorIndex).trim();
    if (key.length === 0) {
      continue;
    }
    const rawValue = rawLine.slice(separatorIndex + 1).trim();
    result.set(key, stripSurroundingQuotes(rawValue));
  }
  return result;
}

/**
 * 値の前後を囲む同種の quote（" または '）を1組だけ除去する。
 * @param {string} value 生の値文字列。
 * @returns {string} quote を除去した値。
 */
function stripSurroundingQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * `name` フィールドが命名規約を満たすか検証する。
 * 規約: 64字以内・小文字英数とハイフンのみ・先頭/末尾ハイフン不可・連続ハイフン不可。
 * @param {string} name 検証対象の name。
 * @returns {string | null} 違反内容。問題なければ null。
 */
function validateNameFormat(name) {
  if (name.length > NAME_MAX_LENGTH) {
    return `name が ${NAME_MAX_LENGTH} 字を超えている（${name.length} 字）`;
  }
  if (!NAME_PATTERN.test(name)) {
    return "name は小文字英数とハイフンのみ使用できる";
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return "name の先頭/末尾にハイフンは使用できない";
  }
  if (name.includes("--")) {
    return "name に連続したハイフンは使用できない";
  }
  return null;
}

/**
 * 単一スキルの SKILL.md frontmatter を検証し、違反内容を返す。
 * @param {string} dirName スキルディレクトリ名（= 期待される name）。
 * @param {string} skillFilePath SKILL.md の絶対パス。
 * @returns {string[]} このスキルに対する違反内容の配列（ファイル名は含まない）。
 */
function validateSkillFrontmatter(dirName, skillFilePath) {
  /** @type {string[]} */
  const issues = [];

  if (!existsSync(skillFilePath)) {
    issues.push(`${SKILL_FILE_NAME} が存在しない`);
    return issues;
  }

  const content = readFileSync(skillFilePath, "utf8");
  const block = extractFrontmatterBlock(content);
  if (block === null) {
    issues.push("frontmatter（先頭の --- ブロック）が存在しない");
    return issues;
  }

  const fields = parseTopLevelKeys(block);

  // ルール2: name と description が存在する。
  if (!fields.has("name")) {
    issues.push("frontmatter に name が無い");
  }
  if (!fields.has("description")) {
    issues.push("frontmatter に description が無い");
  }

  // ルール3 & 4: name が親ディレクトリ名と一致し、命名規約を満たす。
  const name = fields.get("name");
  if (name !== undefined) {
    if (name !== dirName) {
      issues.push(`name "${name}" が親ディレクトリ名 "${dirName}" と一致しない`);
    }
    const formatIssue = validateNameFormat(name);
    if (formatIssue !== null) {
      issues.push(formatIssue);
    }
  }

  // ルール5: description は 1024 字以内。
  const description = fields.get("description");
  if (description !== undefined && description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push(
      `description が ${DESCRIPTION_MAX_LENGTH} 字を超えている（${description.length} 字）`,
    );
  }

  // ルール6: deny-list フィールドがトップレベルに無い。
  for (const deniedKey of DENIED_TOP_LEVEL_KEYS) {
    if (fields.has(deniedKey)) {
      issues.push(
        `トップレベルに Claude 独自フィールド "${deniedKey}" を含めてはならない`,
      );
    }
  }

  return issues;
}

/**
 * 全 dev-core スキルの SKILL.md frontmatter を走査し、違反を集約する。
 * @returns {string[]} 「ファイル名: 違反内容」形式の違反メッセージ配列。
 */
function collectFrontmatterViolations() {
  /** @type {string[]} */
  const violations = [];

  const skillsDir = join(REPO_ROOT, SKILLS_DIR_REL);
  if (!existsSync(skillsDir)) {
    violations.push(`missing ${SKILLS_DIR_REL}`);
    return violations;
  }

  const dirEntries = readdirSync(skillsDir, { withFileTypes: true });
  const skillDirNames = dirEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dirName of skillDirNames) {
    const skillFileRel = join(SKILLS_DIR_REL, dirName, SKILL_FILE_NAME);
    const skillFilePath = join(REPO_ROOT, skillFileRel);
    const issues = validateSkillFrontmatter(dirName, skillFilePath);
    for (const issue of issues) {
      violations.push(`${skillFileRel}: ${issue}`);
    }
  }

  return violations;
}

/**
 * 検出した違反メッセージを集約する。
 * @returns {string[]} 違反メッセージの配列。空なら drift なし。
 */
function collectViolations() {
  /** @type {string[]} */
  const violations = [];

  const codexManifestPath = join(REPO_ROOT, CODEX_PLUGIN_MANIFEST_REL);
  if (!existsSync(codexManifestPath)) {
    violations.push(`missing ${CODEX_PLUGIN_MANIFEST_REL}`);
  }

  violations.push(...collectFrontmatterViolations());

  return violations;
}

/**
 * エントリポイント。違反があれば標準エラーへ出力し exit code 1 で終了する。
 */
function main() {
  const violations = collectViolations();

  if (violations.length > 0) {
    console.error("skills drift check failed:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(EXIT_DRIFT);
  }

  console.log("skills drift check passed");
  process.exit(EXIT_OK);
}

main();
