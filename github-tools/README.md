# GitHub Tools Plugin

GitHub連携ワークフローを支援するClaude Codeプラグインです。

## 機能

### コマンド（4個）

| コマンド | 説明 |
|--------|------|
| `/github-tools:pr` | 現在のブランチからPull Requestを作成 |
| `/github-tools:issue` | 作業指示からGitHub Issue作成 |
| `/github-tools:task` | 対話型作業指示作成 |
| `/github-tools:docs` | ドキュメント更新 |

## インストール

```bash
# Claude Codeでプラグインを有効化
cc --plugin-dir /path/to/github-tools
```

## 使用例

### Issue作成フロー

```bash
# 1. 対話的にタスク仕様を作成
/github-tools:task クライアント検索機能の追加

# 2. 作成した仕様からIssueを作成
/github-tools:issue ./docs/tasks/add-client-search.md
```

### Pull Request作成フロー

```bash
# 1. 機能開発（dev-coreプラグイン使用）
/dev-core:plan 123
/dev-core:execute issue-123

# 2. Pull Request作成
/github-tools:pr 123
```

### ドキュメント更新

```bash
# コード変更後にドキュメントを更新
/github-tools:docs
```

## 特徴

### `/github-tools:pr`

- **自動Issue連携**: ブランチ名やコミットメッセージからIssue番号を検出
- **品質保証**: PR作成前にlint/typecheck/testを実行
- **テンプレート**: プロジェクト固有のPRテンプレートを使用
- **変更分析**: 変更内容から適切なタイプ（feat/fix/test/docs）を判定
- **ドラフト対応**: 作業中のPRはドラフトとして作成可能

### `/github-tools:issue`

- **構造化テンプレート**: BDDシナリオ、技術要件を含むIssue作成
- **自動ラベル付け**: 優先度とタイプを自動判定
- **ドキュメント連携**: 作業指示ドキュメントからの自動生成

### `/github-tools:task`

- **対話型作成**: 質問形式で仕様を整理
- **BDD形式**: Given/When/Then形式のシナリオ作成
- **構造化出力**: 再利用可能なMarkdownドキュメント生成

## 前提条件

- GitHub CLI (`gh`) がインストールされていること
- GitHub認証が完了していること (`gh auth login`)

## 関連プラグイン

- **dev-core**: TDD開発フロー、リファクタリング

## ライセンス

MIT
