---
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Read, Grep, Glob
description: "テストカバレッジを分析し、改善提案を行います。未カバー部分を特定"
argument-hint: "[--threshold 80] [--report レポート生成]"
---

# テストカバレッジ分析

テストカバレッジを測定し、改善提案を行います。

## 実行フロー

### 1. カバレッジ測定

```bash
pnpm test --coverage 2>&1 || npm test -- --coverage 2>&1
```

### 2. カバレッジレポート解析

Jest のカバレッジレポートを解析：

- Statements（文）
- Branches（分岐）
- Functions（関数）
- Lines（行）

### 3. 改善提案

未カバー部分を特定し、テスト追加を提案。

## 出力形式

```
【テストカバレッジ分析】

📊 全体カバレッジ: 82%

| メトリクス   | カバレッジ | 目標 | 状態 |
|-------------|-----------|------|------|
| Statements  | 85%       | 80%  | ✅   |
| Branches    | 75%       | 80%  | ⚠️   |
| Functions   | 88%       | 80%  | ✅   |
| Lines       | 82%       | 80%  | ✅   |

🔍 未カバー部分:

1. src/features/auth/login.ts
   Line 45-52: エラーハンドリング分岐
   → 異常系テストを追加

2. src/utils/format.ts
   Line 23: null チェック分岐
   → null 入力テストを追加

3. src/api/users.ts
   Function: deleteUser
   → 削除機能のテストを追加

【改善提案】
1. [HIGH] エラーハンドリングのテスト追加 (+5%)
2. [MEDIUM] null チェックのテスト追加 (+2%)
3. [LOW] deleteUser のテスト追加 (+3%)

📈 提案実施後の予測カバレッジ: 92%
```

## オプション

- `--threshold 80`: 目標カバレッジ（デフォルト: 80）
- `--report`: HTML レポートを生成
- `--file`: 特定ファイルのみ分析

## 使用例

```bash
# カバレッジ分析
/dev-core:test-coverage

# 目標 90% で分析
/dev-core:test-coverage --threshold 90

# レポート生成
/dev-core:test-coverage --report

# 特定ファイル
/dev-core:test-coverage --file src/features/auth/
```
