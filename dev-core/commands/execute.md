---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Write(*.ts,*.tsx), Edit, MultiEdit, Task(subagent_type:dev-core:tdd-practitioner), Task(subagent_type:dev-core:refactoring-specialist), Task(subagent_type:dev-core:quality-checker), Task(subagent_type:dev-core:security-auditor), Task(subagent_type:dev-core:build-error-resolver), Task(subagent_type:dev-core:code-reviewer)
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

### 5. code-reviewer（コードレビュー専門家）

**呼び出しタイミング**: 各イテレーションの実装完了後、フィードバックループ内で使用

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:code-reviewer")
prompt: |
  以下の変更をレビューしてください。

  ## 変更されたファイル
  [git diff --name-only の結果]

  ## diff 内容
  [git diff の結果]

  ## レビュー観点
  1. セキュリティ 🔒（A-F）
  2. 品質 ⭐（A-F）
  3. 慣例 📋（A-F）

  ## 出力形式（必ずこの形式で出力すること）
  REVIEW_RESULT:
    security: [A-F]
    quality: [A-F]
    convention: [A-F]
    approved: [true/false]
    issues:
      - file: [ファイルパス]
        line: [行番号]
        severity: [HIGH/MEDIUM/LOW]
        problem: [問題の説明]
        suggestion: [具体的な修正方法]

  ## 承認基準
  - 全カテゴリ B+ 以上 → approved: true
  - いずれかが B 未満 → approved: false（issues に具体的な修正指示を含める）
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

#### Phase 2: TDD 実装 + レビューループ

**⚠️ 重要**: 各イテレーションで **必ず tdd-practitioner エージェントを Task ツールで呼び出すこと**。

各イテレーションごとに以下のフィードバックループを実行：

##### Step 1: 実装

**tdd-practitioner を呼び出す**
- イテレーションの内容を prompt に含める
- エージェントが Red→Green→Refactor を実行
- **この時点ではコミットしない**（レビュー承認後にコミットする）
- prompt に以下を必ず含めること:
  `【重要】このイテレーションではコミット（Phase 4）を実行しないでください。コミットは別途レビュー承認後に行います。`

##### Step 2: 自動チェック

**quality-checker を呼び出す**
- lint, typecheck, test を実行
- 失敗した場合: tdd-practitioner に修正を依頼して Step 2 を再実行

##### Step 3: コードレビュー

**code-reviewer を呼び出す**
- Step 2 パス後、変更内容のレビューを依頼
- 出力から `approved` と `issues` を取得

##### Step 4: 判定と分岐

```
approved: true の場合:
  → Step 5（コミット）へ進む

approved: false の場合:
  → Step 4a（改善）へ進む
```

##### Step 4a: 改善（最大3ラウンド）

**tdd-practitioner を再度呼び出す**。prompt にレビューのフィードバックを含める：

```
Task(subagent_type: "dev-core:tdd-practitioner")
prompt: |
  コードレビューで以下の指摘を受けました。すべて修正してください。

  ## レビュー指摘事項（Round [N]/3）
  [code-reviewer の issues をここに貼る]

  ## 修正ルール
  - 指摘された問題をすべて解決すること
  - テストがグリーンのままであることを確認すること
  - 新たな問題を生まないこと
```

修正後、**Step 2 に戻る**（自動チェック → レビュー → 判定）。

**ラウンド上限**: 最大3ラウンド。3ラウンド目でもレビュー不合格の場合:
- 残課題をユーザーに報告し、判断を仰ぐ
- ユーザーが承認すればコミット、却下すれば手動対応

##### Step 5: コミット

レビュー承認後にコミットを実行：

```bash
# 変更されたファイルを個別にステージング（git add . は使わない）
git add [変更されたファイルを列挙]
git commit -m "feat([スコープ]): [イテレーション名の具体的な内容]"
```

- `git add .` ではなく、変更されたファイルを `git diff --name-only` で確認して個別に add する
- コミットメッセージはイテレーションの内容を具体的に記述する（例: `feat(auth): add JWT token validation`）
- `.env`、credentials 等の機密ファイルが含まれていないことを確認する

##### Step 6: セキュリティ監査（必要に応じて）

- 新規ファイル追加時
- API/認証関連のコード変更時
- security-auditor を呼び出して監査

##### フィードバックループの全体フロー

```
実装(tdd-practitioner)
  ↓
自動チェック(quality-checker) ←────┐
  ↓ パス                          │ 失敗時
レビュー(code-reviewer)            │
  ↓                               │
approved? ──NO──→ 改善(tdd-practitioner) ──→ 戻る
  │                    ↑
  │               最大3ラウンド
  ↓ YES
コミット
  ↓
次のイテレーションへ
```

### 5. 進捗レポート

各イテレーション完了時に進捗を報告：

```text
✅ Phase 1: Tidy First - 完了
⏳ Phase 2: TDD実装 + レビューループ
  ✅ Iteration 1: ユーザー検索機能
     🔨 実装 → ✅ 自動チェック → 📝 レビュー Round 1: B（品質）
     🔨 改善 → ✅ 自動チェック → 📝 レビュー Round 2: A（承認）
     ✅ コミット完了
  🔄 Iteration 2: フィルタリング機能
     🔨 実装 → ✅ 自動チェック → 📝 レビュー Round 1: 実行中
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
