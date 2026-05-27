# Codex 権限設定（Claude settings.json からの移行メモ）

Claude Code の `settings.json` にある `permissions.allow` / `permissions.deny` は、
Codex では 1 つの JSON 配列にそのまま対応しない。Codex 側では次の 3 層に分けて扱う。

| Claude の設定 | Codex の対応 |
|---------------|-------------|
| `Read` / `Edit` / `Write` のパス許可 | `~/.codex/config.toml` の permission profile |
| `WebFetch` / shell command のネットワーク | permission profile の network domain rules |
| `Bash(...)` の allow / deny | `~/.codex/rules/*.rules` の `prefix_rule()` |

公式ドキュメント:

- Permissions: https://developers.openai.com/codex/permissions
- Rules: https://developers.openai.com/codex/rules
- Advanced config: https://developers.openai.com/codex/config-advanced

## 重要な違い

- Codex の permission profile はファイルシステムとネットワークの境界を定義する。
- Codex の `.rules` は「sandbox 外で実行するコマンド」を許可・確認・禁止する。
- Claude の `Edit(!node_modules/**)` のような「読み取りは許すが編集だけ禁止」に近い表現は、Codex では `read` を使う。`deny` は読み書き両方を拒否する。
- `approval_policy = "on-request"` にしておくと、ルールで許可されていない操作は確認付きになる。
- `sandbox_mode` / `sandbox_workspace_write` と `default_permissions` / `[permissions]` は混在させない。新規設定では permission profiles を優先する。

## 推奨 config.toml 例

`~/.codex/config.toml` に追加する例。

```toml
approval_policy = "on-request"
default_permissions = "dev-core-workspace"

[permissions.dev-core-workspace.workspace_roots]
"~/projects" = true
"~/work" = true
"~/dev" = true
"~/src" = true

[permissions.dev-core-workspace.filesystem]
":minimal" = "read"
"~/.gitconfig" = "write"
"~/.gitignore_global" = "write"
"~/.config" = "write"
"~/.ssh/id_*" = "deny"
"~/.ssh/*_rsa" = "deny"
"~/.ssh/*_ecdsa" = "deny"
"~/.ssh/*_ed25519" = "deny"
"/etc" = "deny"
"/usr" = "deny"
"/var" = "deny"
"/opt" = "deny"
"/bin" = "deny"
"/sbin" = "deny"
"/lib" = "deny"
"/lib64" = "deny"
"/boot" = "deny"
"/proc" = "deny"
"/sys" = "deny"
"/dev" = "deny"

[permissions.dev-core-workspace.filesystem.":workspace_roots"]
"." = "write"
".git" = "read"
"node_modules" = "read"
"vendor" = "read"
".venv" = "read"
"venv" = "read"
"__pycache__" = "read"
"target" = "read"
"dist" = "read"
"build" = "read"
".next" = "read"
"coverage" = "read"
"**/*.env" = "deny"
"**/.env.*" = "deny"

[permissions.dev-core-workspace.network]
enabled = true

[permissions.dev-core-workspace.network.domains]
"api.openai.com" = "allow"
"objects.githubusercontent.com" = "allow"
"github.com" = "allow"
"*.github.com" = "allow"
"registry.npmjs.org" = "allow"
"pypi.org" = "allow"
"files.pythonhosted.org" = "allow"
"crates.io" = "allow"
"static.crates.io" = "allow"
"proxy.golang.org" = "allow"
"tracking.example.com" = "deny"
```

より Claude の `WebFetch(domain:*)` に近い運用にしたい場合は、domain rules に `"*" = "allow"` を置ける。ただし公式ドキュメント上も public network access を意図する場合だけ使う前提なので、通常は必要な registry / API / GitHub だけを足す。

## 推奨 rules 例

`~/.codex/rules/default.rules` に追加する例。Claude の `Bash(command:*)` は Codex では `pattern = ["command"]` の prefix rule に寄せる。

```python
# Package managers and common build tools.
for command in [
    "npm", "yarn", "pnpm", "bun",
    "uv", "pip", "pipx", "poetry", "pdm", "hatch",
    "cargo", "rustc", "rustup", "rustfmt",
    "go", "node", "deno",
    "make", "cmake", "just", "task", "ninja",
]:
    prefix_rule(
        pattern = [command],
        decision = "allow",
        justification = "Common development command",
    )

# Test, lint, format, and frontend tooling.
for command in [
    "ruff", "black", "isort", "mypy", "pytest", "coverage", "tox",
    "tsx", "tsc", "ts-node", "eslint", "prettier", "biome", "oxlint",
    "vitest", "jest", "ava", "mocha", "tap",
    "webpack", "vite", "rollup", "parcel", "turbo", "nx",
    "next", "nuxt", "astro", "svelte", "remix",
]:
    prefix_rule(
        pattern = [command],
        decision = "allow",
        justification = "Common verification or frontend command",
    )

# Source control and inspection.
for command in [
    "git", "gh", "glab",
    "ls", "cat", "grep", "rg", "find", "fd",
    "pwd", "tree", "jq", "yq",
    "head", "tail", "wc", "sort", "awk", "sed",
    "ps", "lsof", "date", "whoami", "env",
]:
    prefix_rule(
        pattern = [command],
        decision = "allow",
        justification = "Common repository inspection command",
    )

# Network download commands are intentionally prompt-gated even when network
# domains are allowed. This mirrors a conservative Claude deny-over-allow setup.
for command in ["curl", "wget", "http", "httpie"]:
    prefix_rule(
        pattern = [command],
        decision = "prompt",
        justification = "Network downloads should be reviewed before running",
    )

# Destructive or high-impact commands.
for pattern in [
    ["rm", "-rf", "/"],
    ["rm", "-rf", "~"],
    ["rm", "-rf", ".git"],
    ["sudo", "rm"],
    ["sudo", "dd"],
    ["sudo", "mkfs"],
    ["sudo", "fdisk"],
    ["sudo", "mount"],
    ["sudo", "umount"],
    ["dd"],
    ["mkfs"],
    ["fdisk"],
    ["docker", "system", "prune", "-af"],
    ["npm", "publish"],
    ["cargo", "publish"],
    ["deno", "publish"],
    ["git", "push", "-f", "origin", "main"],
    ["git", "push", "--force-with-lease", "origin", "main"],
]:
    prefix_rule(
        pattern = pattern,
        decision = "forbidden",
        justification = "Blocked by dev-core safety policy; ask the user for an explicit manual action",
    )
```

ルールは prefix match なので、`pattern = ["git"]` を許可した後でも、より具体的な `["git", "push", "-f", "origin", "main"]` を `forbidden` にできる。複数ルールが一致した場合は、より制限の強い判定（`forbidden` > `prompt` > `allow`）が勝つ。

## ルールの検証

```bash
codex execpolicy check --pretty \
  --rules ~/.codex/rules/default.rules \
  -- git push -f origin main

codex execpolicy check --pretty \
  --rules ~/.codex/rules/default.rules \
  -- npm test
```

設定変更後は Codex を再起動する。
