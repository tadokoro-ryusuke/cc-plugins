// contrast.mjs のテスト。Node 標準の node:test だけを使う（追加依存なし）。
// 実行: node --test design-core/skills/ui-visual-defaults/scripts/contrast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseColor,
  relativeLuminance,
  contrastRatio,
  evaluatePair,
  formatRatio,
  THRESHOLDS,
} from "./contrast.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "contrast.mjs");

/** 期待値との差が tolerance 以内か確かめる。 */
function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message ?? ""} expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

/** CLI を子プロセスで実行する。 */
function cli(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** ペア一覧を一時ファイルに書いてパスを返す。 */
function pairsFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "contrast-test-"));
  const path = join(dir, "pairs.json");
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

// --- 閾値 -------------------------------------------------------------

test("role ごとの閾値は WCAG 2.2 AA（1.4.3 / 1.4.11）に合わせる", () => {
  assert.equal(THRESHOLDS.text, 4.5);
  assert.equal(THRESHOLDS.large, 3);
  assert.equal(THRESHOLDS.ui, 3);
});

// --- 16進 ---------------------------------------------------------------

test("#fff と #000 は 21:1", () => {
  near(contrastRatio("#fff", "#000").ratio, 21, 1e-9);
  near(contrastRatio("#000000", "#ffffff").ratio, 21, 1e-9);
});

test("3桁の #999 を読める（旧ワンライナーは NaN を返していた）", () => {
  const { ratio } = contrastRatio("#999", "#fff");
  assert.ok(Number.isFinite(ratio));
  near(ratio, 2.85, 0.01);
});

test("#1a1a1a × 白は 17.40", () => {
  near(contrastRatio("#1a1a1a", "#ffffff").ratio, 17.4, 0.01);
});

test("8桁 hex の alpha を背景に合成してから計算する（17.40 の誤合格にしない）", () => {
  const { ratio } = contrastRatio("#1a1a1a80", "#fff");
  assert.ok(ratio < 4.5, `半透明の文字は不合格になるはず: ${ratio}`);
  near(ratio, 3.36, 0.05);
});

test("4桁 hex の alpha も読む", () => {
  const color = parseColor("#0008");
  near(color.alpha, 0x88 / 255, 1e-9);
});

// --- rgb() / hsl() -------------------------------------------------------

test("rgb() は空白区切りとカンマ区切りの両方を読む", () => {
  near(contrastRatio("rgb(26 26 26)", "#fff").ratio, 17.4, 0.01);
  near(contrastRatio("rgb(26, 26, 26)", "#fff").ratio, 17.4, 0.01);
  near(contrastRatio("rgba(26, 26, 26, 1)", "#fff").ratio, 17.4, 0.01);
});

test("rgb() の alpha（数値と %）を合成する", () => {
  const half = contrastRatio("rgb(26 26 26 / 0.5)", "#fff").ratio;
  const halfPercent = contrastRatio("rgb(26 26 26 / 50%)", "#fff").ratio;
  near(half, halfPercent, 1e-9);
  assert.ok(half < 4.5);
});

test("hsl() は空白区切りとカンマ区切りの両方を読む", () => {
  near(contrastRatio("hsl(0 0% 100%)", "#000").ratio, 21, 1e-9);
  near(contrastRatio("hsl(0, 0%, 0%)", "#fff").ratio, 21, 1e-9);
  // hsl(0 0% 60%) は #999 と同じ灰色
  near(contrastRatio("hsl(0 0% 60%)", "#fff").ratio, contrastRatio("#999", "#fff").ratio, 1e-9);
});

test("hsl() の色相は CSS Color 4 の変換どおり（120deg = 緑）", () => {
  const { rgb } = parseColor("hsl(120deg 100% 50%)");
  near(rgb[0], 0, 1e-9);
  near(rgb[1], 1, 1e-9);
  near(rgb[2], 0, 1e-9);
  const turn = parseColor("hsla(0.5turn, 100%, 50%, 1)").rgb; // 180deg = シアン
  near(turn[0], 0, 1e-9);
  near(turn[1], 1, 1e-9);
  near(turn[2], 1, 1e-9);
});

// --- oklch() ------------------------------------------------------------

test("oklch(1 0 0) は白。色域の警告を出さない", () => {
  const color = parseColor("oklch(1 0 0)");
  assert.equal(color.outOfGamut, false);
  near(contrastRatio("oklch(1 0 0)", "#000").ratio, 21, 1e-6);
});

test("無彩色の oklch は相対輝度が L の3乗になる（OKLab の定義から）", () => {
  for (const L of [0.145, 0.205, 0.556, 0.708, 0.985]) {
    const color = parseColor(`oklch(${L} 0 0)`);
    assert.equal(color.outOfGamut, false, `oklch(${L} 0 0) を色域外と誤判定した`);
    near(relativeLuminance(color.rgb), L ** 3, 1e-6, `L=${L}`);
  }
});

test("oklch の L は % でも書ける（Tailwind v4 の既定パレットの書式）", () => {
  near(
    contrastRatio("oklch(55.6% 0 0)", "#fff").ratio,
    contrastRatio("oklch(0.556 0 0)", "#fff").ratio,
    1e-9,
  );
});

test("sRGB の赤は oklch(0.627955 0.257683 29.2339) とほぼ一致し、色域内と判定する", () => {
  const color = parseColor("oklch(0.627955 0.257683 29.2339)");
  assert.equal(color.outOfGamut, false);
  near(color.rgb[0], 1, 1 / 255);
  near(color.rgb[1], 0, 1 / 255);
  near(color.rgb[2], 0, 1 / 255);
});

test("shadcn/ui の既定トークン oklch(1 0 0 / 10%) の % alpha を読む", () => {
  const color = parseColor("oklch(1 0 0 / 10%)");
  near(color.alpha, 0.1, 1e-9);
});

test("sRGB の色域外の oklch はクリップして計算し、警告を返す", () => {
  const color = parseColor("oklch(0.7 0.4 145)");
  assert.equal(color.outOfGamut, true);
  const result = contrastRatio("oklch(0.7 0.4 145)", "#fff");
  assert.ok(Number.isFinite(result.ratio));
  assert.ok(result.warnings.length > 0);
  assert.match(result.warnings.join("\n"), /色域/);
});

test("oklch の C は % でも書ける（100% = 0.4）", () => {
  const a = parseColor("oklch(0.6 50% 250)").rgb;
  const b = parseColor("oklch(0.6 0.2 250)").rgb;
  for (let i = 0; i < 3; i += 1) near(a[i], b[i], 1e-9);
});

// --- 判定と表示 --------------------------------------------------------

test("閾値の直下は不合格。丸めた表示値ではなく生の比で判定する", () => {
  const below = evaluatePair({ fg: "#777", bg: "#fff", role: "text" });
  near(below.ratio, 4.48, 0.01);
  assert.equal(below.pass, false);
  const above = evaluatePair({ fg: "#767676", bg: "#fff", role: "text" });
  assert.equal(above.pass, true);
});

test("表示は小数2桁で切り捨てる（4.499 を 4.50 と見せない）", () => {
  assert.equal(formatRatio(4.4999), "4.49");
  assert.equal(formatRatio(21), "21.00");
});

test("role が large / ui なら 3:1 で判定する", () => {
  const large = evaluatePair({ fg: "#888", bg: "#fff", role: "large" });
  assert.equal(large.threshold, 3);
  assert.equal(large.pass, true);
  const text = evaluatePair({ fg: "#888", bg: "#fff" });
  assert.equal(text.threshold, 4.5, "role の既定は最も厳しい text");
  assert.equal(text.pass, false);
});

test("背景が alpha を持つときは under（不透明な下地）に合成する", () => {
  const result = evaluatePair({ fg: "#fff", bg: "rgb(0 0 0 / 50%)", under: "#fff", role: "text" });
  // 黒50% を白に重ねると、ガンマ補正済みの値で 0.5（rgb(127.5 127.5 127.5)）の灰色になる
  near(result.ratio, contrastRatio("#fff", "rgb(127.5 127.5 127.5)").ratio, 1e-9);
  near(result.ratio, 3.98, 0.01);
});

// --- 入力エラー --------------------------------------------------------

test("解釈できない入力は例外にする（NaN を返さない）", () => {
  for (const bad of ["nonsense", "#12", "#12345", "rgb(1 2)", "oklch(0.5, 0.1, 20)", "var(--primary)", "", "white"]) {
    assert.throws(() => parseColor(bad), undefined, `「${bad}」を受け付けてしまった`);
  }
});

test("背景に alpha があり under がないときは例外にする", () => {
  assert.throws(() => evaluatePair({ fg: "#000", bg: "#ffffff80" }), /under/);
});

test("未知の role は例外にする", () => {
  assert.throws(() => evaluatePair({ fg: "#000", bg: "#fff", role: "huge" }), /role/);
});

// --- CLI ---------------------------------------------------------------

test("CLI: 2色を渡すと判定して、合格なら終了コード 0", () => {
  const result = cli("#1a1a1a", "#ffffff");
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
  assert.match(result.stdout, /17\.40/);
});

test("CLI: 不合格のペアがあれば終了コード 1", () => {
  const result = cli("#999", "#fff");
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL/);
  assert.match(result.stdout, /2\.8[45]/);
});

test("CLI: --role large で 3:1 判定", () => {
  assert.equal(cli("#888", "#fff", "--role", "large").code, 0);
});

test("CLI: ペア一覧 JSON を読み、1件でも不合格なら終了コード 1", () => {
  const path = pairsFile([
    { name: "本文", fg: "oklch(0.145 0 0)", bg: "oklch(1 0 0)", role: "text" },
    { name: "補足", fg: "#999", bg: "#fff", role: "text" },
  ]);
  const result = cli(path);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /本文/);
  assert.match(result.stdout, /補足/);
});

test("CLI: { pairs: [...] } 形式も読む", () => {
  const path = pairsFile({ pairs: [{ fg: "#000", bg: "#fff" }] });
  assert.equal(cli(path).code, 0);
});

test("CLI: --json で機械可読の結果を出す", () => {
  const path = pairsFile([{ name: "本文", fg: "#000", bg: "#fff" }]);
  const result = cli(path, "--json");
  assert.equal(result.code, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].pass, true);
  near(parsed.results[0].ratio, 21, 1e-9);
});

test("CLI: 色域外の oklch は WARN を出す（黙って通さない）", () => {
  const result = cli("oklch(0.3 0.4 145)", "#fff");
  assert.match(result.stdout + result.stderr, /WARN/);
});

test("CLI: 解釈できない色は終了コード 2 とエラーメッセージ", () => {
  const result = cli("var(--primary)", "#fff");
  assert.equal(result.code, 2);
  assert.match(result.stderr, /var\(\)/);
  assert.doesNotMatch(result.stdout, /NaN/);
});

test("CLI: 背景の alpha に under がなければ終了コード 2", () => {
  const path = pairsFile([{ fg: "#000", bg: "#ffffff80" }]);
  const result = cli(path);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /under/);
});

test("CLI: 壊れた JSON・存在しないファイル・引数なしは終了コード 2", () => {
  assert.equal(cli(pairsFile("{not json")).code, 2);
  assert.equal(cli(join(here, "no-such-file.json")).code, 2);
  assert.equal(cli().code, 2);
});

test("CLI: 同梱の例（shadcn/ui の neutral 既定トークン）を検証できる", () => {
  const result = cli(join(here, "fixtures", "shadcn-neutral.pairs.json"));
  assert.notEqual(result.code, 2, result.stderr);
  assert.doesNotMatch(result.stdout, /NaN/);
});
