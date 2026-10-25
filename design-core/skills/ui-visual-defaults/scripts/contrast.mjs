#!/usr/bin/env node
// WCAG 2.2 のコントラスト比を、デザイントークンの色形式のまま検証する。
// Node 標準モジュールだけで動く（追加依存なし）。テスト: contrast.test.mjs
//
// 使い方:
//   node contrast.mjs <前景色> <背景色> [--role text|large|ui] [--under <下地色>] [--json]
//   node contrast.mjs <pairs.json> [--json]
//
// pairs.json は配列か { "pairs": [...] }。各要素は
//   { "name": "本文", "fg": "oklch(0.145 0 0)", "bg": "oklch(1 0 0)", "role": "text", "under": "#fff" }
//   role: text = 4.5:1（1.4.3）/ large = 3:1（1.4.3 の大きい文字）/ ui = 3:1（1.4.11）。省略時は text。
//   under: 背景色が半透明のときに、その下にある不透明な面の色。
//
// 読める色: #rgb #rgba #rrggbb #rrggbbaa / rgb() rgba() / hsl() hsla() / oklch()（alpha 付きを含む）
// 終了コード: 0 = 全ペア合格 / 1 = 不合格あり / 2 = 入力の誤り（解釈できない色・引数・JSON）
//
// 計算の根拠:
// - 相対輝度とコントラスト比は WCAG 2.2 の定義（https://www.w3.org/TR/WCAG22/#dfn-relative-luminance）。
// - oklch → sRGB の変換と hsl → sRGB の変換は CSS Color 4 のサンプルコード
//   （https://www.w3.org/TR/css-color-4/#color-conversion-code）の行列と式をそのまま使う。
// - 半透明の前景は、ブラウザと同じくガンマ補正済みの sRGB 値で背景に重ねてから計算する。
// - sRGB の色域外の色は各チャンネルを 0〜1 にクリップして計算し、警告を出す。

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** WCAG 2.2 AA の下限。text は 1.4.3、large は 1.4.3 の大きい文字、ui は 1.4.11。 */
export const THRESHOLDS = Object.freeze({ text: 4.5, large: 3, ui: 3 });

/** 8bit に量子化して値が変わらない程度のはみ出しは、計算誤差として色域内とみなす。 */
const GAMUT_EPSILON = 0.5 / 255;

export class ColorInputError extends Error {}

const ACCEPTED = "#rgb #rgba #rrggbb #rrggbbaa / rgb() / rgba() / hsl() / hsla() / oklch()";

// --- 数値トークン -------------------------------------------------------------

const NUMBER_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/;

/** @returns {{ value: number, unit: string } | { none: true }} */
function token(raw, input) {
  if (raw === "none") return { none: true };
  const match = NUMBER_RE.exec(raw);
  if (!match) throw new ColorInputError(`「${input}」の「${raw}」を数値として読めない`);
  return { value: Number(match[1]), unit: match[2] ?? "" };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function alphaOf(raw, input) {
  if (raw === undefined) return 1;
  const t = token(raw, input);
  if (t.none) return 0;
  if (t.unit === "%") return clamp(t.value / 100, 0, 1);
  if (t.unit !== "") throw new ColorInputError(`「${input}」の alpha に単位「${t.unit}」は使えない`);
  return clamp(t.value, 0, 1);
}

function hueOf(raw, input) {
  const t = token(raw, input);
  if (t.none) return 0;
  switch (t.unit) {
    case "":
    case "deg":
      return t.value;
    case "rad":
      return (t.value * 180) / Math.PI;
    case "grad":
      return t.value * 0.9;
    case "turn":
      return t.value * 360;
    default:
      throw new ColorInputError(`「${input}」の色相に「${t.unit}」は使えない`);
  }
}

/** 0〜255 の数値か % を 0〜1 にする。 */
function rgbChannel(raw, input) {
  const t = token(raw, input);
  if (t.none) return 0;
  if (t.unit === "%") return clamp(t.value / 100, 0, 1);
  if (t.unit !== "") throw new ColorInputError(`「${input}」の rgb 成分に単位「${t.unit}」は使えない`);
  return clamp(t.value / 255, 0, 1);
}

/** hsl の S と L。% でも数値でも 0〜100 の範囲として読む。 */
function hslPercent(raw, input) {
  const t = token(raw, input);
  if (t.none) return 0;
  if (t.unit !== "" && t.unit !== "%") {
    throw new ColorInputError(`「${input}」の彩度・明度に単位「${t.unit}」は使えない`);
  }
  return t.value;
}

// --- 関数記法の分解 -------------------------------------------------------------

/** 括弧の中身を、成分3つと alpha に分ける。 */
function splitArgs(name, body, input) {
  if (body.includes(",")) {
    if (name === "oklch") {
      throw new ColorInputError(`「${input}」: oklch() はカンマ区切りを使えない（CSS Color 4）`);
    }
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) {
      throw new ColorInputError(`「${input}」: 成分は3つ（alpha を含めて4つ）必要`);
    }
    return { channels: parts.slice(0, 3), alpha: parts[3] };
  }
  const [main, alpha, extra] = body.split("/").map((part) => part.trim());
  if (extra !== undefined || alpha === "") {
    throw new ColorInputError(`「${input}」: alpha の区切り「/」の書き方が正しくない`);
  }
  const channels = main.split(/\s+/).filter(Boolean);
  if (channels.length !== 3) throw new ColorInputError(`「${input}」: 成分は3つ必要`);
  return { channels, alpha };
}

// --- 色空間の変換（CSS Color 4 のサンプルコード） ---------------------------------

function multiply(matrix, vector) {
  return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

const OKLAB_TO_LMS = [
  [1.0, 0.3963377773761749, 0.2158037573099136],
  [1.0, -0.1055613458156586, -0.0638541728258133],
  [1.0, -0.0894841775298119, -1.2914855480194092],
];

const LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];

const XYZ_TO_LIN_SRGB = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];

/** 線形 sRGB をガンマ補正済みに（範囲外の値は符号を保ったまま延長する）。 */
function gammaEncode(linear) {
  return linear.map((value) => {
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    return abs > 0.0031308 ? sign * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * value;
  });
}

function oklchToSrgb(L, C, H) {
  const lab = [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
  const lms = multiply(OKLAB_TO_LMS, lab).map((value) => value ** 3);
  return gammaEncode(multiply(XYZ_TO_LIN_SRGB, multiply(LMS_TO_XYZ, lms)));
}

function hslToSrgb(hue, sat, light) {
  const s = Math.max(0, sat) / 100;
  const l = clamp(light, 0, 100) / 100;
  const h = ((hue % 360) + 360) % 360;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// --- 公開 API --------------------------------------------------------------------

/**
 * 色の文字列を、ガンマ補正済み sRGB（0〜1。色域外ならはみ出す）と alpha に変換する。
 * @param {string} input
 * @returns {{ input: string, rgb: number[], alpha: number, outOfGamut: boolean }}
 */
export function parseColor(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new ColorInputError(`色が空。読める形式: ${ACCEPTED}`);
  }
  const text = input.trim().toLowerCase();

  if (text.includes("var(")) {
    throw new ColorInputError(
      `「${input}」: var() は解決できない。トークンの値（oklch(...) など）を展開して渡す`,
    );
  }

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
    const bytes = digits.match(/../g).map((pair) => parseInt(pair, 16) / 255);
    return finish(input, bytes.slice(0, 3), bytes[3] ?? 1);
  }

  const fn = /^(rgba?|hsla?|oklch)\((.*)\)$/.exec(text);
  if (!fn) {
    throw new ColorInputError(`「${input}」を色として読めない。読める形式: ${ACCEPTED}`);
  }
  const name = fn[1].replace(/a$/, "") === "hsl" ? "hsl" : fn[1] === "oklch" ? "oklch" : "rgb";
  const { channels, alpha } = splitArgs(name, fn[2], input);
  const a = alphaOf(alpha, input);

  if (name === "rgb") {
    return finish(input, channels.map((c) => rgbChannel(c, input)), a);
  }
  if (name === "hsl") {
    const [h, s, l] = channels;
    return finish(input, hslToSrgb(hueOf(h, input), hslPercent(s, input), hslPercent(l, input)), a);
  }
  // oklch: L は 0〜1 か %（100% = 1）、C は数値か %（100% = 0.4）
  const lt = token(channels[0], input);
  const ct = token(channels[1], input);
  for (const t of [lt, ct]) {
    if (!t.none && t.unit !== "" && t.unit !== "%") {
      throw new ColorInputError(`「${input}」の L と C に単位「${t.unit}」は使えない`);
    }
  }
  const L = lt.none ? 0 : clamp(lt.unit === "%" ? lt.value / 100 : lt.value, 0, 1);
  const C = ct.none ? 0 : Math.max(0, ct.unit === "%" ? (ct.value / 100) * 0.4 : ct.value);
  return finish(input, oklchToSrgb(L, C, hueOf(channels[2], input)), a);
}

function finish(input, rgb, alpha) {
  const outOfGamut = rgb.some((value) => value < -GAMUT_EPSILON || value > 1 + GAMUT_EPSILON);
  return { input, rgb, alpha, outOfGamut };
}

/** 描画される値に合わせて 0〜1 にクリップする。 */
function clip(rgb) {
  return rgb.map((value) => clamp(value, 0, 1));
}

/** 前景（alpha 付き）を不透明な背景に重ねる。ガンマ補正済みの値で合成する。 */
function over(top, bottom) {
  const t = clip(top.rgb);
  const b = clip(bottom.rgb);
  return t.map((value, i) => value * top.alpha + b[i] * (1 - top.alpha));
}

/** WCAG 2.2 の相対輝度。入力はガンマ補正済み sRGB（範囲外はクリップ）。 */
export function relativeLuminance(rgb) {
  const [r, g, b] = clip(rgb).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function gamutWarning(color, label) {
  return `${label} ${color.input} は sRGB の色域外。各チャンネルを 0〜1 にクリップして計算した。描画はブラウザとディスプレイで変わるので、C（彩度）を下げて色域内に収める`;
}

/**
 * 2色のコントラスト比を返す。
 * @param {string} fg 前景色（alpha 可）
 * @param {string} bg 背景色（alpha を持つなら under が必要）
 * @param {{ under?: string }} [options]
 * @returns {{ ratio: number, warnings: string[] }}
 */
export function contrastRatio(fg, bg, options = {}) {
  const warnings = [];
  const front = parseColor(fg);
  let back = parseColor(bg);
  if (front.outOfGamut) warnings.push(gamutWarning(front, "前景"));
  if (back.outOfGamut) warnings.push(gamutWarning(back, "背景"));

  if (back.alpha < 1) {
    if (options.under === undefined) {
      throw new ColorInputError(
        `背景 ${bg} が半透明（alpha ${back.alpha}）。その下にある不透明な面の色を under で渡す`,
      );
    }
    const base = parseColor(options.under);
    if (base.alpha < 1) throw new ColorInputError(`under ${options.under} も半透明。不透明な色を渡す`);
    if (base.outOfGamut) warnings.push(gamutWarning(base, "下地"));
    back = { input: bg, rgb: over(back, base), alpha: 1, outOfGamut: false };
  }

  const shown = front.alpha < 1 ? over(front, back) : clip(front.rgb);
  const a = relativeLuminance(shown);
  const b = relativeLuminance(back.rgb);
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return { ratio: (light + 0.05) / (dark + 0.05), warnings };
}

/**
 * 1ペアを判定する。比は丸めずに閾値と比べる（WCAG は丸めを認めない）。
 * @param {{ name?: string, fg: string, bg: string, role?: string, under?: string }} pair
 */
export function evaluatePair(pair) {
  if (pair === null || typeof pair !== "object") throw new ColorInputError("ペアはオブジェクトで渡す");
  const role = pair.role ?? "text";
  if (!Object.hasOwn(THRESHOLDS, role)) {
    throw new ColorInputError(`role「${role}」は使えない。text / large / ui のどれか`);
  }
  if (typeof pair.fg !== "string" || typeof pair.bg !== "string") {
    throw new ColorInputError(`fg と bg を文字列で渡す: ${JSON.stringify(pair)}`);
  }
  const threshold = THRESHOLDS[role];
  const { ratio, warnings } = contrastRatio(pair.fg, pair.bg, { under: pair.under });
  return {
    name: pair.name ?? "",
    fg: pair.fg,
    bg: pair.bg,
    ...(pair.under === undefined ? {} : { under: pair.under }),
    role,
    threshold,
    ratio,
    pass: ratio >= threshold,
    warnings,
  };
}

/** 小数2桁で切り捨てて表示する（4.499 を 4.50 と見せない）。 */
export function formatRatio(ratio) {
  return (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2);
}

// --- CLI -------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const options = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--role" || arg === "--under") {
      const value = argv[i + 1];
      if (value === undefined) throw new ColorInputError(`${arg} の値がない`);
      options[arg.slice(2)] = value;
      i += 1;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--")) throw new ColorInputError(`未知のオプション ${arg}`);
    else positional.push(arg);
  }
  return { positional, options };
}

const USAGE = `使い方:
  node contrast.mjs <前景色> <背景色> [--role text|large|ui] [--under <下地色>] [--json]
  node contrast.mjs <pairs.json> [--json]
読める色: ${ACCEPTED}
終了コード: 0 = 全ペア合格 / 1 = 不合格あり / 2 = 入力の誤り`;

function loadPairs(path) {
  let text;
  try {
    text = readFileSync(resolve(path), "utf8");
  } catch (error) {
    throw new ColorInputError(`ペア一覧 ${path} を読めない: ${error.message}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ColorInputError(`ペア一覧 ${path} が JSON として読めない: ${error.message}`);
  }
  const pairs = Array.isArray(data) ? data : data?.pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new ColorInputError(`ペア一覧 ${path} は、空でない配列か { "pairs": [...] } にする`);
  }
  return pairs;
}

/**
 * CLI 本体。テストしやすいよう、出力と終了コードを返す。
 * @param {string[]} argv
 * @returns {{ code: number, stdout: string, stderr: string }}
 */
export function run(argv) {
  try {
    const { positional, options } = parseArgs(argv);
    if (options.help) return { code: 0, stdout: `${USAGE}\n`, stderr: "" };
    let pairs;
    if (positional.length === 1) {
      if (options.role !== undefined || options.under !== undefined) {
        throw new ColorInputError("--role と --under は2色を直接渡すときだけ使う。ペア一覧では各要素に書く");
      }
      pairs = loadPairs(positional[0]);
    } else if (positional.length === 2) {
      pairs = [{ fg: positional[0], bg: positional[1], role: options.role, under: options.under }];
    } else {
      throw new ColorInputError("色を2つ、またはペア一覧の JSON を1つ渡す");
    }

    const results = pairs.map((pair, index) => {
      try {
        return evaluatePair(pair);
      } catch (error) {
        if (error instanceof ColorInputError) {
          throw new ColorInputError(`ペア ${index + 1}${pair?.name ? `（${pair.name}）` : ""}: ${error.message}`);
        }
        throw error;
      }
    });
    const failed = results.filter((result) => !result.pass).length;
    const code = failed > 0 ? 1 : 0;

    if (options.json) {
      return {
        code,
        stdout: `${JSON.stringify({ standard: "WCAG 2.2", failed, total: results.length, results }, null, 2)}\n`,
        stderr: "",
      };
    }

    const lines = [];
    for (const result of results) {
      const verdict = result.pass ? "PASS" : "FAIL";
      const op = result.pass ? ">=" : "< ";
      const label = result.name ? `${result.name}: ` : "";
      const under = result.under ? `（下地 ${result.under}）` : "";
      lines.push(
        `${verdict}  ${formatRatio(result.ratio).padStart(5)} ${op} ${String(result.threshold).padEnd(3)}  ${result.role.padEnd(5)}  ${label}${result.fg} on ${result.bg}${under}`,
      );
      for (const warning of result.warnings) {
        lines.push(`WARN  ${label}${warning}`);
      }
    }
    const warned = results.filter((result) => result.warnings.length > 0).length;
    lines.push(
      `---\n${results.length} 件中 ${failed} 件が不合格、${warned} 件に警告。WCAG 2.2 の相対輝度とコントラスト比で計算（比は切り捨て表示、判定は丸める前の値）`,
    );
    return { code, stdout: `${lines.join("\n")}\n`, stderr: "" };
  } catch (error) {
    if (error instanceof ColorInputError) {
      return { code: 2, stdout: "", stderr: `エラー: ${error.message}\n\n${USAGE}\n` };
    }
    throw error;
  }
}

/** シンボリックリンク経由で起動されても、直接実行かどうかを正しく判定する。 */
function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const { code, stdout, stderr } = run(process.argv.slice(2));
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}
