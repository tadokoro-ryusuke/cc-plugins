# Agent Usage Rules

## エージェント使用ガイド

### 計画フェーズ

- **task-planner**: Issue から詳細な実装計画を作成

### 実装フェーズ

- **tdd-practitioner**: TDD サイクルを実行
- **architecture-guide**: アーキテクチャ決定をサポート

### 品質フェーズ

- **quality-checker**: lint/typecheck/テスト実行
- **security-auditor**: セキュリティ監査
- **code-reviewer**: コードレビュー

### 改善フェーズ

- **refactoring-specialist**: リファクタリング実行

### サポートフェーズ

- **build-error-resolver**: ビルドエラー修正
- **doc-updater**: ドキュメント更新
- **e2e-runner**: E2E テスト実行

## 並列実行

複数の独立したタスクは並列実行可能：

```
Task(subagent_type: "dev-core:quality-checker")
Task(subagent_type: "dev-core:security-auditor")
```

## マルチパースペクティブ分析

重要な決定には複数のエージェントの視点を活用：

1. **architect**: 技術的な観点
2. **security-auditor**: セキュリティの観点
3. **code-reviewer**: 保守性の観点

## エージェント選択基準

| タスク               | 推奨エージェント        |
| -------------------- | ----------------------- |
| 新機能計画           | task-planner            |
| TDD 実装             | tdd-practitioner        |
| コード改善           | refactoring-specialist  |
| 品質チェック         | quality-checker         |
| セキュリティ確認     | security-auditor        |
| アーキテクチャ相談   | architecture-guide      |
| ビルドエラー         | build-error-resolver    |
| ドキュメント         | doc-updater             |
| E2E テスト           | e2e-runner              |
| コードレビュー       | code-reviewer           |
