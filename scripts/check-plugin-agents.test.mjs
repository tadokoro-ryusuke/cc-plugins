// check-plugin-agents.mjs のテスト。node --test scripts/check-plugin-agents.test.mjs
// CI の負例ループは「code が出たか」だけを見る。ここでは、発火しないはずの組み合わせと、
// キーごと・モデルごとの判定を固定する。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const checker = join(scriptsDir, "check-plugin-agents.mjs");
const fixture = join(scriptsDir, "fixtures", "invalid-plugin-agents");
const pluginName = "probe-plugin";

/**
 * 一時プラグインを作る。agents は { "<agents/ からの相対パス>": "<ファイル全文>" }。
 * pins は { "<agent 名>": "<effort>" }（キーには plugin 名を付けて書き込む）。
 */
function makePlugin(t, agents, pins = {}) {
  const root = mkdtempSync(join(tmpdir(), "check-plugin-agents-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(join(root, ".claude-plugin", "plugin.json"), JSON.stringify({ name: pluginName }));
  for (const [rel, content] of Object.entries(agents)) {
    const path = join(root, "agents", rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const pinEntries = Object.fromEntries(
    Object.entries(pins).map(([agent, effort]) => [`${pluginName}:${agent}`, { effort, reason: "test" }]),
  );
  writeFileSync(join(root, "pins.json"), JSON.stringify({ schemaVersion: 1, description: "test", pins: pinEntries }));
  return root;
}

function agentFile(name, model, effort) {
  const lines = ["---", `name: ${name}`, "description: テスト用の agent。", `model: ${model}`];
  if (effort !== undefined) lines.push(`effort: ${effort}`);
  lines.push("tools: Read", "---", "", "body", "");
  return lines.join("\n");
}

function check(root, pinsPath = join(root, "pins.json")) {
  const result = spawnSync(process.execPath, [checker, root, "--pins", pinsPath], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** model ごとに effort: low で固定した agent を1体ずつ置く。 */
function pluginWithModels(t, models) {
  const agents = {};
  const pins = {};
  models.forEach((model, index) => {
    const name = `agent-${index}`;
    agents[`${name}.md`] = agentFile(name, model, "low");
    pins[name] = "low";
  });
  return makePlugin(t, agents, pins);
}

test("Claude Code の effort 表に無い旧モデルの完全 ID に effort を置くと effort-unsupported-model になる", (t) => {
  const models = [
    "claude-haiku-4-5",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5[1m]",
    "claude-opus-4-5",
    "claude-opus-4-5-20251101",
    "claude-opus-4-1",
    "claude-opus-4-1-20250805",
    "claude-opus-4-0",
    "claude-sonnet-4-0",
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-haiku-20241022",
  ];
  const root = pluginWithModels(t, models);
  const { status, output } = check(root);
  assert.equal(status, 1, output);
  models.forEach((model, index) => {
    assert.match(
      output,
      new RegExp(`agent-${index}\\.md: \\[effort-unsupported-model\\] model "${model.replace(/[[\]]/g, "\\$&")}"`),
      `${model} が effort-unsupported-model として報告されない\n${output}`,
    );
  });
  assert.doesNotMatch(output, /\[haiku-effort\]/);
});

test("effort 表にあるモデルと、プロバイダで解決先が変わる alias は effort を置いても通る", (t) => {
  const models = [
    "haiku",
    "sonnet",
    "opus",
    "fable",
    "inherit",
    "claude-haiku-5-5",
    "claude-sonnet-5-5",
    "claude-sonnet-5",
    "claude-opus-5-5",
    "claude-opus-5",
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-opus-4-6[1m]",
    "claude-fable-5-2",
  ];
  const root = pluginWithModels(t, models);
  const { status, output } = check(root);
  assert.equal(status, 0, output);
  assert.match(output, new RegExp(`plugin agent check passed \\(${models.length} agents`));
});

test("effort を置かなければ、旧モデルの完全 ID でも effort-unsupported-model にならない", (t) => {
  const root = makePlugin(t, { "legacy.md": agentFile("legacy", "claude-haiku-4-5") });
  const { status, output } = check(root);
  assert.equal(status, 0, output);
});

test("プラグイン agent で無視されるキーは、initialPrompt を含めてキーごとに報告する", () => {
  const { status, output } = check(fixture, join(fixture, "agent-effort-pins.json"));
  assert.equal(status, 1, output);
  for (const key of ["hooks", "mcpServers", "permissionMode", "initialPrompt"]) {
    assert.match(
      output,
      new RegExp(`ignored-keys\\.md: \\[ignored-key\\] ${key} はプラグイン agent では無視される`),
      `${key} が ignored-key として報告されない\n${output}`,
    );
  }
});

test("負例 fixture では、改名した effort-unsupported-model と agent-subfolder が発火し、旧コードは出ない", () => {
  const { status, output } = check(fixture, join(fixture, "agent-effort-pins.json"));
  assert.equal(status, 1, output);
  assert.match(output, /effort-unsupported-model\.md: \[effort-unsupported-model\] model "claude-haiku-4-5"/);
  assert.match(output, /\[agent-subfolder\]/);
  assert.doesNotMatch(output, /\[haiku-effort\]/);
});

test("agents/ のサブフォルダの .md は agent-subfolder として報告する（3段の名前は pin と参照の検査が扱えない）", (t) => {
  const root = makePlugin(t, {
    "top.md": agentFile("top", "inherit"),
    "review/security.md": agentFile("security", "inherit"),
    "review/deep/audit.md": agentFile("audit", "inherit"),
    "review/notes.txt": "not an agent\n",
  });
  const { status, output } = check(root);
  assert.equal(status, 1, output);
  assert.match(output, /agents\/review\/security\.md: \[agent-subfolder\]/);
  assert.match(output, /agents\/review\/deep\/audit\.md: \[agent-subfolder\]/);
  assert.doesNotMatch(output, /notes\.txt/);
  assert.doesNotMatch(output, /top\.md: \[agent-subfolder\]/);
});
