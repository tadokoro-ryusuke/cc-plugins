# AGENTS.md — dev-core 知識の正本

このファイルは cc-plugins / dev-core の **ツール非依存の知識正本（Single Source of Truth）** です。
開発原則・パターン・協働ワークフローの本体は dev-core の各 SKILL.md にあり、本ファイルはそれらを **横断的にインデックス** します。

- **cc-plugins**: Claude Code プラグインのマーケットプレイス・ソースリポジトリ（**public**）。
- **dev-core**: TDD / FSD / Clean Architecture / DDD などの開発原則と、それを駆動するスキル・ワークフロー・エージェントを束ねたプラグイン。

## リポジトリ構成

- マーケットプレイス定義の正本: `.claude-plugin/marketplace.json`（プラグイン一覧はここから導出する）。
- 各プラグイン: `<plugin>/.claude-plugin/plugin.json` + `skills/`（+ 必要に応じて `workflows/`、`agents/`、`hooks/`）。
- Codex との相互運用ガイド: `docs/codex-interop/`。検証スクリプト: `scripts/`。

dev-core のスキルは2層に分かれます:

- `dev-core/skills/` — **知識スキル**（ツール非依存・Codex と共有・本ファイルのインデックス対象）
- `dev-core/workflows/` — **ワークフロースキル**（Claude Code 専用。サブエージェント/Agent Teams のオーケストレーション。Codex には共有しない）

知識本体はスキルに、インデックスは本ファイルに、ツール固有の薄い補足は各ツールのラッパ（Claude なら `CLAUDE.md`）に置き、**二重管理しない**ことを設計原則とします。

## スキルインデックス

スキルの実体は `dev-core/skills/<skill>/SKILL.md` の1箇所のみです（コピーしない）。
各行の説明は対応する SKILL.md の `description` と揃えています。

<!-- skills:start -->
| skill | 説明 |
|-------|------|
| backend-patterns | API設計、Repository、サービス層、Result パターン、キャッシュ、トランザクションのパターンガイド（フレームワーク非依存） |
| best-practices | TDD、SOLID、コーディング規約、FSD/Clean Architecture/DDD、セキュリティの開発原則ガイド（詳細は references/ に progressive disclosure） |
| cicd-release-design | CI/CDパイプラインとデプロイ/リリース戦略の設計スキル。品質ゲート段階設計、シークレット管理（OIDC優先）、デプロイ戦略選択、フィーチャーフラグ寿命管理、ロールバック設計、エージェント権限設計 |
| cloud-infra-network-design | クラウドインフラとネットワークの設計スキル。実行基盤選定（コンテナ/サーバーレス）、Well-Architected チェック、IaC 標準構成、VPC/DNS/CDN/TLS、閉域接続の使い分け、apply/DNS切替の人間承認ゲート |
| codex-collab | Claude Code と Codex の協働を駆動するスキル。Claude が実装し Codex に独立レビュー/セカンドオピニオン/レスキューを依頼する |
| continuous-learning | セッションからの学習パターン抽出。ミスを二度と起こさないメカニズムを構築する |
| conventions-as-guardrails | コーディング規約・命名規約・ログ規約を「AIエージェントが決定的に守れる形」に翻訳する。新規リポジトリ立ち上げ・CLAUDE.md/AGENTS.md 整備・lint/CI/フック設定時に使用 |
| data-auth-boundary-design | データモデル（ER図・正規化・マスタ・コード設計）と認証・認可（OAuth/OIDC/パスキー、RBAC/マルチテナント分離）の設計スキル。概念/論理設計と認証認可の境界設計を担当（物理設計は data-design-ops） |
| data-design-ops | テーブル物理設計・インデックス・パーティション・マイグレーション運用のスキル。Expand-Contract、EXPLAIN を証拠とするインデックス設計、手動DDL禁止規約、本番DB書き込みのAI除外ガードレール |
| debug | 4フェーズ根本原因分析（収集→仮説→検証→修正）。Three Strikes Rule（3回失敗で STOP）の正本 |
| external-design-deliverables | 受託開発の基本設計（外部設計）成果物一式を作るスキル。画面一覧→遷移図→ワイヤーフレーム→詳細仕様の合意順序、OOUI画面構成、冪等性・リラン・突き抜け対策を含むバッチ設計、設計書を機械可読形式で書きクライアント合意文書とAI実装指示の二役にする原則の正本 |
| frontend-patterns | フロントエンドのコンポーネント設計、状態管理、フォーム、データフェッチのパターンガイド（フレームワーク非依存） |
| interface-contract-design | API・イベント・エラーレスポンスなど機械間境界の契約設計スキル。プロトコル選定、バージョニング、後方互換規約、ページネーション、冪等性（Idempotency-Key）、配信保証・Outbox・Saga、RFC 9457 エラー体系。実装パターンは backend-patterns が正本で、本スキルは対外契約と互換性戦略を担当 |
| issue-driven-dev | Issue起点で人間+AIエージェントの開発を回すスキル。Issue作成・分解・トリアージ、Issue Forms/ラベル/マイルストーン運用、ブランチ戦略選択、エージェントへのタスク委任、ADR/Design Docの書き分け、レビュー規律。task-planner / issue-creator の知識正本 |
| migration-cutover-planning | システム移行・データ移行・カットオーバー計画のスキル。移行方式3類型の選定、Strangler Fig、二重書き込み+照合、並行稼働の終了判定、Go/No-Go と Point of No Return 付きカットオーバー計画書、切り戻し可能性の確保 |
| ops-design-handover | 運用設計・監視・インシデント管理・運用引き継ぎのスキル。ITIL 4 最小4プラクティス、SLOベースアラート、Severity定義、ブレームレス・ポストモーテムと顧客向け障害報告、引き継ぎ完了条件、月次運用レポート |
| reliability-sla-design | 可用性・信頼性設計と保守SLA設計のスキル。SLI/SLO/SLA 3層とエラーバジェット、RTO/RPOとDR 4戦略、3-2-1バックアップ+リストア証跡、守れるSLA条項（対応時間帯・免責・上限）、外形監視によるSLI計測。SLA・SLO・稼働率・冗長化・バックアップ・DR・RTO/RPO・保守契約の条件設計で使用 |
| resilience-design | トランザクション・例外・リトライ・キャッシュの実行時信頼性設計スキル。例外3分類、Result型の適用基準、Backoff+Jitter、分離レベル・ロック選択、Outbox、キャッシュ戦略とスタンピード対策。実装コード例は backend-patterns が正本 |
| security-by-design | セキュリティ設計スキル。軽量STRIDE脅威モデリング、ASVSレベル選定と契約明記、ゼロトラスト実装パターン、シークレット管理、EPSS/KEV脆弱性トリアージ、AIエージェント自体の脅威対策 |
| system-architecture-selection | システム方式設計スキル。モジュラーモノリス既定の選定デシジョンツリー、C4モデル2階層運用、ADR（Nygard形式）、アーキテクチャ特性の優先順位付けワークショップ、フィットネス関数によるCI監視 |
| test-design | テスト戦略・テスト設計・検収基準づくりのスキル。テスト計画・観点表・テスト技法の選択、リスクベースの優先順位付け、検収テスト仕様書・結果報告書。テストの「実行」ではなく「設計」を担当（実行と証拠報告は verify） |
| verify | 6段階検証フロー（build→type→lint→test→security→diff）。証拠ベース完了判定（Iron Law）の正本 |
<!-- skills:end -->

## スキルの参照経路（2経路）

同一の `dev-core/skills/` を、ツールごとに別経路で参照します（実体は1箇所・コピーしない）。

- **Claude Code**: `.claude-plugin/plugin.json` の `skills: ["./skills", "./workflows"]` で知識スキルとワークフロースキルの両方を読み込む。
- **Codex**: `.codex-plugin/plugin.json` の `skills: "./skills/"` で**知識スキルのみ**を参照する（workflows は Claude 固有機能に依存するため共有しない）。

両マニフェストのずれは `scripts/check-skills-drift.mjs`（CI）で継続的に検証されます（version の正本は「編集ルール」節を参照）。

## 検証コマンド

プラグイン・スキル・マニフェストを変更したら、コミット前に必ず実行する。

```bash
node scripts/check-skills-drift.mjs        # 構成 drift 検証（Node 標準のみ・追加依存なし）
node scripts/validate-skill-evals.mjs      # behavior eval schema・skill参照検証
node scripts/validate-claude-hooks.mjs     # hook event・handler type・script参照検証
claude plugin validate . --strict          # マーケットプレイス全体の公式検証
claude plugin validate <plugin> --strict   # 変更した各プラグインごとに実行する公式検証
```

注意: `claude plugin validate --strict` は description 欠落しか検出しない。
name とディレクトリ名の不一致・description の 1024 字超過などは素通りするため、
**drift チェッカを一次ゲート**として扱う（validate は補助）。

## 編集ルール

- version の正本は各プラグインの `.claude-plugin/plugin.json`。リリースする変更ごとに semver で bump し、Codex マニフェストを持つプラグイン（現在は dev-core のみ）は `.codex-plugin/plugin.json` の name / version / description を同期する。
- SKILL.md frontmatter は `name` と `description` を必須とする。description は「何をするか + いつ使うか」をトリガー語込みで書き、1024 字以内に収める。
- SKILL.md 本文は 500 行以内。詳細は `references/`（1 階層）へ、決定的なロジックはテスト済み `scripts/` へ逃がす（progressive disclosure）。
- 知識本体は SKILL.md にのみ置く。AGENTS.md・README への複製は禁止（本ファイルはインデックスのみ持つ）。

## 兄弟リポジトリ（codex-plugins）

- `~/work/codex-plugins`（[tadokoro-ryusuke/codex-plugins](https://github.com/tadokoro-ryusuke/codex-plugins)）は Codex ネイティブ版マーケットプレイス。dev-core の知識スキルと hotl-engineering は、日本語正本からの**英語翻案**としてミラーする（機械コピーではなく、Codex の機能差に合わせた翻案）。github-tools / ui-ux-pro-max も両リポジトリに存在するが構成が異なり、翻案ミラーの対象外（リポジトリごとに管理）。
- cc-plugins 側で対象スキルを改善したら、codex-plugins 側へも同じ翻案ルールで反映し、`node scripts/validate-codex-plugins.mjs`（codex-plugins 側）で検証する。
- Codex は install 時にプラグインをキャッシュへスナップショットする。codex-plugins 更新後は `codex plugin add <plugin>@codex-plugins` で再インストールし、新スレッドを開始しないと反映されない。

## 公開リポジトリとしての注意

本リポジトリは public。クライアント案件由来のスキル・テンプレート・eval データを入れる場合は、
コミット前に固有識別子（製品名・リソース名・ユーザー名・ドメイン固有の golden データ）を汎用化し、
`grep -rn` で残存ゼロを確認してからコミットする。単価・内部戦略を含む INTERNAL な内容は置かない。
