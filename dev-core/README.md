# Dev Core Plugin

TDD開発フロー、コード品質管理、リファクタリング、アーキテクチャガイドを統合的にサポートするClaude Codeプラグインです。

## 機能

### エージェント（6個）

| エージェント | 説明 |
|------------|------|
| task-planner | TDD計画立案（BDD/Tidy First/RGR） |
| tdd-practitioner | TDD実践（Red→Green→Refactor→Commit） |
| refactoring-specialist | Martin Fowler/T-wada式リファクタリング |
| quality-checker | コード品質監視（lint/typecheck/test自動実行） |
| security-auditor | セキュリティ監査（ハードコーディング検出等） |
| architecture-guide | FSD+Clean Architecture+DDDガイド |

### コマンド（3個）

| コマンド | 説明 |
|--------|------|
| `/dev-core:plan` | GitHub Issue→TDD計画立案→実装 |
| `/dev-core:execute` | 計画書に基づくTDD実装実行 |
| `/dev-core:refactor` | 作業中コード/PR/ブランチのリファクタリング |

### スキル（1個）

| スキル | 説明 |
|-------|------|
| best-practices | TDD/FSD/Clean Architecture/DDDのベストプラクティス |

## インストール

```bash
# Claude Codeでプラグインを有効化
cc --plugin-dir /path/to/dev-core
```

## 設定

プロジェクトの `.claude/dev-core.local.md` ファイルを作成して、プロジェクト固有の設定を行えます：

```markdown
# Dev Core Settings

## パッケージマネージャー
pnpm

## テストコマンド
pnpm test

## Lintコマンド
pnpm lint

## 型チェックコマンド
pnpm typecheck

## フォーマットコマンド
pnpm format

## 追加ツール
- Serena（コードベース探索）

## プロジェクト固有の規約ファイル
CLAUDE.md
```

### 設定項目

| 項目 | デフォルト | 説明 |
|-----|----------|------|
| パッケージマネージャー | `pnpm` | npm, yarn, bunも使用可能 |
| テストコマンド | `pnpm test` | テスト実行コマンド |
| Lintコマンド | `pnpm lint` | Lintチェックコマンド |
| 型チェックコマンド | `pnpm typecheck` | TypeScript型チェック |
| 追加ツール | なし | Serena等の追加ツールを指定 |

## 使用例

### TDD開発フロー

```bash
# 1. GitHub Issueから計画を立案
/dev-core:plan 123

# 2. 計画に基づいてTDD実装を実行
/dev-core:execute issue-123

# 3. リファクタリング
/dev-core:refactor

# 4. Pull Request作成（github-toolsプラグイン使用）
/github-tools:pr 123
```

### コード品質管理

```bash
# 変更コードのリファクタリング
/dev-core:refactor src/features/client/

# PR全体をリファクタリング
/dev-core:refactor #123

# 作業中の変更をリファクタリング
/dev-core:refactor
```

## 開発原則

このプラグインは以下の原則に基づいています：

- **t-wada式TDD**: Red→Green→Refactor→Commitサイクル
- **Feature-Sliced Design (FSD)**: 機能ごとの分離、層構造での整理
- **Clean Architecture**: ビジネスロジックのフレームワーク独立性
- **DDD**: エンティティ、バリューオブジェクト、リポジトリパターン
- **SOLID原則**: 単一責任、開放閉鎖、リスコフ置換、インターフェース分離、依存性逆転

## ライセンス

MIT
