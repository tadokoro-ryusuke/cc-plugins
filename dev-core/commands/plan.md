---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Write(*.md), Task(subagent_type:dev-core:task-planner)
description: "GitHub IssueからTDD計画を立案し、実装まで進めます。t-wada式TDD、FSD、Clean Architecture、DDDに基づいた開発を行います"
argument-hint: "[GitHub Issue URL または Issue番号]"
---

# TDD 計画立案と実装

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認すること。
フロントエンド実装の際は `frontend-design:frontend-design` スキルをロードすること。

## 概要

$ARGUMENTS で指定された GitHub Issue を分析し、プロジェクトの開発方針に沿った作業計画を立案・実行する。

## サブエージェント使用ガイド（必須）

このコマンドでは **task-planner エージェント** を Task ツールで必ず呼び出すこと。計画立案を専門エージェントに委譲することで、高品質な計画を作成する。

### task-planner（作業計画立案専門家）

**呼び出しタイミング**: Issue 情報と既存コードの調査が完了した後

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:task-planner")
prompt: |
  以下の GitHub Issue に基づいて、詳細な実装計画を作成してください。

  ## Issue 情報
  Issue番号: #[ISSUE_NUMBER]
  タイトル: [Issue タイトル]
  内容:
  [Issue 本文]

  ## コードベース情報
  プロジェクト構造: [調査結果]
  関連モジュール: [特定されたモジュール]
  既存テスト: [テストの状況]

  ## 計画に含める内容
  - BDDシナリオの検証と補完
  - Tidy First: 事前整理タスク
  - TDDサイクル: Red→Green→Refactor→Commit
  - アーキテクチャ設計: FSD + Clean Architecture + DDD
  - Perfect Commit戦略

  ## 出力形式
  docs/plans/issue-[ISSUE_NUMBER].md に保存可能な形式
```

**エージェントの成果物**:

- BDD シナリオの検証と補完
- Tidy First: 事前整理タスク
- TDD サイクル: Red→Green→Refactor→Commit
- アーキテクチャ設計: FSD + Clean Architecture + DDD
- Perfect Commit 戦略

## 実行フロー

### 1. Issue 情報の取得

```bash
# Issue番号の場合
gh issue view $ARGUMENTS

# URLの場合はIssue番号を抽出して実行
```

Issue の内容を把握し、要件を理解すること。

### 2. 既存コード・ドキュメントの調査

- プロジェクト設定ファイル（.claude/\*.local.md）を確認し、追加ツールが指定されている場合はそれを活用すること
- プロジェクト構造の確認
- 関連モジュールの特定
- 既存テストの確認

### 3. task-planner エージェントで計画立案

**⚠️ 重要**: 必ず Task ツールで task-planner エージェントを呼び出すこと。

task-planner エージェントに以下の情報を渡す：

- Issue 情報（番号、タイトル、本文）
- コードベース情報（プロジェクト構造、関連モジュール、既存テスト）
- 計画に含めるべき内容

エージェントが以下を含む詳細な計画を作成：

- BDD シナリオの検証と補完
- Tidy First: 事前整理タスク
- TDD サイクル: Red→Green→Refactor→Commit
- アーキテクチャ設計: FSD + Clean Architecture + DDD
- Perfect Commit 戦略

### 4. 計画のレビューと確認

生成された計画を表示し、ユーザーに確認を求める：

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

ユーザーの承認を得たら、計画に従って実装を開始。

**⚠️ 重要**: 実装フェーズでは `/dev-core:execute` コマンドを使用すること。
execute コマンドは以下のエージェントを使用して実装を行う：

- tdd-practitioner: TDD サイクルの実行
- refactoring-specialist: コードのリファクタリング
- quality-checker: 品質チェック
- security-auditor: セキュリティ監査

実装を開始する場合：

```
/dev-core:execute ./docs/plans/issue-$ISSUE_NUMBER.md
```

または、この場で実装を継続する場合：

1. **ブランチの作成**

   ```bash
   git checkout -b feature/issue-$ISSUE_NUMBER
   ```

2. **TDD サイクルの実行**

   **注意**: 以下のエージェントは `/dev-core:execute` コマンドで使用すること。
   このコマンドでは計画立案に集中する。
   - tdd-practitioner: TDD サイクル（Red→Green→Refactor→Commit）
   - refactoring-specialist: コード品質改善
   - quality-checker: lint、typecheck、テスト実行
   - security-auditor: セキュリティチェック

3. **Pull Request 作成**
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

## ワークフロー全体像

```
/dev-core:plan → 計画立案（task-planner エージェント使用）
       ↓
/dev-core:execute → TDD 実装（tdd-practitioner, quality-checker 等使用）
       ↓
/dev-core:refactor → 追加リファクタリング（必要に応じて）
```

計画立案から実装、PR 作成まで、一貫したサポートを提供する。task-planner エージェントを活用して高品質な計画を作成すること。
