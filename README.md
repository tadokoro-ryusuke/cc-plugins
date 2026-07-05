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
├── docs/codex-interop/               # Codex との相互運用ガイド
└── scripts/                          # drift 検証・共有スキルセットアップ
```

## 設計原則

- **Single Source of Truth**: 知識本体はスキル（`dev-core/skills/<skill>/SKILL.md`）に置き、二重管理しない。バージョン・メタデータの正本は各プラグインの `.claude-plugin/plugin.json`
- **Codex 互換**: dev-core の知識スキルは Agent Skills 標準準拠で、Claude Code と Codex の双方から同一実体を参照する（詳細: [docs/codex-interop/](./docs/codex-interop/)）
- **継続的検証**: 構成の drift は CI（`scripts/check-skills-drift.mjs` + `claude plugin validate --strict`）で静的に検証する

## 開発

```bash
# drift チェック（Node 標準モジュールのみ・追加依存なし）
node scripts/check-skills-drift.mjs

# 公式バリデーション
claude plugin validate . --strict
claude plugin validate dev-core --strict
```

## ライセンス

[MIT](./LICENSE)（ui-ux-pro-max は upstream のライセンスに従う）
