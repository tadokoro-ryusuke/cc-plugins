# Dev Core Plugin v3.0

TDD 開発フレームワーク。t-wada 式 TDD、FSD、Clean Architecture、DDD のベストプラクティスを提供します。

## どんな時に使うか

### 新機能開発

```bash
/dev-core:task ユーザー認証機能を追加    # 要件整理 → 計画 → Issue
/dev-core:execute docs/plans/task-*.md   # TDD 実装
/dev-core:verify                         # 6段階検証
```

### バグ修正

```bash
/dev-core:debug "エラーメッセージ"       # 4フェーズ根本原因分析
/dev-core:tdd "バグ修正: ..."            # TDD サイクルで修正
```

### コードレビュー・改善

```bash
/dev-core:code-review                    # セルフレビュー
/dev-core:refactor                       # リファクタリング
```

## コマンド一覧

| コマンド | 用途 |
|----------|------|
| `/dev-core:task` | 対話型要件整理 → TDD計画 → Issue作成 |
| `/dev-core:task-team` | Agent Teamで複数視点から設計議論 |
| `/dev-core:execute` | 計画書に基づくTDD実装 |
| `/dev-core:tdd` | 単独TDDサイクル |
| `/dev-core:verify` | 6段階検証（build/type/lint/test/security/diff） |
| `/dev-core:refactor` | リファクタリング |
| `/dev-core:code-review` | コードレビュー |
| `/dev-core:debug` | 4フェーズ根本原因分析（軽量版） |
| `/dev-core:debug-team` | Agent Teamでバグ調査 |
| `/dev-core:e2e` | Playwright E2Eテスト |
| `/dev-core:checkpoint` | 進捗スナップショット |

## エージェント

| エージェント | 役割 |
|-------------|------|
| task-planner | 計画立案（FSD/CA/DDD設計含む） |
| tdd-practitioner | TDD実行 + リファクタリング |
| quality-checker | lint/typecheck/test実行・修正 |
| security-auditor | セキュリティ監査（OWASP/金融） |
| code-reviewer | 3軸コードレビュー |
| build-error-resolver | ビルドエラー自動修復 |
| architecture-guide | FSD/CA/DDD設計ガイド |
| doc-updater | ドキュメント自動更新 |
| e2e-runner | Playwright E2Eテスト |
| issue-creator | GitHub Issue作成 |

## スキル

| スキル | 内容 |
|--------|------|
| best-practices | TDD/FSD/CA/DDD/SOLID/セキュリティの統合ガイド（Single Source of Truth） |
| frontend-patterns | フロントエンド設計パターン（フレームワーク非依存） |
| backend-patterns | API設計、Repository、サービス層パターン |
| verification-loop | 6段階検証フロー |
| continuous-learning | Mitchell Hashimoto式の複利的改善ループ |
| codex-collab | Claude Code ⟷ Codex 協働（セカンドオピニオン/レスキュー）の駆動 |

## フック（自動実行）

| タイミング | 処理 |
|-----------|------|
| SessionStart | プロジェクト状態注入（git status、中断タスク検出） |
| PreToolUse:Bash | 危険コマンドブロック（rm -rf、drop table等） |
| PostToolUse:Write\|Edit | Prettier自動フォーマット |
| PreCompact | 構造化状態保存 |
| Stop | 未コミット変更・console.log残存検出 |

## Codex 互換・協働

dev-core のスキル（知識）は Agent Skills 標準準拠で、Claude Code と Codex の双方から利用できます。

- **Codex から使う（2経路）**:
  - 経路A: `.codex-plugin/plugin.json` を持つ dev-core を Codex の plugin として install（bundled skills）
  - 経路B: `scripts/setup-shared-skills.sh` で利用者プロジェクトの `.agents/skills/<skill>` を SSoT（`dev-core/skills`）へ symlink
- **協働ワークフロー**: `codex-collab` スキルが Claude 実装 → Codex レビュー（`/codex:review`）/ レスキュー（`/codex:rescue`）を駆動。Three Strikes Rule・Zero Trust Review と統合。前提に codex-plugin-cc（OpenAI 公式）。
- **構成検証**: `scripts/check-skills-drift.mjs`（CI: `.github/workflows/skills-drift-check.yml`）が frontmatter 標準準拠・マニフェスト整合・インデックス整合を静的検証。

詳細・移行手順: [`docs/codex-interop/shared-skills-setup.md`](../docs/codex-interop/shared-skills-setup.md)

## プロジェクト設定

`.claude/dev-core.local.md` でプロジェクト固有の設定:

```markdown
---
package-manager: pnpm
test-command: pnpm test
lint-command: pnpm lint
---

## 技術スタック
- Framework: Laravel 11 + Vue 3
- UI: Vuetify 3
- Database: MySQL
```
