# Dev Core Plugin

TDD 開発フレームワーク。t-wada 式 TDD、FSD、Clean Architecture、DDD のベストプラクティスを、知識スキル・ワークフロー・専門エージェント・Hooks 自動化の4層で提供します。

## どんな時に使うか

### 新機能開発

```
/dev-core:task ユーザー認証機能を追加    # 要件整理 → 計画 → Issue
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
| `/dev-core:task` | 対話型要件整理 → TDD計画 → Issue作成 |
| `/dev-core:task-team` | Agent Teamで複数視点から設計議論 |
| `/dev-core:execute` | 計画書に基づくTDD実装 |
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
| code-reviewer | 3軸コードレビュー（Zero Trust Review） | コードレビュー |
| build-error-resolver | ビルドエラー自動修復 | ビルドエラー修正 |
| architecture-guide | FSD/CA/DDD設計ガイド | レイヤー配置判断 |
| doc-updater | ドキュメント自動更新 | ドキュメント更新 |
| e2e-runner | Playwright E2Eテスト | E2Eテスト |
| issue-creator | GitHub Issue作成 | Issue作成 |

独立タスクは並列実行可能。

### フック（`hooks/` + `scripts/` — 自動実行）

| タイミング | 処理 | 実体 |
|-----------|------|------|
| SessionStart | プロジェクト状態注入 + 行動規律リマインド | prompt hook |
| PreToolUse:Bash | 危険コマンドブロック（rm -rf、force push等） | scripts/block-dangerous-commands.sh |
| PostToolUse:Write\|Edit | Prettier自動フォーマット（設定があるプロジェクトのみ） | scripts/format-changed-file.sh |
| PreCompact | 構造化状態保存 | prompt hook |
| Stop | デバッグ残骸（console.log/debugger）の停止前検出 | scripts/stop-quality-gate.sh |

検出パターンの追加 = continuous-learning スキルの実践箇所。スクリプトを編集してフック自体を成長させる。

## Codex 互換・協働

dev-core の知識スキル（`skills/`）は Agent Skills 標準準拠で、Claude Code と Codex の双方から利用できます。`workflows/` は Claude Code 専用（Codex には共有されない）。

- **Codex から使う（2経路）**:
  - 経路A: `.codex-plugin/plugin.json` を持つ dev-core を Codex の plugin として install（bundled skills）
  - 経路B: `scripts/setup-shared-skills.sh` で利用者プロジェクトの `.agents/skills/<skill>` を SSoT（`dev-core/skills`）へ symlink
- **Codex 権限設定**: Claude Code の `permissions.allow/deny` は、Codex では permission profiles（filesystem/network）と rules（command allow/prompt/forbidden）へ分けて移行。
- **協働ワークフロー**: `codex-collab` スキルが Claude 実装 → Codex レビュー（`/codex:review`）/ レスキュー（`/codex:rescue`）を駆動。Three Strikes Rule・Zero Trust Review と統合。前提に codex-plugin-cc（OpenAI 公式）。
- **構成検証**: `scripts/check-skills-drift.mjs` + `claude plugin validate --strict`（CI: `.github/workflows/skills-drift-check.yml`）が frontmatter 標準準拠・マニフェスト整合・インデックス整合を静的検証。

詳細・移行手順:

- [`docs/codex-interop/shared-skills-setup.md`](../docs/codex-interop/shared-skills-setup.md)
- [`docs/codex-interop/codex-permissions.md`](../docs/codex-interop/codex-permissions.md)

## プロジェクト設定

`.claude/dev-core.local.md` でプロジェクト固有の設定（verify スキル・quality-checker が最優先で参照する）:

```markdown
---
package-manager: pnpm
build-command: pnpm build
typecheck-command: pnpm typecheck
lint-command: pnpm lint
test-command: pnpm test
---

## 技術スタック
- Framework: Laravel 11 + Vue 3
- UI: Vuetify 3
- Database: MySQL
```
