#!/usr/bin/env node
// @ts-check
/**
 * check-plugin-agents.mjs
 *
 * マーケットプレイス掲載プラグインの agent 定義（agents/*.md）と、skill・workflow・agent の
 * 本文にある agent / skill 参照を静的に検証する。Node 標準モジュールのみで実装する（ESM .mjs）。
 *
 * 実行:
 *   node scripts/check-plugin-agents.mjs
 *     .claude-plugin/marketplace.json の全プラグインを検査する。
 *   node scripts/check-plugin-agents.mjs <plugin-dir>... [--pins <file>]
 *     指定したディレクトリをそれぞれ1プラグインとして検査する（負例 fixture 用）。
 *     プラグイン名は <plugin-dir>/.claude-plugin/plugin.json の name、無ければディレクトリ名。
 *     参照先の解決には marketplace のプラグインも使う。
 *
 * 終了コード: 0 = 違反なし、1 = 違反あり、2 = 引数や入力ファイルを読み込めない。
 *
 * 違反には `[code]` を付ける。CI の負例テストは code で「どの規則が発火したか」を確かめる。
 *
 * agent frontmatter の規則:
 *   frontmatter-missing   先頭の --- ブロックが無い
 *   name-missing          name が無い
 *   name-mismatch         name がファイル名（拡張子なし）と一致しない
 *   description-missing   description が無い、または空
 *   description-proactive description に "proactive" を含む（Agent ツールが頼まれなくても使う合図になる）
 *   effort-invalid        effort が low / medium / high / xhigh / max 以外
 *   effort-pin-mismatch   allowlist で固定した agent の effort が固定値と一致しない
 *   effort-pin-missing    allowlist で固定した agent に effort が無い
 *   effort-unpinned       allowlist に無い agent が effort を持つ（固定は理由付きの allowlist に限る）
 *   model-invalid         model が inherit / opus / sonnet / haiku / fable でも claude- で始まる完全 ID でもない
 *   haiku-effort          Haiku 4.5（model: haiku）に effort がある（effort 非対応）
 *   ignored-key           プラグイン agent では無視されるキー（hooks / mcpServers / permissionMode）がある
 *   when-to-use           whenToUse / when_to_use がある（description に統合する）
 *
 * 参照の規則（skills/**\/SKILL.md、workflows/**\/SKILL.md、agents/*.md が対象。README・CHANGELOG・docs は対象外）:
 *   ref-missing           参照先のプラグインに該当する agent / skill / workflow が無い
 *   拾う表記:
 *     Agent(<plugin>:<name>)                  → agent
 *     Task(subagent_type:<plugin>:<name>)     → agent（空白・引用符あり可）
 *     subagent_type: "<plugin>:<name>"        → agent
 *     `<plugin>:<name>`                       → agent / skill / workflow（<plugin> が既知のときだけ）
 *     /<plugin>:<name>                        → skill / workflow（スラッシュ起動。<plugin> が既知のときだけ）
 *     Skill(<plugin>:<name>)                  → skill / workflow
 *     agent frontmatter の skills: の項目     → skill / workflow
 *   <plugin> が marketplace にも検査対象にも無い参照は、外部プラグインとみなして検査しない。
 *
 * allowlist（scripts/agent-effort-pins.json）の規則:
 *   pins-invalid          スキーマ違反（schemaVersion / effort / reason）
 *   pin-stale             固定した agent が存在しない（検査対象のプラグインに限る）
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** リポジトリルート（scripts/ の親）。 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** マーケットプレイス定義のリポジトリルートからの相対パス。 */
const MARKETPLACE_REL = join(".claude-plugin", "marketplace.json");

/** 固定 effort の allowlist の既定パス。 */
const DEFAULT_PINS_PATH = join(REPO_ROOT, "scripts", "agent-effort-pins.json");

/** allowlist の schemaVersion。 */
const PINS_SCHEMA_VERSION = 1;

/** Claude Code が受け付ける effort の値。 */
const EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

/** agent frontmatter の model に許す alias。これ以外は claude- で始まる完全 ID に限る。 */
const MODEL_ALIASES = new Set(["inherit", "opus", "sonnet", "haiku", "fable"]);

/** 完全なモデル ID の接頭辞。 */
const FULL_MODEL_ID_PREFIX = "claude-";

/** effort に対応しないモデル（alias と完全 ID の接頭辞）。Haiku 4.5 は effort 非対応。 */
const EFFORT_UNSUPPORTED_MODEL_ALIASES = new Set(["haiku"]);
const EFFORT_UNSUPPORTED_MODEL_ID_PREFIXES = ["claude-haiku-4-5"];

/** プラグイン agent では無視されるキー。 */
const IGNORED_PLUGIN_AGENT_KEYS = ["hooks", "mcpServers", "permissionMode"];

/** 旧形式のトリガー記述キー。 */
const WHEN_TO_USE_KEYS = ["whenToUse", "when_to_use"];

/** description に含めてはならない語（大文字小文字は問わない）。 */
const PROACTIVE_PATTERN = /proactive/i;

/** plugin 名・component 名の形式。 */
const COMPONENT_PATTERN = "[a-z0-9][a-z0-9-]*";

/** allowlist のキー形式（<plugin>:<agent>）。 */
const PIN_KEY_PATTERN = new RegExp(`^${COMPONENT_PATTERN}:${COMPONENT_PATTERN}$`);

/** 参照を拾う表記。1行の中で完結する表記だけを扱う。 */
const REFERENCE_PATTERNS = [
  {
    label: "Agent()",
    kinds: ["agent"],
    regex: new RegExp(`\\bAgent\\(\\s*["']?(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})["']?\\s*\\)`, "g"),
  },
  {
    label: "Task(subagent_type)",
    kinds: ["agent"],
    regex: new RegExp(
      `\\bTask\\(\\s*subagent_type\\s*[:=]\\s*["']?(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})["']?\\s*\\)`,
      "g",
    ),
  },
  {
    label: "subagent_type",
    kinds: ["agent"],
    regex: new RegExp(`\\bsubagent_type["']?\\s*[:=]\\s*["'](${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})["']`, "g"),
  },
  {
    label: "backtick",
    kinds: ["agent", "skill", "workflow"],
    regex: new RegExp(`\`(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})\``, "g"),
  },
  {
    label: "slash-command",
    kinds: ["skill", "workflow"],
    regex: new RegExp(`(?<![A-Za-z0-9_./-])/(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})(?![A-Za-z0-9_-])`, "g"),
  },
  {
    label: "Skill()",
    kinds: ["skill", "workflow"],
    regex: new RegExp(`\\bSkill\\(\\s*["']?(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})["']?\\s*\\)`, "g"),
  },
];

/** 終了コード。 */
const EXIT_OK = 0;
const EXIT_VIOLATION = 1;
const EXIT_USAGE = 2;

/** 引数や入力ファイルの読み込み失敗（違反ではない）。 */
class UsageError extends Error {}

/**
 * @typedef {{ value: string, items: string[] | null, line: number }} FrontmatterField
 * @typedef {{ name: string, root: string }} PluginSource
 * @typedef {{ agents: Set<string>, skills: Set<string>, workflows: Set<string> }} PluginIndex
 * @typedef {{ effort: string, reason: string }} Pin
 */

/**
 * YAML のスカラー値1つを、引用符と行末コメントを外した文字列にする。
 * @param {string} raw `key:` の後ろの生の値。
 * @returns {string}
 */
function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    const end = value.indexOf('"', 1);
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }
  if (value.startsWith("'")) {
    const match = value.match(/^'((?:[^']|'')*)'/);
    return match ? match[1].replace(/''/g, "'") : value.slice(1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

/**
 * frontmatter をトップレベルキーごとに読む。YAML パーサは使わない（外部依存禁止）。
 * block scalar（| と >）と、ネストした一覧（- item と [a, b]）に対応する。
 * @param {string} content ファイル全文。
 * @returns {Map<string, FrontmatterField> | null} frontmatter が無ければ null。
 */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== "---") {
    return null;
  }
  let closing = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trimEnd() === "---") {
      closing = index;
      break;
    }
  }
  if (closing === -1) {
    return null;
  }

  /** @type {Map<string, FrontmatterField>} */
  const fields = new Map();
  let index = 1;
  while (index < closing) {
    const line = lines[index];
    const keyMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/);
    if (!keyMatch) {
      index += 1;
      continue;
    }
    const key = keyMatch[1];
    const rest = keyMatch[2].trim();
    const lineNumber = index + 1;

    // 続く字下げ行（と空行）をまとめて取る。
    let next = index + 1;
    /** @type {string[]} */
    const continuation = [];
    while (next < closing && (lines[next].trim() === "" || /^\s/.test(lines[next]))) {
      continuation.push(lines[next]);
      next += 1;
    }

    if (/^[|>][+-]?\d*\s*(#.*)?$/.test(rest)) {
      const texts = continuation.map((text) => text.trim());
      const joined = rest.startsWith(">") ? texts.filter(Boolean).join(" ") : texts.join("\n");
      fields.set(key, { value: joined.trim(), items: null, line: lineNumber });
    } else if (rest.startsWith("[")) {
      const inner = rest.replace(/^\[/, "").replace(/\].*$/, "");
      const items = inner
        .split(",")
        .map((item) => parseScalar(item))
        .filter((item) => item.length > 0);
      fields.set(key, { value: rest, items, line: lineNumber });
    } else if (rest === "" || rest.startsWith("#")) {
      const items = continuation
        .map((text) => text.match(/^\s+-\s+(.*)$/))
        .filter((match) => match !== null)
        .map((match) => parseScalar(/** @type {RegExpMatchArray} */ (match)[1]));
      fields.set(key, { value: "", items: items.length > 0 ? items : null, line: lineNumber });
    } else {
      fields.set(key, { value: parseScalar(rest), items: null, line: lineNumber });
    }
    index = next;
  }
  return fields;
}

/**
 * JSON ファイルを読む。読めなければ UsageError。
 * @param {string} path 絶対パス。
 * @param {string} label エラー表示用の名前。
 * @returns {unknown}
 */
function readJson(path, label) {
  if (!existsSync(path)) {
    throw new UsageError(`${label} が見つからない: ${displayPath(path)}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new UsageError(`${label} の JSON を解析できない: ${displayPath(path)} (${reason})`);
  }
}

/**
 * 表示用のパス。リポジトリ内ならルートからの相対パスにする。
 * @param {string} path 絶対パス。
 * @returns {string}
 */
function displayPath(path) {
  const rel = relative(REPO_ROOT, path);
  return rel.startsWith("..") ? path : rel;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * marketplace.json からプラグイン名とルートを読む。
 * @param {string[]} violations 違反の出力先。
 * @returns {PluginSource[]}
 */
function loadMarketplacePlugins(violations) {
  const data = readJson(join(REPO_ROOT, MARKETPLACE_REL), MARKETPLACE_REL);
  if (!isRecord(data) || !Array.isArray(data.plugins)) {
    throw new UsageError(`${MARKETPLACE_REL}: plugins が配列でない`);
  }
  /** @type {PluginSource[]} */
  const plugins = [];
  for (const [index, plugin] of data.plugins.entries()) {
    if (!isRecord(plugin) || !isNonEmptyString(plugin.name) || !isNonEmptyString(plugin.source)) {
      violations.push(`${MARKETPLACE_REL}: plugins[${index}] に name と source（文字列）が必要`);
      continue;
    }
    plugins.push({ name: plugin.name, root: resolve(REPO_ROOT, plugin.source) });
  }
  return plugins;
}

/**
 * 引数で渡されたディレクトリを1プラグインとして読む。
 * @param {string} dir cwd からのパス。
 * @returns {PluginSource}
 */
function loadPluginDir(dir) {
  const root = resolve(process.cwd(), dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new UsageError(`プラグインのディレクトリが見つからない: ${dir}`);
  }
  const manifestPath = join(root, ".claude-plugin", "plugin.json");
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath, "plugin.json");
    if (isRecord(manifest) && isNonEmptyString(manifest.name)) {
      return { name: manifest.name, root };
    }
  }
  return { name: basename(root), root };
}

/**
 * allowlist を読み、スキーマ違反を violations に積む。
 * @param {string} path 絶対パス。
 * @param {string[]} violations
 * @returns {Map<string, Pin>}
 */
function loadPins(path, violations) {
  const label = displayPath(path);
  const data = readJson(path, "effort の allowlist");
  /** @type {Map<string, Pin>} */
  const pins = new Map();
  if (!isRecord(data)) {
    violations.push(`${label}: [pins-invalid] トップレベルは object でなければならない`);
    return pins;
  }
  if (data.schemaVersion !== PINS_SCHEMA_VERSION) {
    violations.push(`${label}: [pins-invalid] schemaVersion は ${PINS_SCHEMA_VERSION} でなければならない`);
  }
  if (!isRecord(data.pins)) {
    violations.push(`${label}: [pins-invalid] pins は object でなければならない`);
    return pins;
  }
  for (const [key, pin] of Object.entries(data.pins)) {
    if (!PIN_KEY_PATTERN.test(key)) {
      violations.push(`${label}: [pins-invalid] キー "${key}" は <plugin>:<agent> の形式でなければならない`);
      continue;
    }
    if (!isRecord(pin) || typeof pin.effort !== "string" || !EFFORT_LEVELS.has(pin.effort)) {
      violations.push(`${label}: [pins-invalid] ${key} の effort は ${[...EFFORT_LEVELS].join(" / ")} のいずれか`);
      continue;
    }
    if (!isNonEmptyString(pin.reason)) {
      violations.push(`${label}: [pins-invalid] ${key} に固定の理由（reason）が必要`);
      continue;
    }
    pins.set(key, { effort: pin.effort, reason: pin.reason });
  }
  return pins;
}

/**
 * 直下のエントリ名を返す。ディレクトリが無ければ空。
 * @param {string} dir
 * @returns {import("node:fs").Dirent[]}
 */
function listDir(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * dir 配下の SKILL.md を再帰的に集める。
 * @param {string} dir
 * @returns {string[]}
 */
function findSkillFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of listDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findSkillFiles(path));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      found.push(path);
    }
  }
  return found;
}

/**
 * agents/ 直下の .md を集める。
 * @param {string} root プラグインのルート。
 * @returns {string[]}
 */
function findAgentFiles(root) {
  const dir = join(root, "agents");
  return listDir(dir)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(dir, entry.name));
}

/**
 * agent ファイルの実行時の名前（frontmatter の name、無ければファイル名）。
 * @param {string} path
 * @returns {string}
 */
function agentNameOf(path) {
  const fields = parseFrontmatter(readFileSync(path, "utf8"));
  const name = fields?.get("name")?.value;
  return isNonEmptyString(name) ? name : basename(path, ".md");
}

/**
 * プラグインの agent / skill / workflow の名前を集める。
 * @param {string} root
 * @returns {PluginIndex}
 */
function indexPlugin(root) {
  /** @param {string} subdir */
  const skillNames = (subdir) =>
    new Set(
      listDir(join(root, subdir))
        .filter((entry) => entry.isDirectory() && existsSync(join(root, subdir, entry.name, "SKILL.md")))
        .map((entry) => entry.name),
    );
  return {
    agents: new Set(findAgentFiles(root).map((path) => agentNameOf(path))),
    skills: skillNames("skills"),
    workflows: skillNames("workflows"),
  };
}

/**
 * agent 1体の frontmatter を検査する。
 * @param {string} pluginName
 * @param {string} path
 * @param {Map<string, Pin>} pins
 * @param {string} pinsLabel allowlist の表示用パス。
 * @param {string[]} violations
 */
function validateAgent(pluginName, path, pins, pinsLabel, violations) {
  const label = displayPath(path);
  /** @param {string} code @param {string} message */
  const report = (code, message) => violations.push(`${label}: [${code}] ${message}`);

  const fields = parseFrontmatter(readFileSync(path, "utf8"));
  if (fields === null) {
    report("frontmatter-missing", "先頭の --- ブロック（frontmatter）が無い");
    return;
  }

  const stem = basename(path, ".md");
  const name = fields.get("name")?.value;
  if (!isNonEmptyString(name)) {
    report("name-missing", "name が無い");
  } else if (name !== stem) {
    report("name-mismatch", `name "${name}" がファイル名 "${stem}" と一致しない`);
  }

  const description = fields.get("description")?.value;
  if (!isNonEmptyString(description)) {
    report("description-missing", "description が無いか空");
  } else if (PROACTIVE_PATTERN.test(description)) {
    report(
      "description-proactive",
      'description に "proactive" を含めない（Agent ツールが頼まれなくても使う合図になる）。使う条件を具体的に書く',
    );
  }

  const effortField = fields.get("effort");
  const effort = effortField?.value;
  if (effortField !== undefined && (effort === undefined || !EFFORT_LEVELS.has(effort))) {
    report("effort-invalid", `effort "${effort ?? ""}" は ${[...EFFORT_LEVELS].join(" / ")} のいずれかでなければならない`);
  }

  const pinKey = `${pluginName}:${isNonEmptyString(name) ? name : stem}`;
  const pin = pins.get(pinKey);
  if (pin !== undefined) {
    if (effortField === undefined) {
      report("effort-pin-missing", `allowlist で ${pin.effort} に固定しているが effort が無い`);
    } else if (effort !== pin.effort) {
      report("effort-pin-mismatch", `effort "${effort}" が allowlist の固定値 "${pin.effort}" と一致しない`);
    }
  } else if (effortField !== undefined) {
    report(
      "effort-unpinned",
      `allowlist（${pinsLabel}）に無い agent は effort を持たない。固定するなら理由付きで allowlist に追加する`,
    );
  }

  const modelField = fields.get("model");
  const model = modelField?.value ?? "";
  if (modelField !== undefined && !MODEL_ALIASES.has(model) && !model.startsWith(FULL_MODEL_ID_PREFIX)) {
    report(
      "model-invalid",
      `model "${model}" は ${[...MODEL_ALIASES].join(" / ")} か、${FULL_MODEL_ID_PREFIX} で始まる完全 ID でなければならない`,
    );
  }
  const effortUnsupported =
    EFFORT_UNSUPPORTED_MODEL_ALIASES.has(model) ||
    EFFORT_UNSUPPORTED_MODEL_ID_PREFIXES.some((prefix) => model.startsWith(prefix));
  if (modelField !== undefined && effortUnsupported && effortField !== undefined) {
    report("haiku-effort", `model "${model}"（Haiku 4.5）は effort に対応しないので effort を置かない`);
  }

  for (const key of IGNORED_PLUGIN_AGENT_KEYS) {
    if (fields.has(key)) {
      report("ignored-key", `${key} はプラグイン agent では無視される`);
    }
  }
  for (const key of WHEN_TO_USE_KEYS) {
    if (fields.has(key)) {
      report("when-to-use", `${key} は使わない。使う条件は description に書く`);
    }
  }
}

/**
 * 1ファイルの参照を拾う。
 * @param {string} path
 * @param {boolean} isAgentFile agents/*.md なら true（frontmatter の skills: も拾う）。
 * @returns {{ line: number, plugin: string, name: string, kinds: string[], label: string }[]}
 */
function extractReferences(path, isAgentFile) {
  const content = readFileSync(path, "utf8");
  /** @type {Map<string, { line: number, plugin: string, name: string, kinds: string[], label: string }>} */
  const references = new Map();
  /** @param {number} line @param {string} plugin @param {string} name @param {string[]} kinds @param {string} label */
  const add = (line, plugin, name, kinds, label) => {
    const key = `${line}:${plugin}:${name}:${kinds.join(",")}`;
    if (!references.has(key)) {
      references.set(key, { line, plugin, name, kinds, label });
    }
  };

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const pattern of REFERENCE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      for (const match of line.matchAll(pattern.regex)) {
        add(index + 1, match[1], match[2], pattern.kinds, pattern.label);
      }
    }
  }

  if (isAgentFile) {
    const skills = parseFrontmatter(content)?.get("skills");
    for (const item of skills?.items ?? []) {
      const match = item.match(new RegExp(`^(${COMPONENT_PATTERN}):(${COMPONENT_PATTERN})$`));
      if (match) {
        add(skills?.line ?? 1, match[1], match[2], ["skill", "workflow"], "frontmatter skills");
      }
    }
  }
  return [...references.values()];
}

/**
 * 参照先が存在するか確かめる。
 * @param {PluginSource[]} scanned 参照元として走査するプラグイン。
 * @param {Map<string, PluginIndex>} known 参照先として解決できるプラグイン。
 * @param {string[]} violations
 * @returns {number} 検査した参照の数。
 */
function validateReferences(scanned, known, violations) {
  let checked = 0;
  for (const plugin of scanned) {
    const files = [
      ...findSkillFiles(join(plugin.root, "skills")).map((path) => ({ path, isAgentFile: false })),
      ...findSkillFiles(join(plugin.root, "workflows")).map((path) => ({ path, isAgentFile: false })),
      ...findAgentFiles(plugin.root).map((path) => ({ path, isAgentFile: true })),
    ];
    for (const { path, isAgentFile } of files) {
      for (const reference of extractReferences(path, isAgentFile)) {
        const target = known.get(reference.plugin);
        if (target === undefined) {
          continue;
        }
        checked += 1;
        const exists = reference.kinds.some((kind) => {
          if (kind === "agent") return target.agents.has(reference.name);
          if (kind === "skill") return target.skills.has(reference.name);
          return target.workflows.has(reference.name);
        });
        if (!exists) {
          violations.push(
            `${displayPath(path)}:${reference.line}: [ref-missing] ${reference.label} の参照先 ${reference.plugin}:${reference.name}（${reference.kinds.join(" / ")}）が存在しない`,
          );
        }
      }
    }
  }
  return checked;
}

/**
 * @param {string[]} argv
 * @returns {{ pluginDirs: string[], pinsPath: string }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const pluginDirs = [];
  let pinsPath = DEFAULT_PINS_PATH;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pins") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError("--pins には allowlist のパスが必要");
      }
      pinsPath = resolve(process.cwd(), value);
      index += 1;
    } else if (arg.startsWith("--pins=")) {
      pinsPath = resolve(process.cwd(), arg.slice("--pins=".length));
    } else if (arg.startsWith("-")) {
      throw new UsageError(`未知のオプション: ${arg}（使い方: check-plugin-agents.mjs [<plugin-dir>...] [--pins <file>]）`);
    } else {
      pluginDirs.push(arg);
    }
  }
  return { pluginDirs, pinsPath };
}

function main() {
  /** @type {string[]} */
  const violations = [];
  const { pluginDirs, pinsPath } = parseArgs(process.argv.slice(2));

  const marketplace = loadMarketplacePlugins(violations);
  const fixtureMode = pluginDirs.length > 0;
  const scanned = fixtureMode ? pluginDirs.map((dir) => loadPluginDir(dir)) : marketplace;

  /** @type {Map<string, PluginIndex>} */
  const known = new Map();
  for (const plugin of [...marketplace, ...scanned]) {
    known.set(plugin.name, indexPlugin(plugin.root));
  }

  const pins = loadPins(pinsPath, violations);

  let agentCount = 0;
  for (const plugin of scanned) {
    for (const path of findAgentFiles(plugin.root)) {
      agentCount += 1;
      validateAgent(plugin.name, path, pins, displayPath(pinsPath), violations);
    }
  }

  // 固定した agent が消えていないか。fixture では走査したプラグインの固定だけを見る。
  const scannedNames = new Set(scanned.map((plugin) => plugin.name));
  for (const key of pins.keys()) {
    const [pluginName, agentName] = key.split(":");
    if (fixtureMode && !scannedNames.has(pluginName)) {
      continue;
    }
    if (!known.get(pluginName)?.agents.has(agentName)) {
      violations.push(`${displayPath(pinsPath)}: [pin-stale] ${key} を固定しているが、その agent が存在しない`);
    }
  }

  const referenceCount = validateReferences(scanned, known, violations);

  if (violations.length > 0) {
    console.error("plugin agent check failed:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(EXIT_VIOLATION);
  }
  console.log(`plugin agent check passed (${agentCount} agents, ${referenceCount} references)`);
  process.exit(EXIT_OK);
}

try {
  main();
} catch (error) {
  // 想定外の例外も exit 2 にし、違反（exit 1）と区別する。
  const message = error instanceof UsageError ? error.message : error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`plugin agent check error: ${message}`);
  process.exit(EXIT_USAGE);
}
