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
 */

import { existsSync } from "node:fs";
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

/** 終了コード定数。 */
const EXIT_OK = 0;
const EXIT_DRIFT = 1;

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
