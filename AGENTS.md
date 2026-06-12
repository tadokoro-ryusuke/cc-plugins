# AGENTS.md — dev-core 知識の正本

このファイルは cc-plugins / dev-core の **ツール非依存の知識正本（Single Source of Truth）** です。
開発原則・パターン・協働ワークフローの本体は dev-core の各 SKILL.md にあり、本ファイルはそれらを **横断的にインデックス** します。

- **cc-plugins**: Claude Code プラグインのマーケットプレイス・ソースリポジトリ。
- **dev-core**: TDD / FSD / Clean Architecture / DDD などの開発原則と、それを駆動するスキル・ワークフロー・エージェントを束ねたプラグイン。

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
| codex-collab | Claude Code と Codex の協働を駆動するスキル。Claude が実装し Codex に独立レビュー/セカンドオピニオン/レスキューを依頼する |
| continuous-learning | セッションからの学習パターン抽出。ミスを二度と起こさないメカニズムを構築する |
| debug | 4フェーズ根本原因分析（収集→仮説→検証→修正）。Three Strikes Rule（3回失敗で STOP）の正本 |
| frontend-patterns | フロントエンドのコンポーネント設計、状態管理、フォーム、データフェッチのパターンガイド（フレームワーク非依存） |
| verify | 6段階検証フロー（build→type→lint→test→security→diff）。証拠ベース完了判定（Iron Law）の正本 |
<!-- skills:end -->

## スキルの参照経路（2経路）

同一の `dev-core/skills/` を、ツールごとに別経路で参照します（実体は1箇所・コピーしない）。

- **Claude Code**: `.claude-plugin/plugin.json` の `skills: ["./skills", "./workflows"]` で知識スキルとワークフロースキルの両方を読み込む。
- **Codex**: `.codex-plugin/plugin.json` の `skills: "./skills/"` で**知識スキルのみ**を参照する（workflows は Claude 固有機能に依存するため共有しない）。

name / version は `.claude-plugin/plugin.json` を正とし、`.codex-plugin/plugin.json` は同期します。
両者のずれは `scripts/check-skills-drift.mjs`（CI）で継続的に検証されます。
