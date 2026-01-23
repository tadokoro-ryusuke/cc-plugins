---
allowed-tools: Bash(git:*), Read, Grep, Glob, Task(subagent_type:dev-core:code-reviewer)
description: "コードレビューを実行します。セキュリティ、品質、慣例の3段階評価"
argument-hint: "[PR番号/#123] [ファイルパス] [--strict 厳格モード]"
---

# コードレビュー

コードを 3 段階で評価し、改善提案を行います。

## 実行フロー

### 1. レビュー対象の特定

引数に応じて対象を特定：

- `#123`: PR 番号 → `gh pr diff 123`
- ファイルパス → 指定ファイル
- なし → 最新のコミット変更

### 2. code-reviewer エージェント呼び出し

```
Task(subagent_type: "dev-core:code-reviewer")
prompt: |
  以下のコード変更をレビューしてください。

  【変更内容】
  [diff 内容]

  【評価観点】
  1. セキュリティ: 脆弱性、機密情報漏洩
  2. 品質: コーディング規約、保守性
  3. 慣例: プロジェクト標準との整合性

  【厳格モード】
  $STRICT_MODE
```

## 3 段階評価

### 1. セキュリティ評価 🔒

- 入力検証の有無
- 機密情報のハードコード
- SQL インジェクション
- XSS 脆弱性

### 2. 品質評価 ⭐

- SOLID 原則の遵守
- DRY 原則
- 適切な命名
- コード複雑度

### 3. 慣例評価 📋

- プロジェクト標準との整合性
- ファイル構造（FSD）
- コミットメッセージ形式
- ドキュメント

## 出力形式

```
【コードレビュー結果】

📊 総合評価: B+

🔒 セキュリティ: A
   ✅ 入力検証: 適切
   ✅ 機密情報: 問題なし
   ⚠️ 警告: rate limiting 未実装

⭐ 品質: B
   ✅ SOLID: 概ね準拠
   ⚠️ DRY: 重複コード 2 箇所
   ✅ 命名: 明確

📋 慣例: A
   ✅ FSD: 適切な配置
   ✅ コミット: 形式準拠

【改善提案】
1. [HIGH] src/api/users.ts:45
   重複コードを共通関数に抽出

2. [MEDIUM] src/features/auth/login.ts:78
   エラーメッセージを定数化

3. [LOW] src/utils/format.ts:12
   JSDoc コメントを追加
```

## 使用例

```bash
# PR レビュー
/dev-core:code-review #123

# ファイルレビュー
/dev-core:code-review src/features/auth/

# 厳格モード
/dev-core:code-review --strict
```
