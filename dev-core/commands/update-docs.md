---
allowed-tools: Bash(git:*), Read, Write, Grep, Glob, Task(subagent_type:dev-core:doc-updater)
description: "ドキュメントを自動更新します。コード変更に基づいてREADME、API仕様、JSDocを更新"
argument-hint: "[--readme] [--api] [--jsdoc] [--all]"
---

# ドキュメント自動更新

コード変更に基づいてドキュメントを自動更新します。

## 実行フロー

### 1. 変更の検出

```bash
git diff --name-only HEAD~1 2>&1
```

### 2. doc-updater エージェント呼び出し

```
Task(subagent_type: "dev-core:doc-updater")
prompt: |
  以下の変更に基づいてドキュメントを更新してください。

  【変更ファイル】
  [変更ファイル一覧]

  【更新対象】
  $ARGUMENTS (--readme, --api, --jsdoc, --all)
```

## 更新対象

### README 更新（--readme）

- 新機能の説明追加
- インストール手順の更新
- 使用例の追加

### API 仕様更新（--api）

- エンドポイントの追加/変更
- リクエスト/レスポンス形式
- エラーコードの更新

### JSDoc 更新（--jsdoc）

- 関数のドキュメント
- 型定義の説明
- 使用例の追加

## 出力形式

```
【ドキュメント更新】

📝 変更検出: 8 ファイル

📚 README.md
   ✅ 新機能セクション追加
   ✅ 使用例更新

📖 docs/api/users.md
   ✅ POST /users エンドポイント追加
   ✅ レスポンス形式更新

📄 JSDoc
   ✅ src/features/auth/login.ts: 3 関数
   ✅ src/utils/format.ts: 2 関数

【更新完了】
   更新ファイル: 5
   追加行数: +120
```

## 使用例

```bash
# すべてのドキュメントを更新
/dev-core:update-docs --all

# README のみ
/dev-core:update-docs --readme

# API 仕様のみ
/dev-core:update-docs --api

# JSDoc のみ
/dev-core:update-docs --jsdoc
```
