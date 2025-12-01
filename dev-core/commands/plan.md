---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Write(*.md), Task(subagent_type:task-planner)
description: "GitHub IssueからTDD計画を立案し、実装まで進めます。t-wada式TDD、FSD、Clean Architecture、DDDに基づいた開発を行います"
argument-hint: "[GitHub Issue URL または Issue番号]"
---

# TDD 計画立案と実装

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認してください。
フロントエンド実装の際は `frontend-design` スキルをロードしてください。

## 概要

$ARGUMENTS で指定された GitHub Issue を分析し、プロジェクトの開発方針に沿った作業計画を立案・実行します。

## 実行フロー

### 1. Issue 情報の取得

```bash
# Issue番号の場合
gh issue view $ARGUMENTS

# URLの場合はIssue番号を抽出して実行
```

### 2. 既存コード・ドキュメントの調査

- プロジェクト設定ファイル（.claude/*.local.md）を確認し、追加ツールが指定されている場合はそれを活用してください
- プロジェクト構造の確認
- 関連モジュールの特定
- 既存テストの確認

### 3. task-planner エージェントによる計画立案

作業計画立案専門家エージェントを呼び出し、以下を含む詳細な計画を作成：

- **BDD シナリオの検証と補完**
- **Tidy First**: 事前整理タスク
- **TDD サイクル**: Red→Green→Refactor→Commit
- **アーキテクチャ設計**: FSD + Clean Architecture + DDD
- **Perfect Commit**: 細かいコミット単位

### 4. 計画のレビューと確認

生成された計画を表示し、ユーザーに確認を求めます：

```
📋 作業計画が完成しました！

[計画の要約を表示]

この計画でよろしいですか？ (y/n)
必要に応じて修正点をお伝えください。
```

### 5. 計画書の保存

```bash
# 計画書を保存
mkdir -p ./docs/plans
echo "[計画内容]" > ./docs/plans/issue-$ISSUE_NUMBER.md
git add ./docs/plans/issue-$ISSUE_NUMBER.md
git commit -m "docs: Add implementation plan for issue #$ISSUE_NUMBER"
```

### 6. 実装の開始（確認後）

ユーザーの承認を得たら、計画に従って実装を開始：

1. **ブランチの作成**

   ```bash
   git checkout -b feature/issue-$ISSUE_NUMBER
   ```

2. **TDD サイクルの実行**

   - サイクルに応じて tdd-practitioner, refactoring-specialist エージェントを使用

   - 各イテレーションごとに進捗を報告
   - テスト実行結果を表示
   - コミットメッセージの確認

3. **品質チェック**

   プロジェクト設定に従って lint、typecheck、test を実行

4. **Pull Request 作成**
   ```bash
   gh pr create \
     --title "[実装内容]" \
     --body "[PR説明]" \
     --base main
   ```

## プロジェクト固有の考慮事項

- **TDD**: t-wada 式の厳格な実践
- **アーキテクチャ**: FSD + Clean Architecture + DDD
- **コーディング規約**: プロジェクトのガイドラインに準拠
- **品質管理**: lint、typecheck 必須
- **コミット**: 意味のある単位で細かく

## エラーハンドリング

- Issue が見つからない場合 → Issue 番号の確認を促す
- 権限エラー → GitHub 認証の確認
- テスト失敗 → 詳細なエラー内容を表示し、修正方法を提案

計画立案から実装、PR 作成まで、一貫したサポートを提供します。

ultrathink
