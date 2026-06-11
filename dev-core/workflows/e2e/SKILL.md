---
name: e2e
description: "Playwright E2Eテストを実行する。E2Eテストの実行・デバッグ・Page Object Modelパターンでのテスト作成時に /dev-core:e2e で起動する。"
argument-hint: "[テストファイル/ディレクトリ] [--headed ブラウザ表示] [--debug デバッグモード]"
disable-model-invocation: true
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Read, Write, Task(subagent_type:dev-core:e2e-runner)
---

# E2E テスト実行

Playwright を使用して E2E テストを実行する。

## 実行フロー

### 1. テスト環境の確認

```bash
npx playwright --version 2>&1
```

Playwright が未導入の場合は、推測でインストールせずユーザーに確認する。

### 2. e2e-runner エージェント呼び出し

Task ツールで `dev-core:e2e-runner` に以下を渡す:

- テスト対象: $ARGUMENTS
- オプション: `--headed`（ブラウザ表示）/ `--debug`（デバッグモード）

### 3. テスト実行

```bash
npx playwright test $ARGUMENTS 2>&1
```

## Page Object Model

テストは Page Object Model パターンで構造化する:

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

## 報告ルール

実行した Playwright の実出力から、テスト数・成功/失敗/スキップ数・失敗したテストのファイルと失敗理由を引用して報告する。**実行していない数値を書かない。** 失敗があれば `npx playwright show-report` での確認を案内する。

## 禁止事項

⚠️ **本番環境でのテスト実行禁止**

E2E テストは必ずテスト環境で実行する。本番データベースへの接続は禁止。

## 使用例

```
/dev-core:e2e
/dev-core:e2e tests/auth/
/dev-core:e2e --headed
/dev-core:e2e --debug
```
