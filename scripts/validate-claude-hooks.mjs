#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const defaultHooks = resolve(root, "dev-core/hooks/hooks.json");
const hooksPath = process.argv[2]
  ? isAbsolute(process.argv[2])
    ? process.argv[2]
    : resolve(process.cwd(), process.argv[2])
  : defaultHooks;
const allowedTypes = new Map([
  ["SessionStart", new Set(["command", "mcp_tool"])],
  ["PreCompact", new Set(["command", "http", "mcp_tool"])],
  ["PreToolUse", new Set(["command", "http", "mcp_tool", "prompt", "agent"])],
  ["PostToolUse", new Set(["command", "http", "mcp_tool", "prompt", "agent"])],
  ["Stop", new Set(["command", "http", "mcp_tool", "prompt", "agent"])],
]);
const errors = [];

let manifest;
try {
  manifest = JSON.parse(readFileSync(hooksPath, "utf8"));
} catch (error) {
  console.error(`${hooksPath}: hooks manifestを読み込めない (${error.message})`);
  process.exit(1);
}

if (!manifest.hooks || typeof manifest.hooks !== "object" || Array.isArray(manifest.hooks)) {
  errors.push("hooks はeventをkeyに持つobjectでなければならない");
} else {
  for (const [event, entries] of Object.entries(manifest.hooks)) {
    const allowed = allowedTypes.get(event);
    if (!allowed) {
      errors.push(`${event}: validator未対応event。公式hook仕様を確認してallowlistを更新する`);
      continue;
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`${event}: 非空entry配列が必要`);
      continue;
    }
    for (const [entryIndex, entry] of entries.entries()) {
      if (!Array.isArray(entry?.hooks) || entry.hooks.length === 0) {
        errors.push(`${event}[${entryIndex}].hooks: 非空配列が必要`);
        continue;
      }
      for (const [handlerIndex, handler] of entry.hooks.entries()) {
        const label = `${event}[${entryIndex}].hooks[${handlerIndex}]`;
        if (!allowed.has(handler?.type)) {
          errors.push(`${label}: type ${JSON.stringify(handler?.type)} は ${event} で未サポート`);
          continue;
        }
        if (handler.type === "command") {
          if (typeof handler.command !== "string" || handler.command.trim().length === 0) {
            errors.push(`${label}: command handlerには非空commandが必要`);
            continue;
          }
          const match = handler.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([^"']+)/);
          if (match && !existsSync(resolve(root, "dev-core/scripts", match[1]))) {
            errors.push(`${label}: command scriptが存在しない: dev-core/scripts/${match[1]}`);
          }
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Claude hook validation passed: ${hooksPath}`);
