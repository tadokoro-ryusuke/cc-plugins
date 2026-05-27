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
 * Iteration 2: 全 SKILL.md が metadata.version を持ち、.claude-plugin/plugin.json の
 *              version と一致することを検証する（運用要件として必須化）。
 * Iteration 3: .codex-plugin/plugin.json の内容（name=kebab / version=semver /
 *              description=非空 / skills="./skills/"）と、.claude-plugin/plugin.json
 *              との name/version 一致（cross-manifest）を検証する。
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

/** Claude 用プラグインマニフェスト（name/version の正）のリポジトリルートからの相対パス。 */
const CLAUDE_PLUGIN_MANIFEST_REL = join(
  "dev-core",
  ".claude-plugin",
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
 * プラグインマニフェストの `name` に許可される形式（kebab-case）。
 * SKILL.md の name と同じく小文字英数とハイフンのみ。
 */
const PLUGIN_NAME_PATTERN = /^[a-z0-9-]+$/;

/** プラグインマニフェストの `version` に許可される形式（semver の major.minor.patch）。 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/** Codex マニフェストの `skills` フィールドが指すべき値（同一 skills/ ディレクトリ参照）。 */
const EXPECTED_CODEX_SKILLS = "./skills/";

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

/** `metadata:` ブロック配下のネストキーで使用するインデント（2スペース）。 */
const METADATA_INDENT = "  ";

/**
 * frontmatter ブロックから `metadata:` 配下のネストキー（インデント2スペース）を抽出する。
 * 仕様: トップレベルの `metadata:` 行を起点に、`  key: value` 形式の行を読み取り、
 * インデントを持たない次のトップレベルキー行に達した時点で打ち切る。YAML パーサは使わない。
 * @param {string} block frontmatter 本体。
 * @returns {Map<string, string>} metadata 配下のキー → 値のマップ。metadata が無ければ空。
 */
function parseMetadataBlock(block) {
  /** @type {Map<string, string>} */
  const result = new Map();
  const lines = block.split("\n");

  let insideMetadata = false;
  for (const rawLine of lines) {
    if (rawLine.length === 0 || rawLine.startsWith("#")) {
      continue;
    }

    const isIndented = /^\s/.test(rawLine);

    if (!insideMetadata) {
      // トップレベルの `metadata:`（値を持たない）を検出したら以降を読み取る。
      if (!isIndented && rawLine.replace(/\s+$/, "") === "metadata:") {
        insideMetadata = true;
      }
      continue;
    }

    // metadata ブロック内: インデントが切れたらブロック終了（次のトップレベルキー）。
    if (!isIndented) {
      break;
    }

    // 2スペースインデントの `key: value` のみ対象。
    if (!rawLine.startsWith(METADATA_INDENT)) {
      continue;
    }
    const trimmed = rawLine.slice(METADATA_INDENT.length);
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    if (key.length === 0) {
      continue;
    }
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    result.set(key, stripSurroundingQuotes(rawValue));
  }

  return result;
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
 * @param {string} expectedVersion plugin.json の version（metadata.version の期待値）。
 * @returns {string[]} このスキルに対する違反内容の配列（ファイル名は含まない）。
 */
function validateSkillFrontmatter(dirName, skillFilePath, expectedVersion) {
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
  // 注: metadata は Agent Skills 標準の任意トップレベルキーであり deny-list に含めない。
  for (const deniedKey of DENIED_TOP_LEVEL_KEYS) {
    if (fields.has(deniedKey)) {
      issues.push(
        `トップレベルに Claude 独自フィールド "${deniedKey}" を含めてはならない`,
      );
    }
  }

  // ルール7（Iteration 2）: metadata.version が存在し plugin.json の version と一致する。
  const metadata = parseMetadataBlock(block);
  const metadataVersion = metadata.get("version");
  if (metadataVersion === undefined) {
    issues.push("frontmatter に metadata.version が無い");
  } else if (metadataVersion !== expectedVersion) {
    issues.push(
      `metadata.version "${metadataVersion}" が plugin.json の version "${expectedVersion}" と一致しない`,
    );
  }

  return issues;
}

/**
 * プラグインマニフェスト（plugin.json）を読み込みパースする共通関数。
 * 存在チェックと JSON パースエラー処理を一箇所に集約する。
 * @param {string} relPath リポジトリルートからのマニフェスト相対パス。
 * @returns {{ data: Record<string, unknown> | null, error: string | null }}
 *   data: パース済みオブジェクト（失敗時 null）。error: 失敗理由（成功時 null）。
 */
function loadManifest(relPath) {
  const manifestPath = join(REPO_ROOT, relPath);
  if (!existsSync(manifestPath)) {
    return { data: null, error: `missing ${relPath}` };
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    return { data: parsed, error: null };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { data: null, error: `${relPath} の JSON 解析に失敗した: ${reason}` };
  }
}

/**
 * `.claude-plugin/plugin.json` から version を読み取る。
 * version の正本はこのマニフェストであり、マジックストリングを排除するため一箇所に集約する。
 * @returns {{ version: string | null, error: string | null }}
 *   version 取得結果。読み取り失敗時は version=null・error にメッセージを格納する。
 */
function loadPluginVersion() {
  const { data, error } = loadManifest(CLAUDE_PLUGIN_MANIFEST_REL);
  if (data === null) {
    return { version: null, error };
  }

  const version = data.version;
  if (typeof version !== "string" || version.length === 0) {
    return {
      version: null,
      error: `${CLAUDE_PLUGIN_MANIFEST_REL} に version フィールドが無い`,
    };
  }

  return { version, error: null };
}

/**
 * 全 dev-core スキルの SKILL.md frontmatter を走査し、違反を集約する。
 * @returns {string[]} 「ファイル名: 違反内容」形式の違反メッセージ配列。
 */
function collectFrontmatterViolations() {
  /** @type {string[]} */
  const violations = [];

  const { version: expectedVersion, error: versionError } = loadPluginVersion();
  if (expectedVersion === null) {
    violations.push(
      versionError ?? `cannot read version from ${CLAUDE_PLUGIN_MANIFEST_REL}`,
    );
    return violations;
  }

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
    const issues = validateSkillFrontmatter(
      dirName,
      skillFilePath,
      expectedVersion,
    );
    for (const issue of issues) {
      violations.push(`${skillFileRel}: ${issue}`);
    }
  }

  return violations;
}

/**
 * Codex マニフェスト（.codex-plugin/plugin.json）の内容を検証する。
 * 検証項目: name(kebab) / version(semver) / description(非空) / skills("./skills/")。
 * @param {Record<string, unknown>} codex パース済み Codex マニフェスト。
 * @returns {string[]} このマニフェストに対する違反内容の配列（ファイル名は含まない）。
 */
function validateCodexManifestContent(codex) {
  /** @type {string[]} */
  const issues = [];

  const name = codex.name;
  if (typeof name !== "string" || name.length === 0) {
    issues.push("name が無いか文字列でない");
  } else if (!PLUGIN_NAME_PATTERN.test(name)) {
    issues.push(`name "${name}" が kebab-case（小文字英数とハイフンのみ）でない`);
  }

  const version = codex.version;
  if (typeof version !== "string" || version.length === 0) {
    issues.push("version が無いか文字列でない");
  } else if (!SEMVER_PATTERN.test(version)) {
    issues.push(`version "${version}" が semver（major.minor.patch）でない`);
  }

  const description = codex.description;
  if (typeof description !== "string" || description.length === 0) {
    issues.push("description が無いか空文字列である");
  }

  const skills = codex.skills;
  if (skills !== EXPECTED_CODEX_SKILLS) {
    issues.push(
      `skills が "${EXPECTED_CODEX_SKILLS}" でない（実際: ${JSON.stringify(skills)}）`,
    );
  }

  return issues;
}

/**
 * Codex マニフェストと Claude マニフェストの name/version 一致（cross-manifest）を検証する。
 * @param {Record<string, unknown>} codex パース済み Codex マニフェスト。
 * @param {Record<string, unknown>} claude パース済み Claude マニフェスト。
 * @returns {string[]} 不一致の違反内容の配列。
 */
function validateCrossManifestConsistency(codex, claude) {
  /** @type {string[]} */
  const issues = [];

  if (codex.name !== claude.name) {
    issues.push(
      `name が .claude-plugin と一致しない（codex: ${JSON.stringify(codex.name)} / claude: ${JSON.stringify(claude.name)}）`,
    );
  }
  if (codex.version !== claude.version) {
    issues.push(
      `version が .claude-plugin と一致しない（codex: ${JSON.stringify(codex.version)} / claude: ${JSON.stringify(claude.version)}）`,
    );
  }

  return issues;
}

/**
 * Codex マニフェストの存在・内容・cross-manifest 整合を検証し、違反を集約する。
 * @returns {string[]} 「相対パス: 違反内容」形式の違反メッセージ配列。
 */
function collectManifestViolations() {
  /** @type {string[]} */
  const violations = [];

  const { data: codex, error: codexError } = loadManifest(
    CODEX_PLUGIN_MANIFEST_REL,
  );
  if (codex === null) {
    violations.push(codexError ?? `missing ${CODEX_PLUGIN_MANIFEST_REL}`);
    return violations;
  }

  for (const issue of validateCodexManifestContent(codex)) {
    violations.push(`${CODEX_PLUGIN_MANIFEST_REL}: ${issue}`);
  }

  const { data: claude, error: claudeError } = loadManifest(
    CLAUDE_PLUGIN_MANIFEST_REL,
  );
  if (claude === null) {
    violations.push(claudeError ?? `missing ${CLAUDE_PLUGIN_MANIFEST_REL}`);
    return violations;
  }

  for (const issue of validateCrossManifestConsistency(codex, claude)) {
    violations.push(`${CODEX_PLUGIN_MANIFEST_REL}: ${issue}`);
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

  violations.push(...collectManifestViolations());
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
