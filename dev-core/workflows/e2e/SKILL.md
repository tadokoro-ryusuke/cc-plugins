---
name: e2e
description: "Playwright E2Eテストを実行する。E2Eテストの実行・デバッグ・Page Object Modelパターンでのテスト作成時に /dev-core:e2e で起動する。"
argument-hint: "[テストファイル/ディレクトリ] [--headed ブラウザ表示] [--debug デバッグモード]"
disable-model-invocation: true
allowed-tools: Read, Write, Agent(dev-core:e2e-runner)
---

# E2E テスト実行

Playwright を使用して E2E テストを実行する。

## 実行フロー

### 1. テスト環境の確認

`package.json` とlockfileからPlaywrightが既存dependencyか先に確認し、project scriptを優先する。CLI確認が必要ならdownloadを禁止した `npx --no playwright --version` を使う（非対話の実行では、素の `npx` は確認なしに取得しうる）。Playwright が未導入の場合は、`npx` の自動取得を起こさずユーザーに確認する。

### 2. e2e-runner への委譲

E2E の実行ログとトレースは大きく、親の文脈を圧迫するので、実行とデバッグは `Agent(dev-core:e2e-runner)` に委譲する。以下を渡す:

- テスト対象: $ARGUMENTS
- オプション: `--headed`（ブラウザ表示）/ `--debug`（デバッグモード）
- 返してほしいもの: 状態（completed / needs-parent / blocked）、実行したコマンド、テスト数と成功/失敗/スキップ数、失敗したテストのファイルと失敗理由（実出力の抜粋）

partial で返った結果や needs-parent / blocked は完了とみなさず、必要なものを用意して再実行するか、ユーザーに報告する。

### 3. テスト実行（e2e-runner が実行する）

```bash
npx --no playwright test $ARGUMENTS 2>&1
```

## Page Object Model

テストは Page Object Model パターンで構造化する。ロケータはユーザーから見える属性で探し、検証は自動で待つアサーションで行う（書き方の正本は `dev-core:best-practices` の `references/testing.md`）。`page.fill` / `page.click` のようなセレクタ文字列を直接渡す API は、Playwright が Discouraged（推奨しない）としている。

```typescript
// pages/LoginPage.ts
import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.getByLabel('メールアドレス').fill(email);
    await this.page.getByLabel('パスワード').fill(password);
    await this.page.getByRole('button', { name: 'ログイン' }).click();
    await expect(this.page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
  }
}
```

## 報告ルール

実行した Playwright の実出力から、テスト数・成功/失敗/スキップ数・失敗したテストのファイルと失敗理由を引用して報告する。**実行していない数値を書かない。** 失敗があれば `npx --no playwright show-report` と trace での確認を案内する。retry で初めて通ったテストは flaky として報告する。

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
