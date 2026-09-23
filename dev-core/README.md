# Dev Core Plugin

TDD 開発フレームワーク。t-wada 式 TDD、FSD、Clean Architecture、DDD のベストプラクティスを、知識スキル・ワークフロー・専門エージェント・Hooks 自動化の4層で提供します。

## どんな時に使うか

### 新機能開発

```
/dev-core:grill 認証方式の選択肢を検討  # 重要判断を一度に1問ずつ圧力テスト
/dev-core:task ユーザー認証機能を追加    # 調査 → 証拠付き計画
/dev-core:task ユーザー認証機能を追加 --issue # 明示時だけIssue作成
/dev-core:execute docs/plans/task-*.md   # TDD 実装
/dev-core:verify                         # 6段階検証
```

### バグ修正

```
/dev-core:debug "エラーメッセージ"       # 4フェーズ根本原因分析
/dev-core:tdd "バグ修正: ..."            # TDD サイクルで修正
```

### コードレビュー・改善

```
/dev-core:code-review                    # セルフレビュー
/dev-core:refactor                       # リファクタリング
```

## 構成（2層スキル + エージェント + Hooks）

### 知識スキル（`skills/` — Codex と共有）

ツール非依存の開発原則。Claude が文脈に応じて自動ロードし、`/dev-core:<skill>` でも起動できる。

| スキル | 内容 |
|--------|------|
| best-practices | TDD/SOLID/コーディング規約のコア原則。詳細は references/{coding-standards,architecture,security}.md に progressive disclosure |
| frontend-patterns | フロントエンド設計パターン（フレームワーク非依存） |
| backend-patterns | API設計、Repository、サービス層パターン |
| verify | 6段階検証フロー（build→type→lint→test→security→diff）。証拠ベース完了判定（Iron Law）の正本。検証コマンドはプロジェクトから自動検出 |
| debug | 4フェーズ根本原因分析。Three Strikes Rule（3回失敗で STOP）の正本 |
| continuous-learning | Mitchell Hashimoto 式の複利的改善ループ |
| codex-collab | Claude Code ⟷ Codex 協働（セカンドオピニオン/レスキュー）の駆動 |

### ワークフロー（`workflows/` — Claude Code 専用）

サブエージェント・Agent Teams をオーケストレーションするタスク型スキル。**ユーザー起動専用**（`disable-model-invocation: true`）。

| コマンド | 用途 |
|----------|------|
| `/dev-core:grill` | 重要な計画・判断を一度に1問ずつ圧力テスト |
| `/dev-core:task` | リポジトリ調査 → 証拠付き完了条件 → TDD計画。Issueはopt-in |
| `/dev-core:task-team` | Agent Teamで複数視点から設計議論 |
| `/dev-core:execute` | 永続計画に基づく自律TDD実装。commit/PRはopt-in |
| `/dev-core:tdd` | 単独TDDサイクル |
| `/dev-core:refactor` | リファクタリング |
| `/dev-core:code-review` | コードレビュー |
| `/dev-core:debug-team` | Agent Teamでバグ調査 |
| `/dev-core:e2e` | Playwright E2Eテスト |

### エージェント（`agents/`）

主要エージェントは `model: inherit`（セッションモデルに追従）。必要な知識スキルは frontmatter の `skills` でプリロードされる。

| エージェント | 役割 | タスク例 |
|-------------|------|---------|
| task-planner | 計画立案（FSD/CA/DDD設計含む） | 計画立案 |
| tdd-practitioner | TDD実行 + リファクタリング | TDD実装、リファクタリング |
| quality-checker | lint/typecheck/test実行・修正 | 品質チェック |
| security-auditor | セキュリティ監査（OWASP/金融） | セキュリティ監査 |
| code-reviewer | 3軸コードレビュー + P0-P3 severity gate（Zero Trust Review） | コードレビュー |
| build-error-resolver | ビルドエラー自動修復 | ビルドエラー修正 |
| architecture-guide | FSD/CA/DDD設計ガイド | レイヤー配置判断 |
| doc-updater | ドキュメント自動更新 | ドキュメント更新 |
| e2e-runner | Playwright E2Eテスト | E2Eテスト |
| issue-creator | GitHub Issue作成 | Issue作成 |

独立タスクは並列実行可能。

### フック（`hooks/` + `scripts/` — 自動実行）

| タイミング | 処理 | 実体 |
|-----------|------|------|
| SessionStart | allowlist済みrepository metadata + 未完了planのpath/status注入 | scripts/session-start-context.sh |
| PreToolUse:Bash | 危険コマンドブロック（rm -rf、force push等） | scripts/block-dangerous-commands.sh |
| PostToolUse:Write\|Edit | Prettier自動フォーマット（設定があるプロジェクトのみ） | scripts/format-changed-file.sh |
| Stop | デバッグ残骸（console.log/debugger）の停止前検出 | scripts/stop-quality-gate.sh |

Claude Code の現行hook仕様では SessionStart/PreCompact は prompt handler 非対応。planの永続化は `/execute` が各iteration・停止・圧縮前に行い、SessionStart command hook はplan本文をdeveloper contextへ流さず再開対象だけを知らせる。`scripts/validate-claude-hooks.mjs` がevent/type互換性をCIで検証する。

検出パターンの追加 = continuous-learning スキルの実践箇所。スクリプトとfixtureを編集してフック自体を成長させる。

`dev-core/evals/skill-behavior-cases.json` は grill の trigger/no-trigger、可逆な判断の継続、不可逆判断の停止、現在証拠による完了判定、TDD/refactor/debugのdelivery side effect禁止を9ケースで固定する。`node scripts/validate-skill-evals.mjs` は schema と参照 skill を決定的に検証する静的gateであり、model挙動の採点は将来のcalibrated live evalで行う。

## Codex 互換・協働

dev-core の知識スキル（`skills/`）は Agent Skills 標準準拠で、Claude Code と Codex の双方から利用できます。`workflows/` は Claude Code 専用（Codex には共有されない）。

- **Codex から使う（2経路）**:
  - 経路A: `.codex-plugin/plugin.json` を持つ dev-core を Codex の plugin として install（bundled skills）
  - 経路B: `scripts/setup-shared-skills.sh` で利用者プロジェクトの `.agents/skills/<skill>` を SSoT（`dev-core/skills`）へ symlink
- **Codex 権限設定**: Claude Code の `permissions.allow/deny` は、Codex では permission profiles（filesystem/network）と rules（command allow/prompt/forbidden）へ分けて移行。
- **協働ワークフロー**: `codex-collab` スキルが Claude 実装 → Codex レビュー（`/codex:review`）/ レスキュー（`/codex:rescue`）を駆動。Three Strikes Rule・Zero Trust Review と統合。前提に codex-plugin-cc（OpenAI 公式）。
- **構成検証**: `scripts/check-skills-drift.mjs` + `scripts/validate-claude-hooks.mjs` + `claude plugin validate --strict`（CI: `.github/workflows/skills-drift-check.yml`）が frontmatter 標準準拠・マニフェスト整合・hook互換性・インデックス整合を静的検証。

詳細・移行手順:

- [`docs/codex-interop/shared-skills-setup.md`](../docs/codex-interop/shared-skills-setup.md)
- [`docs/codex-interop/codex-permissions.md`](../docs/codex-interop/codex-permissions.md)

## プロジェクト設定

`.claude/dev-core.local.md` でプロジェクト固有の設定（verify スキル・quality-checker が最優先で参照する）。コマンドは言語・スタックに合わせて記述する:

```markdown
<!-- 例1: Node.js (pnpm) -->
---
package-manager: pnpm
build-command: pnpm build
typecheck-command: pnpm typecheck
lint-command: pnpm lint
test-command: pnpm test
audit-command: npm audit --audit-level=moderate
---

## 技術スタック
- Framework: Laravel 11 + Vue 3
- Database: MySQL
```

```markdown
<!-- 例2: Rust (cargo) -->
---
build-command: cargo build
typecheck-command: cargo clippy -- -D warnings
lint-command: cargo fmt --check
test-command: cargo test
audit-command: cargo audit
---

## 技術スタック
- Framework: Axum / Tauri 2
```

```markdown
<!-- 例3: Python (uv) -->
---
build-command: uv sync --locked
typecheck-command: uv run mypy src/
lint-command: uv run ruff check . && uv run ruff format --check .
test-command: uv run pytest
audit-command: uv run pip-audit
---

## 技術スタック
- Framework: FastAPI + Pydantic
```

複数言語が共存するプロジェクト（例: Tauri = Cargo.toml + package.json）では、**全系統のコマンドを `&&` で連結するか、Makefile / justfile に一本化して指定する**。片方の言語だけ検証して完了扱いにしない。
