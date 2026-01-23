---
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Read, Edit, Grep, Glob, Task(subagent_type:dev-core:build-error-resolver)
description: "ビルドエラーとTypeScriptエラーを自動修復します。最小限のdiffで高速修正"
argument-hint: "[--verbose 詳細出力]"
---

# ビルドエラー自動修復

ビルドエラーと TypeScript エラーを検出し、最小限の変更で修復します。

## 実行フロー

### 1. エラー検出

```bash
pnpm build 2>&1 || npm run build 2>&1
pnpm typecheck 2>&1 || npx tsc --noEmit 2>&1
```

### 2. build-error-resolver エージェント呼び出し

```
Task(subagent_type: "dev-core:build-error-resolver")
prompt: |
  以下のビルドエラーを最小限の変更で修復してください。

  【エラー内容】
  [ビルドエラーの出力]

  【制約】
  - 最小限の diff で修正
  - 既存のロジックを変更しない
  - 型安全性を維持
```

### 3. 修復の検証

修復後に再度ビルドを実行して確認：

```bash
pnpm build 2>&1
pnpm typecheck 2>&1
```

## 出力形式

```
【ビルドエラー修復】

🔍 検出されたエラー: 3 件

❌ Error 1: src/features/auth/login.ts:15
   Type 'string' is not assignable to type 'number'
   → 修正: 型を number に変更

❌ Error 2: src/components/Button.tsx:8
   Property 'onClick' is missing
   → 修正: onClick プロパティを追加

❌ Error 3: src/utils/format.ts:22
   Cannot find module './helper'
   → 修正: インポートパスを修正

✅ 修復完了: 3/3 エラー

【変更ファイル】
   M src/features/auth/login.ts (+1, -1)
   M src/components/Button.tsx (+2, -0)
   M src/utils/format.ts (+1, -1)
```

## 修復戦略

1. **型エラー**: 正しい型に変更、または型アサーションを追加
2. **インポートエラー**: パスを修正、または不足モジュールをインストール
3. **プロパティエラー**: 不足プロパティを追加
4. **構文エラー**: 構文を修正

## 使用例

```bash
# ビルドエラーを自動修復
/dev-core:build-fix

# 詳細出力
/dev-core:build-fix --verbose
```
