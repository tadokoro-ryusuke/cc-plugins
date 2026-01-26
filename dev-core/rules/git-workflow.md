# Git Workflow Rules

## コミットメッセージ形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: フォーマット変更
- `refactor`: リファクタリング
- `test`: テスト追加/修正
- `chore`: ビルド/ツール変更

### 例

```
feat(auth): Add SSO login support

Implement OAuth2 integration with corporate IdP.
Supports SAML and OIDC protocols.

Closes #123
```

## ブランチ戦略

- `main`: 本番環境
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発
- `fix/*`: バグ修正
- `release/*`: リリース準備

## PR プロセス

1. ブランチを作成
2. 変更を実装（TDD）
3. テストがすべてグリーン
4. lint/typecheck パス
5. PR を作成
6. レビューを受ける
7. マージ

## 4 段階実装フロー

1. **Task**: 要件整理・計画・Issue作成（/dev-core:task）
2. **Implement**: TDD 実装（/dev-core:execute）
3. **Verify**: 検証（/dev-core:verify）
4. **Refactor**: 改善（/dev-core:refactor）
