---
allowed-tools: Bash(gh:*), Bash(git:*), Read(*.md,*.ts,*.tsx), Write(*.md), Task(subagent_type:dev-core:task-planner), Task(subagent_type:dev-core:issue-creator)
description: "対話型で要件を整理し、TDD計画を立案、GitHub Issueを作成します"
argument-hint: "[タスクの概要]"
---

# 対話型タスク作成 → TDD 計画 → Issue 化

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認すること。

## 概要

$ARGUMENTS に基づいて、以下のフローを実行する:

1. 対話型で要件を整理
2. BDD シナリオを作成
3. TDD 計画を立案（task-planner エージェント使用）
4. 計画書を保存
5. GitHub Issue を作成（issue-creator エージェント使用）
6. 実装開始の確認

## サブエージェント使用ガイド（必須）

このコマンドでは以下のエージェントを Task ツールで必ず呼び出すこと:

### task-planner（作業計画立案専門家）

**呼び出しタイミング**: 要件整理と BDD シナリオ作成が完了した後

### issue-creator（GitHub Issue 作成専門家）

**呼び出しタイミング**: 計画書の保存が完了した後

---

## 実行フロー

### Phase 1: 対話型要件整理

$ARGUMENTS を元に、以下の項目について対話的に確認する:

#### 1.1 基本情報

```
タスクタイトル: [簡潔で明確なタイトル]
概要: [何を実現したいか（1-2文）]
背景: [なぜこの機能が必要か]
```

#### 1.2 ユーザーストーリー

```
[ペルソナ]として、
[機能/アクション]したい、
なぜなら[理由/価値]だから。
```

#### 1.3 受け入れ条件

機能が完成したと判断できる条件をリストアップ:

- [ ] 条件 1
- [ ] 条件 2
- [ ] 条件 3

### Phase 2: BDD シナリオ作成

要件を元に BDD シナリオを作成:

```gherkin
Feature: [機能名]

  Scenario: [シナリオ名]
    Given [前提条件]
    When [アクション]
    Then [期待結果]

  Scenario: [別のシナリオ]
    Given [前提条件]
    When [アクション]
    Then [期待結果]
```

複数のシナリオ（正常系、異常系、境界値）を網羅すること。

### Phase 3: task-planner で TDD 計画立案

**⚠️ 重要**: 必ず Task ツールで task-planner エージェントを呼び出すこと。

```
Task(subagent_type: "dev-core:task-planner")
prompt: |
  以下の要件に基づいて、詳細な TDD 実装計画を作成してください。

  ## 要件情報
  タイトル: [タイトル]
  概要: [概要]
  背景: [背景]

  ## ユーザーストーリー
  [ユーザーストーリー]

  ## 受け入れ条件
  [受け入れ条件リスト]

  ## BDD シナリオ
  [作成した BDD シナリオ]

  ## コードベース情報
  プロジェクト構造: [調査結果]
  関連モジュール: [特定されたモジュール]
  既存テスト: [テストの状況]

  ## 計画に含める内容
  - BDD シナリオの検証と補完
  - Tidy First: 事前整理タスク
  - TDD サイクル: Red→Green→Refactor→Commit
  - アーキテクチャ設計: FSD + Clean Architecture + DDD
  - Perfect Commit 戦略

  ## 出力形式
  docs/plans/ に保存可能な Markdown 形式
```

### Phase 4: 計画書の保存

```bash
# タイトルから slug を生成（例: "ユーザー認証機能" → "user-auth"）
mkdir -p ./docs/plans
# 計画書を保存
echo "[計画内容]" > ./docs/plans/task-[slug].md
```

計画書には以下を含める:
- 要件情報（タイトル、概要、背景）
- ユーザーストーリー
- 受け入れ条件
- BDD シナリオ
- TDD 実装計画
- アーキテクチャ設計

### Phase 5: issue-creator で GitHub Issue 作成

**⚠️ 重要**: 必ず Task ツールで issue-creator エージェントを呼び出すこと。

```
Task(subagent_type: "dev-core:issue-creator")
prompt: |
  以下の計画書から GitHub Issue を作成してください。

  計画書パス: docs/plans/task-[slug].md

  計画書の内容:
  [計画書の内容を渡す]
```

### Phase 6: 実装開始の確認

Issue 作成完了後、ユーザーに確認:

```
GitHub Issue を作成しました:
- Issue: #[番号] [タイトル]
- URL: [Issue URL]
- 計画書: docs/plans/task-[slug].md

実装を開始しますか？
- Yes → `/dev-core:execute docs/plans/task-[slug].md` を実行
- No → 後で実装する場合は上記コマンドを使用してください
```

---

## プロジェクト固有の考慮事項

- **TDD**: t-wada 式の厳格な実践（Red→Green→Refactor→Commit）
- **アーキテクチャ**: FSD + Clean Architecture + DDD
- **コーディング規約**: プロジェクトのガイドラインに準拠
- **品質管理**: lint、typecheck 必須
- **コミット**: 意味のある単位で細かく

## エラーハンドリング

- 要件が不明確な場合 → 追加の質問で明確化
- コードベース調査でエラー → 手動で情報を収集
- Issue 作成失敗 → GitHub CLI の認証確認を促す

## ワークフロー全体像

```
/dev-core:task [概要]
       ↓
対話型要件整理
       ↓
BDD シナリオ作成
       ↓
task-planner で TDD 計画立案
       ↓
docs/plans/task-*.md に保存
       ↓
issue-creator で GitHub Issue 作成
       ↓
/dev-core:execute で実装開始（オプション）
```

対話から実装開始まで、一貫したサポートを提供する。
