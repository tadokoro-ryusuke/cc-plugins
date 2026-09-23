# cc-plugins

Claude Code プラグインのマーケットプレイス・ソースリポジトリ。
t-wada 式 TDD、FSD、Clean Architecture、DDD に基づいた開発をハーネスエンジニアリングでサポートします。

## インストール

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install dev-core@cc-plugins
```

## 提供プラグイン

| プラグイン | 説明 |
|-----------|------|
| [dev-core](./dev-core/) | TDD 開発フレームワーク。開発原則のスキル、ワークフロー、専門エージェント、Hooks 自動化を提供 |
| [github-tools](./github-tools/) | GitHub 連携ワークフロー支援。PR 作成とドキュメント更新を効率化 |
| [hotl-engineering](./hotl-engineering/) | Human-on-the-Loop 開発ワークフローの設計・適用と開発運営の CTO 判断支援。リポジトリ引き継ぎ・品質ゲート段階導入・自律性の昇格判断・監査対応 |
| [ui-ux-pro-max](./ui-ux-pro-max/) | UI/UX デザインインテリジェンス（[nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) のベンダリング） |
| [delivery-core](./delivery-core/) | 受託開発のデリバリー上流。PM 運営、要件定義（RDRA・受入基準）、顧客との合意形成、業務設計・サービス設計・システム化範囲の線引き |
| [ai-engineering](./ai-engineering/) | LLM / AI エージェントを含むシステムの設計。エージェント構成、ツール・コンテキスト設計、RAG、LLM の評価、人間の介在点設計 |
| [compliance-core](./compliance-core/) | 受託開発の法規制コンプライアンス。個人情報保護法の実務、OSS ライセンス監査（SBOM）、生成 AI 利用の権利処理。法的助言ではなく実務の型 |
| [design-core](./design-core/) | ノンデザイナー向けのデザイン品質。デザイン4原則による UI / 資料の審査と、提案書・スライド・図解の作成 |

## リポジトリ構成

```
cc-plugins/
├── .claude-plugin/marketplace.json   # マーケットプレイス定義
├── AGENTS.md                         # ツール非依存の知識正本（スキルインデックス）
├── CLAUDE.md                         # Claude Code 固有の薄いラッパ（@AGENTS.md を import）
├── dev-core/                         # メインプラグイン
├── github-tools/
├── hotl-engineering/                 # HOTL 開発運営スキル（テンプレ・eval 雛形同梱）
├── ui-ux-pro-max/
├── delivery-core/                    # 受託開発のデリバリー上流（PM・要件定義・合意形成）
├── ai-engineering/                   # LLM / AI エージェントを含むシステムの設計
├── compliance-core/                  # 法規制コンプライアンスの実務
├── design-core/                      # デザイン品質の審査と資料作成
├── docs/codex-interop/               # Codex との相互運用ガイド
├── docs/research/                    # 設計判断の調査記録
└── scripts/                          # drift 検証・共有スキルセットアップ
```

## 設計原則

- **Single Source of Truth**: 知識本体はスキル（`dev-core/skills/<skill>/SKILL.md`）に置き、二重管理しない。バージョン・メタデータの正本は各プラグインの `.claude-plugin/plugin.json`
- **Codex 互換**: dev-core の知識スキルは Agent Skills 標準準拠で、Claude Code と Codex の双方から同一実体を参照する（詳細: [docs/codex-interop/](./docs/codex-interop/)）
- **継続的検証**: 構成 drift、behavior eval schema、Claude hook event互換性、公式 plugin validation を CI で検証する
- **調査根拠**: 自律ワークフローへ採用した外部実践と採用しなかった設計は [docs/research/autonomous-development-workflows.md](./docs/research/autonomous-development-workflows.md) に、Opus 5.5 に合わせた実行トポロジーと effort の方針は [docs/research/opus-5-5-plugin-strategy.md](./docs/research/opus-5-5-plugin-strategy.md) に記録する

## 開発

```bash
# drift チェック（Node 標準モジュールのみ・追加依存なし）
node scripts/check-skills-drift.mjs
node scripts/validate-skill-evals.mjs
node scripts/validate-claude-hooks.mjs

# 公式バリデーション
claude plugin validate . --strict
claude plugin validate dev-core --strict
```

## ライセンス

[MIT](./LICENSE)（ui-ux-pro-max は upstream のライセンスに従う）
