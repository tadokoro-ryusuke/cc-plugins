# Dev Core Plugin v2.0

エンタープライズグレードの TDD 開発フレームワーク。t-wada 式 TDD、FSD、Clean Architecture、DDD のベストプラクティスと、6 段階検証、継続学習、金融システム対応のセキュリティを提供します。

## このプラグインの目的

**「品質を犠牲にしない高速開発」** を実現するためのプラグインです。

- テスト駆動開発（TDD）を強制的に実践
- コード品質を自動的にチェック・改善
- セキュリティ脆弱性を早期発見
- チーム開発での一貫した品質基準を維持

## どんな時に使うか

### 新機能を開発するとき

```bash
# 1. 対話型で要件整理 → 計画 → Issue 作成
/dev-core:task ユーザー認証機能を追加

# 2. TDD で実装（Red→Green→Refactor→Commit を自動実行）
/dev-core:execute docs/plans/task-user-auth.md

# 3. 品質を検証
/dev-core:verify
```

### コードレビュー・PR 作成前

```bash
# 自分のコードをレビュー
/dev-core:code-review

# リファクタリング
/dev-core:refactor

# 6段階検証で最終確認
/dev-core:verify
```

### バグ修正・ホットフィックス

```bash
# 単独の TDD サイクルで修正
/dev-core:tdd "バグ修正: ログイン時のエラー"

# ビルドエラーが出たら自動修復
/dev-core:build-fix
```

### チームで開発するとき

```bash
# 複数エージェントで自動ワークフロー
/dev-core:orchestrate #123

# 進捗をチェックポイントで記録
/dev-core:checkpoint --create "Phase 1 完了"
```

## コマンド早見表

| やりたいこと             | コマンド                        |
| ------------------------ | ------------------------------- |
| 要件整理→計画→Issue作成  | `/dev-core:task 概要`           |
| TDD で実装したい         | `/dev-core:execute plan.md`     |
| 品質をチェックしたい     | `/dev-core:verify`              |
| コードを改善したい       | `/dev-core:refactor`            |
| コードレビューしたい     | `/dev-core:code-review`         |
| ビルドエラーを直したい   | `/dev-core:build-fix`           |
| E2E テストを実行したい   | `/dev-core:e2e`                 |
| カバレッジを確認したい   | `/dev-core:test-coverage`       |
| ドキュメントを更新したい | `/dev-core:update-docs`         |
| 自動ワークフロー実行     | `/dev-core:orchestrate #123`    |
| 進捗を記録したい         | `/dev-core:checkpoint --create` |
| 品質を追跡したい         | `/dev-core:eval`                |
| セッションから学習       | `/dev-core:learn`               |

## 典型的なワークフロー

### ワークフロー 1: 新機能開発（推奨）

```
/dev-core:task "機能概要"  ← 対話で要件整理 → 計画立案 → Issue 作成
    ↓
/dev-core:execute plan.md  ← TDD 実装（Red→Green→Refactor→Commit）
    ↓
/dev-core:verify           ← 6段階検証（build/type/lint/test/security/diff）
    ↓
/dev-core:code-review      ← セルフレビュー
    ↓
gh pr create               ← PR 作成
```

### ワークフロー 2: 高速開発（小さな修正）

```
/dev-core:tdd "機能名"     ← 単独 TDD サイクル
    ↓
/dev-core:verify --fix     ← 検証 + 自動修正
    ↓
git commit                 ← コミット
```

### ワークフロー 3: フル自動化

```
/dev-core:orchestrate #123
    ↓
（自動で plan → tdd → quality → security → docs を実行）
    ↓
gh pr create
```

## エージェントの使い分け

| エージェント           | 役割             | 使う場面                             |
| ---------------------- | ---------------- | ------------------------------------ |
| task-planner           | 計画立案         | 要件から実装計画を作るとき           |
| issue-creator          | Issue 作成       | 計画書から GitHub Issue を作成       |
| tdd-practitioner       | TDD 実行         | コードを書くとき（テストファースト） |
| refactoring-specialist | リファクタリング | コード品質を改善するとき             |
| quality-checker        | 品質チェック     | lint/typecheck/test を実行するとき   |
| security-auditor       | セキュリティ監査 | 脆弱性をチェックするとき             |
| architecture-guide     | 設計ガイド       | FSD/Clean Architecture の相談        |
| build-error-resolver   | エラー修復       | ビルドエラーを自動修復               |
| code-reviewer          | コードレビュー   | PR 前のセルフレビュー                |
| doc-updater            | ドキュメント更新 | 自動ドキュメント生成                 |
| e2e-runner             | E2E テスト       | Playwright テスト実行                |

## スキルの使い方

スキルは自動的に読み込まれますが、明示的に呼び出すこともできます。

```
「TDD のベストプラクティスを教えて」
→ dev-core:best-practices スキルが自動読み込み

「OWASP Top 10 について確認したい」
→ dev-core:security-review スキルが自動読み込み

「React のパターンを教えて」
→ dev-core:frontend-patterns スキルが自動読み込み
```

### スキル一覧

| スキル              | 内容                                  |
| ------------------- | ------------------------------------- |
| best-practices      | TDD/FSD/Clean Architecture/DDD の基本 |
| inngest             | Inngest 関数開発ガイド                |
| coding-standards    | 命名規約、コードスタイル              |
| security-review     | OWASP Top 10、セキュリティチェック    |
| verification-loop   | 6 段階検証フロー                      |
| continuous-learning | セッション学習パターン                |
| strategic-compact   | コンテキスト最適化                    |
| eval-harness        | Eval 駆動開発                         |
| backend-patterns    | API 設計、Repository パターン         |
| frontend-patterns   | React パターン、カスタムフック        |
| project-guidelines  | プロジェクト固有設定                  |

## フック（自動実行）

以下の処理が自動的に実行されます：

| タイミング         | 処理内容                   |
| ------------------ | -------------------------- |
| コンテキスト圧縮前 | 作業状態の自動保存         |

## インストール

```bash
# Claude Code でプラグインを有効化
cc --plugin-dir /path/to/dev-core
```

## プロジェクト設定

`.claude/dev-core.local.md` を作成してプロジェクト固有の設定を行います：

```markdown
---
package-manager: pnpm
test-command: pnpm test
lint-command: pnpm lint
build-command: pnpm build
typecheck-command: pnpm typecheck
---

# プロジェクト固有の設定

## 技術スタック

- Framework: Next.js 14 (App Router)
- UI: shadcn/ui + Tailwind CSS
- State: Zustand
- Database: PostgreSQL + Prisma

## 追加の規約

- コンポーネントは FSD の features/ または entities/ に配置
- API は /api ディレクトリに配置
```

## 開発原則

このプラグインは以下の原則に基づいています：

- **t-wada 式 TDD**: Red → Green → Refactor → Commit サイクル
- **Feature-Sliced Design (FSD)**: 機能ごとの分離、層構造での整理
- **Clean Architecture**: ビジネスロジックのフレームワーク独立性
- **DDD**: エンティティ、バリューオブジェクト、リポジトリパターン
- **SOLID 原則**: 単一責任、開放閉鎖、リスコフ置換、インターフェース分離、依存性逆転

## よくある質問

### Q: TDD を強制されるのが面倒

A: `/dev-core:tdd` の `--green` オプションで実装のみ実行できます。ただし、テストファーストを強く推奨します。

### Q: 小さな修正でも plan が必要？

A: 不要です。`/dev-core:tdd "修正内容"` で直接 TDD サイクルを実行できます。

### Q: 複数のエージェントを手動で呼び出すのが面倒

A: `/dev-core:orchestrate` で自動的に複数エージェントを順序実行できます。

### Q: セキュリティチェックを厳しくしたい

A: security-auditor エージェントは OWASP Top 10 と金融システム向けのチェックを行います。

## ライセンス

MIT
