# GitHub Tools Plugin

GitHub連携ワークフローを支援するClaude Codeプラグインです。

## 機能

### コマンド（2個）

| コマンド | 説明 |
|--------|------|
| `/github-tools:pr` | 現在のブランチからPull Requestを作成 |
| `/github-tools:docs` | ドキュメント更新 |

## インストール

```bash
# Claude Codeでプラグインを有効化
cc --plugin-dir /path/to/github-tools
```

## 使用例

### 新機能開発フロー（dev-coreプラグインと連携）

```bash
# 1. 要件整理 → 計画 → Issue作成
/dev-core:task ユーザー認証機能を追加

# 2. TDD実装
/dev-core:execute docs/plans/task-user-auth.md

# 3. Pull Request作成
/github-tools:pr
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

## 前提条件

- GitHub CLI (`gh`) がインストールされていること
- GitHub認証が完了していること (`gh auth login`)

## 関連プラグイン

- **dev-core**: TDD開発フロー、要件整理、Issue作成

## ライセンス

MIT
