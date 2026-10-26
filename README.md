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
| [delivery-core](./delivery-core/) | 受託開発のデリバリー上流。PM 運営、要件定義（RDRA・受入基準）、顧客との合意形成、業務設計・サービス設計・システム化範囲の線引き |
| [ai-engineering](./ai-engineering/) | LLM / AI エージェントを含むシステムの設計。エージェント構成、ツール・コンテキスト設計、RAG、LLM の評価、人間の介在点設計 |
| [compliance-core](./compliance-core/) | 受託開発の法規制コンプライアンス。個人情報保護法の実務、OSS ライセンス監査（SBOM）、生成 AI 利用の権利処理。法的助言ではなく実務の型 |
| [design-core](./design-core/) | ノンデザイナー向けのデザイン品質。デザイン4原則による UI / 資料の審査と、提案書・スライド・図解の作成 |
| [indie-product-marketing](./indie-product-marketing/) | 個人開発プロダクトの機会発見、需要検証、海外・多言語向け LP の設計、ローンチ、集客、定着、ユニットエコノミクス（codex-plugins が正本の日本語翻案） |

### 外部プラグインとの併用

ui-ux-pro-max は 6.0.0 でこのマーケットプレイスから削除した。使う場合は上流の公式プラグインを入れる。
旧版（`ui-ux-pro-max@cc-plugins`）を入れている場合は、同じ名前空間 `ui-ux-pro-max:*` が重ならないよう先に外す。

```
/plugin uninstall ui-ux-pro-max@cc-plugins
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

スキル ID `ui-ux-pro-max:ui-ux-pro-max` は公式版でも同じなので、各スキルからの参照（「導入されていれば」）はそのまま使える。
公式版はスキルを複数同梱する。design-core と発火が重なりうるので、使わないスキルは無効化を検討する。

## 常時コストと共存の設定

インストールしたプラグインのスキルは、呼び出さなくても、名前と説明が毎ターンのコンテキストに入ります。自前のマーケットプレイスでは `/plugin` にコストの欄が出ないので、目安をここに置きます。

| プラグイン | 常時コストの目安 |
|-----------|----------------|
| dev-core | 約 5.5k トークン（エージェントの説明 約 0.7k を含む） |
| github-tools | ほぼ 0（スキルはすべて手動起動専用） |
| hotl-engineering | 約 0.7k |
| delivery-core | 約 1.7k |
| ai-engineering | 約 0.7k |
| compliance-core | 約 0.9k |
| design-core | 約 1.1k |
| indie-product-marketing | 約 1.3k |

計測は 2026-10-26、Claude Code 2.1.310 です。`claude --plugin-dir <dir> plugin details <name>` の Always-on から、手動起動専用（`disable-model-invocation: true`）のスキルの分を引きました。手動起動専用のスキルは一覧に載らないためです。版ごとの内訳と再現手順は [docs/research/skill-reachability-2026-10.md](docs/research/skill-reachability-2026-10.md) にあります。版を上げたら測り直します。

用途ごとの構成の例です。

- 開発: dev-core と github-tools
- 受託の上流も扱う: delivery-core と compliance-core を足す

他のプラグインのスキルへの参照（`dev-core:*` など）はポインタです。参照先を入れていなくても、各スキルは単体で使えます。

スキルが増えて説明が落ちたときは、次の順で確かめて調整します。スキルの一覧には予算（既定はコンテキストの 1%）があり、超えると呼び出しの少ないスキルから説明が落ちます。

1. 確かめる: `/skill-doctor`（2.1.252 以上）で、スキルごとのコストと使われ方、使っていないスキルを見る。`/doctor` で一覧の推定と大きな寄与元を、`/context` の Skills 行で予算を適用した後の大きさを見る。
2. 減らす: 使っていないプラグインを `/plugin` で無効にする。プラグインのスキルは `skillOverrides` の対象外。
3. それでも要るスキルの説明が落ちるときだけ、予算を上げる: `skillListingBudgetFraction`（例: `0.02` で 2%）か、文字数で固定する `SLASH_COMMAND_TOOL_CHAR_BUDGET`。上げた分だけ毎ターンのコストが増える。

出典（2026-10-26 確認）: [Skills の Skill descriptions are cut short と Find unused skills](https://code.claude.com/docs/en/skills)

## リポジトリ構成

```
cc-plugins/
├── .claude-plugin/marketplace.json   # マーケットプレイス定義
├── AGENTS.md                         # ツール非依存の知識正本（スキルインデックス）
├── CLAUDE.md                         # Claude Code 固有の薄いラッパ（@AGENTS.md を import）
├── dev-core/                         # メインプラグイン
├── github-tools/
├── hotl-engineering/                 # HOTL 開発運営スキル（テンプレ・eval 雛形同梱）
├── delivery-core/                    # 受託開発のデリバリー上流（PM・要件定義・合意形成）
├── ai-engineering/                   # LLM / AI エージェントを含むシステムの設計
├── compliance-core/                  # 法規制コンプライアンスの実務
├── design-core/                      # デザイン品質の審査と資料作成
├── indie-product-marketing/          # 個人開発プロダクトの機会発見・需要検証・LP・グロース
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
node scripts/validate-skill-evals.mjs --plugin indie-product-marketing
node scripts/validate-claude-hooks.mjs

# 公式バリデーション
claude plugin validate . --strict
claude plugin validate dev-core --strict
```

## ライセンス

[MIT](./LICENSE)
