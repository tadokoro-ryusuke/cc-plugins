---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Write(*.ts,*.tsx), Edit, MultiEdit, Task(subagent_type:tdd-practitioner), Task(subagent_type:refactoring-specialist), Task(subagent_type:quality-checker), Task(subagent_type:security-auditor)
description: "作成済みの計画書に基づいてTDD実装を実行します"
argument-hint: "[計画書のパス または Issue番号]"
---

# TDD 計画の実行

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認してください。
フロントエンド実装の際は `frontend-design:frontend-design` スキルをロードしてください。

## 概要

作成済みの計画書（docs/plans/）に基づいて、TDD 実装を実行します。

## 実行フロー

### 1. 計画書の読み込み

```bash
# Issue番号の場合
PLAN_FILE="./docs/plans/issue-$ARGUMENTS.md"

# ファイルパスの場合
PLAN_FILE="$ARGUMENTS"
```

### 2. 実装前の確認

- 計画書の内容を表示
- 現在のブランチを確認
- 未コミットの変更がないか確認

### 3. ブランチの準備

```bash
# Issue番号を抽出
ISSUE_NUMBER=$(basename "$PLAN_FILE" .md | sed 's/issue-//')

# ブランチが存在しない場合は作成
git checkout -b feature/issue-$ISSUE_NUMBER || git checkout feature/issue-$ISSUE_NUMBER
```

### 4. TDD サイクルの実行

計画書に記載された各イテレーションを順番に実行：

#### Phase 1: Tidy First（事前整理）

- 計画書の「Phase 1」セクションのタスクを実行
- 既存コードのリファクタリング
  - プロジェクト設定ファイル（.claude/\*.local.md）を確認し、追加ツールが指定されている場合はそれを活用してください
- 依存関係の整理

#### Phase 2: TDD 実装

**tdd-practitioner エージェントを使用してください。**

各イテレーションごとに：

1. **Red 🔴**: テストの作成

   - 失敗するテストを作成
   - テスト実行で失敗を確認

2. **Green 🟢**: 最小実装

   - テストをパスする最小限のコード
   - テスト実行で成功を確認

3. **Refactor 🔨**: 品質改善

   - コード品質の向上
   - テストが依然としてパスすることを確認

4. **Commit ✅**: 変更を保存
   ```bash
   git add .
   git commit -m "[コミットメッセージ]"
   ```

### 5. 品質チェック

各イテレーション後に自動実行：

quality-checker エージェントを使用

プロジェクト設定に従って lint、typecheck、test を実行

### 6. 進捗レポート

各フェーズ完了時に進捗を報告：

```text
✅ Phase 1: Tidy First - 完了
⏳ Phase 2: TDD実装
  ✅ Iteration 1: ユーザー検索機能 - 完了
  🔄 Iteration 2: フィルタリング機能 - 実行中
  ⏸️ Iteration 3: ページネーション - 待機中
```

### 7. 最終確認と PR 作成

すべての実装が完了したら：

1. **最終テスト実行**

   ```bash
   # テストとカバレッジ確認
   ```

2. **変更内容の確認**

   ```bash
   git log --oneline
   git diff main...HEAD
   ```

3. **Pull Request 作成**

   ```bash
   gh pr create \
     --title "feat: [機能名] (#$ISSUE_NUMBER)" \
     --body "[計画書の内容を基にPR説明を生成]" \
     --base main
   ```

## 中断と再開

実装を中断する場合：

- 現在の進捗を記録
- 次回は同じコマンドで続きから再開可能

## エラーハンドリング

- テスト失敗時: 詳細なエラー内容を表示
- lint/typecheck 失敗時: 自動修正を試みる
- コンフリクト発生時: 解決方法を提案

計画に忠実に、着実に TDD 実装を進めます。
