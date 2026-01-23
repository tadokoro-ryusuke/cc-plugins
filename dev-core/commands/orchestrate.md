---
allowed-tools: Task, Read, Write, Bash(git:*), TodoWrite
description: "複数のエージェントを順序実行してワークフローを自動化します。plan → tdd → review → security の完全パイプライン"
argument-hint: "[GitHub Issue URL/番号] [--parallel 並列実行] [--skip-plan 計画スキップ]"
---

# ワークフローオーケストレーション

複数のエージェントを順序実行し、開発ワークフローを自動化します。

## 標準パイプライン

### Phase 1: Planning（計画）

`--skip-plan` が指定されていない場合：

```
Task(subagent_type: "dev-core:task-planner")
prompt: |
  Issue $ARGUMENTS に基づいて実装計画を作成してください。
  - BDD シナリオの検証と補完
  - Tidy First 事前整理タスク
  - TDD サイクル計画
  - アーキテクチャ設計
```

### Phase 2: Implementation（実装）

TDD サイクルを実行：

```
Task(subagent_type: "dev-core:tdd-practitioner")
prompt: |
  計画に基づいて TDD サイクルを実行してください。
  Red → Green → Refactor → Commit
```

### Phase 3: Quality（品質）

`--parallel` が指定された場合は並列実行：

```
# 並列実行
Task(subagent_type: "dev-core:quality-checker")
Task(subagent_type: "dev-core:security-auditor")
Task(subagent_type: "dev-core:code-reviewer")
```

### Phase 4: Documentation（ドキュメント）

```
Task(subagent_type: "dev-core:doc-updater")
prompt: |
  変更に基づいてドキュメントを更新してください。
```

## カスタムパイプライン

引数でカスタムパイプラインを指定可能：

```
/dev-core:orchestrate --pipeline "tdd,quality,security"
```

## 出力形式

```
【オーケストレーション結果】

📋 Phase 1: Planning
   ✅ task-planner 完了
   📄 計画書: docs/plans/issue-123.md

🔨 Phase 2: Implementation
   ✅ tdd-practitioner 完了
   📝 コミット: 5 件

✅ Phase 3: Quality
   ✅ quality-checker: パス
   ✅ security-auditor: パス
   ✅ code-reviewer: 問題なし

📚 Phase 4: Documentation
   ✅ doc-updater 完了
   📄 更新: README.md, API.md

【次のステップ】
- PR を作成: gh pr create
```

## オプション

- `--parallel`: Phase 3 を並列実行
- `--skip-plan`: 計画フェーズをスキップ（既存計画がある場合）
- `--pipeline`: カスタムパイプライン指定
- `--dry-run`: 実行せずに計画を表示

## 使用例

```bash
# Issue から完全パイプライン
/dev-core:orchestrate #123

# 既存計画から実装
/dev-core:orchestrate --skip-plan docs/plans/issue-123.md

# カスタムパイプライン
/dev-core:orchestrate --pipeline "quality,security"
```
