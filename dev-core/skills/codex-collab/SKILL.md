---
name: codex-collab
description: "Claude Code と Codex の協働を駆動するスキル。Claude が実装し Codex に独立レビュー/セカンドオピニオン/レスキューを依頼する。「Codexにレビューさせて」「セカンドオピニオン」「Codexに委譲」等でトリガー。"
compatibility: "Claude Code + codex-plugin-cc"
---

# Codex Collab

Claude Code と Codex の協働開発を駆動する運用スキル。Claude が実装し、Codex に独立レビュー・セカンドオピニオン・レスキューを依頼する。片方のモデルの盲点をもう片方が埋める双方向の協働を、dev-core の既存原則（Zero Trust Review / Three Strikes Rule）と統合して扱う。

## 対象環境（最重要・最初に確認）

- 本スキルは **「Claude Code 上で codex-plugin-cc 経由で Codex を呼ぶ」運用スキル**であり、Codex-native の skill ではない。
- `/codex:*` スラッシュコマンドは **codex-plugin-cc が提供するもので Claude Code を前提**とする。
- Codex 単体（Codex-native）で使う場合、`/codex:*` は使えない。Codex に直接 review / rescue を依頼するプロンプトで代替する。
- frontmatter の `compatibility: "Claude Code + codex-plugin-cc"` がこの前提を明示している。

## 前提条件（codex-plugin-cc のセットアップ）

codex-plugin-cc は OpenAI 公式（Apache-2.0）のプラグイン。MCP ではなく、ローカルの Codex CLI / app server を exec する（"It is Codex, just invoked from inside Claude Code"）。

### install 手順（順に実行）

1. `/plugin marketplace add openai/codex-plugin-cc`
2. `/plugin install codex@openai-codex`
3. `/reload-plugins`
4. `/codex:setup`

### 要件

- Node.js 18.18 以上
- ローカルに Codex CLI がインストール・認証済みであること（ChatGPT サブスクリプション または OpenAI API キー）

codex-plugin-cc が未導入の状態で Codex レビューを要求された場合は、まず上記 install 手順と要件を案内する。

## 提供コマンドと使い分け

codex-plugin-cc（OpenAI 公式）が提供するスラッシュコマンド。レビュー/レスキュー系は `--wait`（前景・結果を待つ）と `--background`（非同期実行）を選べる。

| コマンド | 用途 | 主な引数 |
|---------|------|---------|
| `/codex:review` | ローカル git 状態に対する標準コードレビュー（実装後のセカンドオピニオン） | `[--wait\|--background] [--base <ref>] [--scope auto\|working-tree\|branch]` |
| `/codex:adversarial-review` | 実装方針・設計判断を疑う敵対的レビュー（リスクの高い変更・マージ前） | `[--wait\|--background] [--base <ref>] [--scope ...] [focus ...]` |
| `/codex:rescue` | 調査・修正・継続作業を Codex rescue サブエージェントへ委譲（行き詰まり時） | `[--background\|--wait] [--fresh\|--resume] [--model <model\|spark>] [--effort <none..xhigh>]` |
| `/codex:status` | このリポジトリの実行中/最近の Codex ジョブと **review-gate 状態** を表示 | `[job-id] [--wait] [--all]` |
| `/codex:result` | 完了ジョブの保存済み最終出力を取得 | `[job-id]` |
| `/codex:cancel` | 実行中のバックグラウンドジョブをキャンセル | `[job-id]` |
| `/codex:setup` | Codex CLI の準備状態確認・**停止前 review gate の有効/無効切替** | `[--enable-review-gate\|--disable-review-gate]` |

- **background ジョブ運用**: `--background` で投げたレビュー/レスキューは `/codex:status` で進捗確認 → `/codex:result` で結果回収 → 不要なら `/codex:cancel`。長い作業を並行させたいときに使う。
- **前景で待つ**: `--wait` を付ければ結果が返るまでブロックして即レビューを受け取る。

## Review gate（停止前レビューの自動化）

`/codex:setup --enable-review-gate` で「**stop-time review gate**」を有効化すると、Claude が応答を終える前に Codex の新規レビューを通すことが必須になる。手動で毎回 `/codex:review` を頼まなくても「実装 → 必ず Codex のセカンドオピニオン → 完了」が自動で強制される。

- 状態確認: `/codex:status`（review-gate 状態も表示される）
- 無効化: `/codex:setup --disable-review-gate`
- 協働を常用するなら有効化が有力。ただしゲートを通すぶん停止が一手間増えるので、頻度に応じて使い分ける。

## dev-core 既存原則との統合

### Zero Trust Review との連携

Codex レビューを「前段（自分）の自己申告を信用しない独立検証者」として使う。Codex の指摘もそのまま鵜呑みにせず、実ファイルで再検証する **双方向 Zero Trust** を徹底する。

- 正本: `dev-core/agents/code-reviewer.md`（独立検証の原則 / Zero Trust Review）
- Claude → Codex: Claude 実装の「テスト全パス」「lint クリア」等の自己申告を Codex が実ファイルで独立検証する。
- Codex → Claude: Codex の指摘を Claude が実ファイルで再検証してから反映する（指摘も自己申告として扱い検証する）。

### Three Strikes Rule との連携

同一バグの修正試行が **3 回連続で失敗したら STOP**。4 回目を試みず、`/codex:rescue` で Codex へ委譲する。3 回失敗は「修正方法」ではなく「問題の理解」が間違っている兆候であり、別モデルの視点に切り替える。

- 正本: `dev-core/skills/debug/SKILL.md`（3回失敗ルール / Three Strikes Rule）

## 協働ワークフローのパターン

- **セカンドオピニオン**: Claude 実装 → `/codex:review` でレビュー → 指摘を Zero Trust 検証して反映。
- **敵対的レビュー**: リスクが高い設計変更の前に `/codex:adversarial-review` で設計 / 実装を疑う。
- **レスキュー委譲**: 同一バグ修正が 3 回失敗したら `/codex:rescue` で Codex へ委譲（Three Strikes Rule）。
- **レビュー観点**: 差分（diff）だけでなく全体整合性で見る。指摘の重大度（severity）が収束したら実装に着手する。

## ナレッジ分断への注意

安易な二刀流（Claude と Codex でツールごとに知識を二重管理すること）はナレッジ分断を招く（dtakamiya の警告）。知識の正本は `AGENTS.md` / `SKILL.md` に集約し、ツールごとに二重管理しない。Claude も Codex も同一の SKILL.md を参照する構成を維持する。
