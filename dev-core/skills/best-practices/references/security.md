# セキュリティ規約 — OWASP Top 10:2025

版は OWASP Top 10:2025（出典: https://github.com/OWASP/Top10/tree/master/2025/docs/en 、2026-10-25 確認）。2021 年版からの主な変更は、SSRF の A01 への統合、旧 A06（脆弱なコンポーネント）の A03 サプライチェーンへの拡張、A10（例外条件の誤処理）の新設。

## チェックリスト

- **A01 Broken Access Control**: 認可チェックが全エンドポイントに実装、水平権限昇格防止、CORS 設定。SSRF 対策（URL 検証、内部ネットワークへのアクセス制限）もここに含む
- **A02 Security Misconfiguration**: デフォルト資格情報の変更、不要機能の無効化、安全な既定値
- **A03 Software Supply Chain Failures**: 依存監査（`npm audit` / `cargo audit` / `pip-audit` / `govulncheck` 等、言語に応じて）が、設定した閾値で通る。閾値・例外・トリアージ（EPSS/KEV）・SBOM の正本は dev-core:security-by-design Step 5。信頼できる取得元、ロックファイル、SBOM。CI での位置付けは dev-core:cicd-release-design
- **A04 Cryptographic Failures**: 機密データの暗号化、HTTPS 強制、安全な暗号アルゴリズム
- **A05 Injection**: SQL / XSS / コマンドインジェクション対策（ORM・パラメータ化、自動エスケープ）
- **A06 Insecure Design**: 脅威モデリング、防御の多層化
- **A07 Authentication Failures**: 強力な認証（MFA）、安全なセッション管理
- **A08 Software or Data Integrity Failures**: CI/CD の安全性、依存とデータの整合性チェック
- **A09 Security Logging & Alerting Failures**: セキュリティイベントのログ記録と改ざん防止。ログをアラートまでつなぐ
- **A10 Mishandling of Exceptional Conditions**: 例外時は fail closed にする（認可・検証の失敗で許可側に倒さない）。途中で失敗したトランザクションは全体をロールバックする。利用者向けのエラーに内部情報（スタックトレース・SQL・内部パス）を出さない。例外時にリソースを解放する。レート制限・クォータを設ける。例外の分類は dev-core:resilience-design の例外3分類を参照

## 入力検証

- スキーマベースのバリデーション（zod, Laravel Validation等）
- サーバーサイドバリデーション必須（クライアントのみに頼らない）

## 機密情報保護

- 環境変数の使用（.env.local / .env、.gitignore に追加）
- コミット前の機密情報チェック
- .env.example をコミット可能なテンプレートとして管理

## 金融システム追加チェック

- トランザクション原子性・二重支払い防止・冪等性 → dev-core:resilience-design（トランザクション・リトライ）と dev-core:interface-contract-design（Idempotency-Key）
- 監査ログ、レート制限
- Web3: ウォレット署名検証、MEV 保護
