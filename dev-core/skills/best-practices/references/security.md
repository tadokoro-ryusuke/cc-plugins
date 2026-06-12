# セキュリティ規約 — OWASP Top 10

## チェックリスト

- **A01 Access Control**: 認可チェックが全エンドポイントに実装、水平権限昇格防止、CORS設定
- **A02 Cryptographic**: 機密データ暗号化、HTTPS強制、安全な暗号アルゴリズム
- **A03 Injection**: SQL/XSS/コマンドインジェクション対策（ORM使用、自動エスケープ）
- **A04 Insecure Design**: 脅威モデリング、防御の深さ
- **A05 Misconfiguration**: デフォルト資格情報変更、不要機能無効化
- **A06 Vulnerable Components**: 依存関係最新、依存監査（`npm audit` 等）クリーン
- **A07 Authentication**: 強力なパスワードポリシー、MFA、安全なセッション管理
- **A08 Integrity**: CI/CD安全性、依存関係整合性チェック
- **A09 Logging**: セキュリティイベントのログ記録、改ざん防止
- **A10 SSRF**: URL検証、内部ネットワークアクセス制限

## 入力検証

- スキーマベースのバリデーション（zod, Laravel Validation等）
- サーバーサイドバリデーション必須（クライアントのみに頼らない）

## 機密情報保護

- 環境変数の使用（.env.local / .env、.gitignore に追加）
- コミット前の機密情報チェック
- .env.example をコミット可能なテンプレートとして管理

## 金融システム追加チェック

- トランザクション原子性（ACID）、二重支払い防止
- 監査ログ、レート制限
- Web3: ウォレット署名検証、MEV保護
