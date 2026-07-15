---
name: code-review
description: "コードレビューを実行する。セキュリティ・品質・慣例の3段階評価。PR・コミット・特定ファイルのレビュー依頼時に /dev-core:code-review で起動する。"
argument-hint: "[PR番号/#123] [ファイルパス] [--strict 厳格モード]"
allowed-tools: Read, Grep, Glob, Task(subagent_type:dev-core:code-reviewer)
---

# コードレビュー

コードを 3 つの観点（セキュリティ/品質/慣例）で評価し、改善提案を行う。評価基準・出力形式の正本は `dev-core:code-reviewer` エージェント。

## 実行フロー

### 1. レビュー対象の特定

引数に応じて対象を特定する:

- `#123`: PR 番号 → `gh pr diff 123`
- ファイルパス → 指定ファイル
- なし → 最新のコミット変更（`git diff HEAD~1`）

### 2. code-reviewer エージェント呼び出し

Task ツールで `dev-core:code-reviewer` に diff と評価観点を渡す:

1. **セキュリティ** 🔒: 脆弱性、機密情報漏洩、入力検証
2. **品質** ⭐: SOLID、DRY、命名、複雑度、保守性
3. **慣例** 📋: アーキテクチャ準拠（FSD/CA/DDD）、コミット形式、ドキュメント

`--strict` 指定時は厳格モード（警告も指摘対象）であることを伝える。

### 3. 結果の報告

code-reviewer の評価（A〜F スケール + P0-P3 severity付き改善提案）をそのまま提示する。**改善提案には必ず実在するファイル:行番号と具体的な問題・解決策を含める**（エージェントの出力にそれが欠けていれば差し戻す）。

## 使用例

```
/dev-core:code-review #123
/dev-core:code-review src/features/auth/
/dev-core:code-review --strict
```
