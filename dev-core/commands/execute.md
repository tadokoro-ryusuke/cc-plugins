---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Write(*.ts,*.tsx), Edit, MultiEdit, Task(subagent_type:dev-core:tdd-practitioner), Task(subagent_type:dev-core:refactoring-specialist), Task(subagent_type:dev-core:quality-checker), Task(subagent_type:dev-core:security-auditor), Task(subagent_type:dev-core:build-error-resolver)
description: "作成済みの計画書に基づいてTDD実装を実行します"
argument-hint: "[計画書のパス] (例: docs/plans/task-user-auth.md)"
---

# TDD 計画の実行

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認すること。

フロントエンド実装の際は以下のスキルもロードすること：

- `frontend-design:frontend-design` - フロントエンド設計ガイドライン
- `ui-ux-pro-max:ui-ux-pro-max` - UI/UX デザイン DB 検索（スタイル、カラー、フォント選定時に検索を実行）

**スキルロード確認**: スキルをロードしたら「✅ スキルをロードしました: [スキル名]」と明示すること。

## 概要

作成済みの計画書（docs/plans/）に基づいて、TDD 実装を実行する。

## サブエージェント使用ガイド（必須）

このコマンドでは以下のサブエージェントを **Task ツール** で必ず呼び出すこと。直接実装せず、専門エージェントに委譲することで品質を確保する。

### 1. tdd-practitioner（TDD 実践専門家）

**呼び出しタイミング**: Phase 2 の各イテレーションで Red→Green→Refactor サイクルを実行する時

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:tdd-practitioner")
prompt: |
  以下のイテレーションを TDD サイクルで実装してください。

  ## コンテキスト
  計画書: [計画書パス]
  現在のイテレーション: [イテレーション名]

  ## 実装内容
  [計画書から該当イテレーションの内容をコピー]

  ## 期待する成果
  - 失敗するテストの作成（Red）
  - テストをパスする最小実装（Green）
  - コード品質の改善（Refactor）
  - 変更のコミット（Commit）
```

### 2. refactoring-specialist（リファクタリング専門家）

**呼び出しタイミング**: TDD サイクルの Refactor フェーズ、または tdd-practitioner から呼び出される

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:refactoring-specialist")
prompt: |
  以下のコードをリファクタリングしてください。

  ## 対象ファイル
  [リファクタリング対象のファイルパス]

  ## 観点
  - SOLID原則への準拠
  - DRY原則の適用
  - 命名の改善
  - useEffectの削除（可能な場合）

  ## 制約
  - テストは必ずグリーンを維持
  - 外部動作は変更しない
```

### 3. quality-checker（品質チェック専門家）

**呼び出しタイミング**: 各イテレーション完了後、およびコミット前に必ず実行

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:quality-checker")
prompt: |
  以下の変更に対して品質チェックを実行してください。

  ## 変更されたファイル
  [git diff --name-only の結果]

  ## チェック項目
  - lint実行
  - typecheck実行
  - テスト実行
  - コーディング規約の確認
```

### 4. security-auditor（セキュリティ監査専門家）

**呼び出しタイミング**: 新規ファイル追加時、API/認証関連のコード変更時

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:security-auditor")
prompt: |
  以下のコードのセキュリティ監査を実行してください。

  ## 対象ファイル
  [監査対象のファイルパス]

  ## 重点チェック項目
  - ハードコーディングの検出
  - 機密情報の漏洩リスク
  - 入力検証の適切性
```

## 実行フロー

### 1. 計画書の読み込み

```bash
# ファイルパスの場合
PLAN_FILE="$ARGUMENTS"

# 例: docs/plans/task-user-auth.md
```

計画書を読み込み、内容を把握すること。

### 2. 実装前の確認

- 計画書の内容を表示
- 現在のブランチを確認
- 未コミットの変更がないか確認

### 3. ブランチの準備

```bash
# 計画書名からブランチ名を生成（例: task-user-auth → feature/user-auth）
BRANCH_NAME=$(basename "$PLAN_FILE" .md | sed 's/^task-//' | sed 's/^issue-//')

# ブランチが存在しない場合は作成
git checkout -b feature/$BRANCH_NAME || git checkout feature/$BRANCH_NAME
```

### 4. TDD サイクルの実行

計画書に記載された各イテレーションを順番に実行。

#### Phase 1: Tidy First（事前整理）

- 計画書の「Phase 1」セクションのタスクを実行
- 既存コードのリファクタリング
  - プロジェクト設定ファイル（.claude/\*.local.md）を確認し、追加ツールが指定されている場合はそれを活用すること
- 依存関係の整理

#### Phase 2: TDD 実装

**⚠️ 重要**: 各イテレーションで **必ず tdd-practitioner エージェントを Task ツールで呼び出すこと**。

各イテレーションごとに以下を実行：

1. **tdd-practitioner を呼び出す**
   - イテレーションの内容を prompt に含める
   - エージェントが Red→Green→Refactor→Commit を実行

2. **quality-checker を呼び出す**
   - イテレーション完了後に品質チェック
   - 問題があれば修正

3. **必要に応じて security-auditor を呼び出す**
   - 新規ファイル追加時
   - API/認証関連のコード変更時

### 5. 進捗レポート

各フェーズ完了時に進捗を報告：

```text
✅ Phase 1: Tidy First - 完了
⏳ Phase 2: TDD実装
  ✅ Iteration 1: ユーザー検索機能 - 完了
  🔄 Iteration 2: フィルタリング機能 - 実行中
  ⏸️ Iteration 3: ページネーション - 待機中
```

### 6. 最終確認と PR 作成

すべての実装が完了したら：

1. **最終テスト実行**（quality-checker を使用）

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

- 現在の進捗を記録（`/dev-core:checkpoint --create` を推奨）
- 次回は同じコマンドで続きから再開可能

## エラーハンドリング

- テスト失敗時: 詳細なエラー内容を表示
- lint/typecheck 失敗時: quality-checker エージェントで修正
- ビルドエラー時: build-error-resolver エージェントで自動修復
- コンフリクト発生時: 解決方法を提案

## 関連コマンド

- `/dev-core:verify`: 実装完了後の 6 段階検証
- `/dev-core:checkpoint --create`: 進捗スナップショット作成
- `/dev-core:code-review`: コードレビュー実行

計画に忠実に、サブエージェントを活用して着実に TDD 実装を進めること。
