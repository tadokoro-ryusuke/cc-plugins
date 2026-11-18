---
name: codex-collab
description: "Claude Code と Codex の協働を駆動するスキル。Claude が親として設計・統合・受け入れを持ち、Codex に独立レビュー・セカンドオピニオン・設計の独立案・範囲の決まった実装・レスキューを渡す。渡す面（codex-plugin-cc、Herdr の端末、codex exec）の選び方、役割ごとのモデル、handoff の契約、結果の確かめ方を扱う。「Codexにレビューさせて」「セカンドオピニオン」「Codexに委譲」「GPTに実装させて」等でトリガー。"
compatibility: "Claude Code + Codex CLI（codex-plugin-cc か Herdr は面に応じて）"
---

# Codex Collab

Claude Code と Codex の協働開発を駆動する運用スキル。片方のモデルの盲点をもう片方が埋める協働を、dev-core の既存原則（委譲の3条件、リスクゲート、Zero Trust Review、Three Strikes Rule）と統合して扱う。

## 対象環境（最初に確認）

- 本スキルは **Claude Code が親として Codex を呼ぶ**運用スキルであり、Codex-native の skill ではない。
- どの面でも、ローカルに Codex CLI がインストール・認証済みであることが前提になる。
- `/codex:*` スラッシュコマンドは codex-plugin-cc が提供する。Herdr の端末を使う面は、Herdr の中で動いているときだけ使える。
- Codex 単体で使う場合は、Codex 側の dev-core（codex-plugins）の skill を使う。

## 誰が何を持つか

| 持つもの | 担当 |
|---|---|
| ユーザーとの対話、要件と設計の判断、統合、受け入れの判定 | 親（Claude） |
| 設計の独立案、設計や計画への敵対的レビュー | Codex（読み取り専用） |
| リスクゲートの独立レビュー | Codex（読み取り専用）か、dev-core の reviewer |
| 範囲と受け入れチェックが決まった実装 | 親が既定。委譲の条件に当たるか、ユーザーが求めたら Codex |
| 行き詰まったときの別視点（レスキュー） | Codex。ユーザーの同意か事前の許可があるとき |

- 委譲するかどうかは `dev-core:best-practices` の `references/delegation-and-review.md` §1〜§3 で決める。「Codex がある」だけでは委譲の理由にならない。ユーザーが明示的に Codex への委譲を求めたら、それを優先する。
- レビューは、実装した担当と別の担当が行う。Codex が実装したら親が diff を読み、親が実装したら Codex に読ませる。別のモデルであることは独立性の助けになるが、証拠の代わりにはならない。
- 役割ごとのモデルと effort → [references/codex-roles.md](references/codex-roles.md)（モデル ID はこのファイルにだけ書く）

## 面の選び方

| 面 | 向く場面 | 入口 |
|---|---|---|
| codex-plugin-cc | 単発のレビュー、レスキュー。Herdr の外 | `/codex:review` など（下の表） |
| Herdr の端末 | 見える場所で動かしたい、途中で介入したい、実装を続けて任せたい、複数の役を並べたい | 親が Herdr の端末を起動する（[references/herdr-terminals.md](references/herdr-terminals.md)） |
| `codex exec` を親が直接実行 | plugin も Herdr も使えないときの、読み取り専用の一発実行 | [references/codex-roles.md](references/codex-roles.md) の起動の引数 |

- 文面を渡せる面（Herdr の端末、`codex exec`、`/codex:rescue`）では、渡す文面と結果の扱いを同じ契約に従わせる → [references/codex-handoff.md](references/codex-handoff.md)。`/codex:review` は文面を受け取らない組み込みのレビューなので、ジョブの ID とレビューした Git の範囲を証拠として記録する。返却の形式を指定したいレビューは `codex exec` で渡す
- Herdr の端末の扱い（面の検出、状態、承認待ち、後始末）→ [references/herdr-terminals.md](references/herdr-terminals.md)
- 頼まれていないのに Herdr の端末を立てない。Herdr を使うのは、ユーザーが Herdr を名指ししたときか、上の workflow を起動したときにする。

## codex-plugin-cc

codex-plugin-cc は OpenAI 公式（Apache-2.0）のプラグイン。MCP ではなく、ローカルの Codex CLI / app server を exec する。

### install 手順（順に実行）

1. `/plugin marketplace add openai/codex-plugin-cc`
2. `/plugin install codex@openai-codex`
3. `/reload-plugins`
4. `/codex:setup`

要件は Node.js 18.18 以上と、認証済みの Codex CLI（ChatGPT サブスクリプション または OpenAI API キー）。未導入の状態で `/codex:*` を求められたら、この手順を案内する。Codex CLI だけがある環境では、読み取り専用のレビューを `codex exec` の直接実行で頼める。

### コマンドと使い分け

レビュー/レスキュー系は `--wait`（前景・結果を待つ）と `--background`（非同期実行）を選べる。

| コマンド | 用途 | 主な引数 |
|---------|------|---------|
| `/codex:review` | ローカル git 状態に対する標準コードレビュー（実装後のセカンドオピニオン） | `[--wait\|--background] [--base <ref>] [--scope auto\|working-tree\|branch]` |
| `/codex:adversarial-review` | 実装方針・設計判断を疑う敵対的レビュー（リスクの高い変更・マージ前） | `[--wait\|--background] [--base <ref>] [--scope ...] [focus ...]` |
| `/codex:rescue` | 調査・修正・継続作業を Codex rescue サブエージェントへ委譲（行き詰まり時） | `[--background\|--wait] [--fresh\|--resume] [--model <model>] [--effort <level>]` |
| `/codex:status` | このリポジトリの実行中/最近の Codex ジョブと **review-gate 状態** を表示 | `[job-id] [--wait] [--all]` |
| `/codex:result` | 完了ジョブの保存済み最終出力を取得 | `[job-id]` |
| `/codex:cancel` | 実行中のバックグラウンドジョブをキャンセル | `[job-id]` |
| `/codex:setup` | Codex CLI の準備状態確認・**停止前 review gate の有効/無効切替** | `[--enable-review-gate\|--disable-review-gate]` |

- **background ジョブ運用**: `--background` で投げたレビュー/レスキューは `/codex:status` で進捗確認 → `/codex:result` で結果回収 → 不要なら `/codex:cancel`。
- **モデルと effort**: 指定しなければ、利用者の Codex の既定で動く。指定できるのは `/codex:rescue` で、役割を分けたいときだけ `--model` と `--effort` を明示する。値と、使わない値（退役済みの別名、現行モデルが拒否する effort）は [references/codex-roles.md](references/codex-roles.md) に従う。
- **起動できるのは誰か**: `/codex:review` と `/codex:adversarial-review` はユーザーが起動するコマンドで、親からは起動できない。親が自分で独立レビューを取るときは、`codex exec` の直接実行か、Herdr の端末を使う。

### Review gate（停止前レビューの自動化）

`/codex:setup --enable-review-gate` で「**stop-time review gate**」を有効化すると、Claude が応答を終える前に Codex の新規レビューを通すことが必須になる。

- 状態確認: `/codex:status`（review-gate 状態も表示される）
- 無効化: `/codex:setup --disable-review-gate`
- ゲートは途中の停止でも走り、停止のたびに一手間増える。頻度とリスクに応じて使い分ける。

dev-core は、独立レビューを行うかをリスクゲートで判定し、安定した候補に新しい文脈で1回行う（正本: `delegation-and-review.md` §5）。併用するときは次の順で扱う。

1. リスクゲートで運用する作業では、stop-time review gate を常時有効にしない。停止のたびに途中の候補がレビューされ、ゲートのレビューと重複しやすいため。
2. review gate を有効にするのは、リスクゲートを運用しない作業や、ユーザーがすべての停止でのレビューを明示的に求めた場合にする。
3. review gate の結果をリスクゲートのレビューとして数えるのは、その入力が安定した候補（最終 diff）と一致するときだけにする。途中の停止で走ったレビューを、最終候補のレビューとして流用しない。
4. リスクゲートで必須の独立レビュー役を起動できないときは、Codex のレビューで代替できる。親が自分で取るなら `codex exec` の読み取り専用の直接実行か Herdr の端末を使い、`/codex:review` や `/codex:adversarial-review` はユーザーに実行を頼む。どれもできなければ「独立性は未充足」と明記し、該当する受け入れ条件は pending のまま残す。

## dev-core 既存原則との統合

### Zero Trust Review

Codex を「前段（自分）の自己申告を信用しない独立検証者」として使う。Codex の報告と指摘も主張として扱い、実ファイルと実行出力で確かめる **双方向 Zero Trust** を徹底する。

- 正本: `dev-core:best-practices` の `references/delegation-and-review.md` §6
- Claude → Codex: Claude 実装の「テスト全パス」「lint クリア」等の自己申告を Codex が実ファイルで独立検証する。
- Codex → Claude: Codex の指摘を Claude が実ファイルで再検証してから反映する。
- Codex が実装したとき: 受け入れチェックは親が自分で実行し直す。報告に問題が書かれていないことを、問題が無かった証拠にしない（手順 → [references/codex-handoff.md](references/codex-handoff.md) の「結果の受け取り方」）。

### Three Strikes Rule

同じ修正経路で類似の修正が **3 回失敗したら、その経路を止める**（正本: `dev-core:debug`）。4 回目を試みず、試行の履歴、各試行が失敗した理由、根本の仮説、推奨をユーザーに報告して判断を委ねる。

- Codex へのレスキュー（別モデルの視点）は推奨の選択肢として示す。起動するのは、ユーザーが同意したときか、計画や依頼（「Codex に委譲して」など）で事前に許可されているときだけにする。
- codex-plugin-cc の rescue は既定で書き込み可能なモードで動く。許可が診断に限られるときは、読み取り専用で診断だけを依頼すると明示する。
- 委譲するときは試行の履歴も渡し、担当の交代で回数をリセットしない。
- レスキューの出力と変更は Zero Trust で扱い、実ファイルと検証の出力で確かめてから受け入れる。

## 協働のパターン

- **セカンドオピニオン**: Claude 実装 → Codex がレビュー → 指摘を確かめて反映。
- **設計の独立案**: 要件だけを渡して Codex に独立した案を出させ、親の案と突き合わせる。親の案は先に見せない。
- **敵対的レビュー**: リスクが高い設計・計画・変更を、前提ごと疑わせる。
- **範囲の決まった実装**: 受け入れチェックが決まった作業を Codex に渡し、親が diff と再実行で確かめて統合する。
- **レスキュー委譲**: 同じ修正経路で 3 回失敗したら経路を止めて報告し、同意か事前の許可があれば Codex に渡す。

## ナレッジ分断への注意

安易な二刀流（Claude と Codex でツールごとに知識を二重管理すること）はナレッジ分断を招く（dtakamiya の警告）。知識の正本は `AGENTS.md` / `SKILL.md` に集約し、Claude も Codex も同じ正本を参照する構成を維持する。モデルの値のように変わりやすいものは、置き場所を1つに絞る。
