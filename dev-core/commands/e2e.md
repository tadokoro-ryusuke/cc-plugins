---
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Read, Write, Task(subagent_type:dev-core:e2e-runner)
description: "Playwright E2Eテストを実行します。Page Object Modelパターンでテストを管理"
argument-hint: "[テストファイル/ディレクトリ] [--headed ブラウザ表示] [--debug デバッグモード]"
---

# E2E テスト実行

Playwright を使用して E2E テストを実行します。

## 実行フロー

### 1. テスト環境の確認

```bash
# Playwright がインストールされているか確認
npx playwright --version 2>&1
```

### 2. e2e-runner エージェント呼び出し

```
Task(subagent_type: "dev-core:e2e-runner")
prompt: |
  以下の E2E テストを実行してください。

  【テスト対象】
  $ARGUMENTS

  【オプション】
  - headed: ブラウザ表示
  - debug: デバッグモード
```

### 3. テスト実行

```bash
# 全テスト実行
npx playwright test 2>&1

# 特定のテスト
npx playwright test $ARGUMENTS 2>&1

# ヘッドモード
npx playwright test --headed 2>&1

# デバッグモード
npx playwright test --debug 2>&1
```

## Page Object Model

テストは Page Object Model パターンで構造化：

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="submit"]');
  }
}
```

## 出力形式

```
【E2E テスト結果】

🧪 実行: 15 テスト
✅ 成功: 14
❌ 失敗: 1
⏭️ スキップ: 0

❌ 失敗したテスト:
   tests/auth/login.spec.ts:25
   "ログイン後にダッシュボードが表示される"
   → タイムアウト: 要素が見つかりませんでした

📊 実行時間: 45 秒
📸 スクリーンショット: test-results/

【推奨アクション】
- 失敗したテストを確認: npx playwright show-report
```

## 禁止事項

⚠️ **本番環境でのテスト実行禁止**

E2E テストは必ずテスト環境で実行してください。本番データベースへの接続は禁止です。

## 使用例

```bash
# 全テスト実行
/dev-core:e2e

# 特定のテスト
/dev-core:e2e tests/auth/

# ブラウザ表示
/dev-core:e2e --headed

# デバッグモード
/dev-core:e2e --debug
```
