---
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Bash(git:*), Bash(npx:*), Read, Grep, Glob
description: "6段階検証を実行します。build → type → lint → test → security → diff の順に検証し、問題を報告します"
argument-hint: "[--fix 自動修正] [--skip-test テストスキップ]"
---

# 6 段階検証（Verify）

コードベースの品質を 6 段階で検証します。

## 検証ステップ

### Step 1: Build Check 🏗️

```bash
pnpm build 2>&1 || npm run build 2>&1 || yarn build 2>&1
```

ビルドが成功することを確認。

### Step 2: Type Check 📝

```bash
pnpm typecheck 2>&1 || npx tsc --noEmit 2>&1
```

TypeScript の型エラーがないことを確認。

### Step 3: Lint Check 🔍

```bash
pnpm lint 2>&1 || npm run lint 2>&1
```

`--fix` オプションが指定された場合は自動修正：

```bash
pnpm lint --fix 2>&1
```

### Step 4: Test Check ✅

`--skip-test` が指定されていない場合：

```bash
pnpm test 2>&1 || npm test 2>&1
```

テストカバレッジも確認（可能な場合）：

```bash
pnpm test --coverage 2>&1
```

### Step 5: Security Check 🔒

security-auditor エージェントを呼び出してセキュリティチェック：

- ハードコーディング検出
- 機密情報漏洩チェック
- 依存関係の脆弱性（npm audit）

```bash
npm audit --audit-level=moderate 2>&1
```

### Step 6: Diff Check 📊

最後のコミットからの変更を確認：

```bash
git diff --stat HEAD~1 2>&1
git diff HEAD~1 --name-only 2>&1
```

変更が適切にコミットされているか確認。

## 出力形式

```
【6 段階検証結果】

✅ Step 1: Build    - パス
✅ Step 2: Type     - パス
⚠️  Step 3: Lint    - 警告 3 件（自動修正可能）
✅ Step 4: Test     - パス（カバレッジ: 85%）
✅ Step 5: Security - パス
✅ Step 6: Diff     - 変更 5 ファイル

【アクション必要】
- lint 警告を修正: `pnpm lint --fix`
```

## オプション

- `--fix`: lint 警告を自動修正
- `--skip-test`: テストをスキップ（CI 以外で高速検証）
- `--verbose`: 詳細な出力

## 使用例

```bash
# 完全検証
/dev-core:verify

# 自動修正付き
/dev-core:verify --fix

# テストスキップ（高速）
/dev-core:verify --skip-test
```
