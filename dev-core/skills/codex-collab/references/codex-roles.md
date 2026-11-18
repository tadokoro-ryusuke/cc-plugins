# Codex に渡す役割と、モデル・effort

Claude Code から Codex に仕事を渡すときの、役割ごとのモデルと reasoning effort を定める。cc-plugins の中でモデル ID を書くのはこのファイルだけにする。ほかの skill・workflow・eval は役割名で参照し、ID を写さない。

- 確認日: 2026-11-18（Codex CLI 0.166.0）
- 出どころ: codex-plugins の dev-core にある実行プロファイル（`execution-profile.json`）の役割と揃えている
- この割り当ての効果（品質・コスト）は測定していない。比べるときは、同じ作業で1つの値だけを変える

## 役割表

| 役割 | モデル | effort | sandbox | 起動の形 |
|---|---|---|---|---|
| 設計の独立案、設計の敵対的レビュー | `gpt-6.2-astra` | high | read-only | 一発実行 |
| リスクゲートの独立レビュー | `gpt-6.2-astra` | high | read-only | 一発実行 |
| 実装（範囲と受け入れチェックが決まっている） | `gpt-6.2-sol` | medium | workspace-write | 対話 |
| 実装（モジュールをまたぐ推論や、競合する技術的な仮説の検証が要る） | `gpt-6.2-sol` | high | workspace-write | 対話 |
| 範囲の決まった読み取り調査（ソースの所在、API の棚卸し、ログの分類） | `gpt-6-luna` | high | read-only | 一発実行 |

- GPT-6.2 に Luna は無い。軽量の役は `gpt-6-luna` のまま使う。
- 短く機械的な編集は、Codex に渡さず親が直接行う。handoff・待ち・確認のコストのほうが大きいため。
- sandbox は起動のたびに明示する。利用者の Codex の既定に任せると、既定がより広い設定だったときに、子が親の意図より広い権限で動く。
- 承認の設定は、利用者の既定より弱めない。sandbox も同じで、利用者が Codex をこの表より狭い設定（読み取り専用など）に絞っていると分かっているときは、広げて起動しない。その dispatch は起動せず、ユーザーに確認する。
- sandbox が強制するのは作業ディレクトリの単位までで、handoff に書いたファイル単位の範囲は指示にとどまる。範囲を守ったかは、親が変更を確かめて判定する（→ `codex-handoff.md`）。
- 書き込める sandbox は、作業ディレクトリのほかに一時ディレクトリにも書ける。Codex CLI 0.166.0 の `workspace-write` で確かめたところ、作業ディレクトリ、`/tmp` の配下、`TMPDIR` の配下には書け、ホームの下のほかの場所には書けなかった（利用者の設定で変わりうる）。親が比較の基準にする記録は、子が書き換えうるものとして扱う（→ `codex-handoff.md` の「dispatch ごとに用意するもの」）。
- 子の Codex の権限を決めるのは、Codex の sandbox と承認の設定である。Claude Code 側のフックや許可は、子が実行するコマンドには届かない。commit・push・デプロイ・共有データへの書き込みのような、保護された操作と外部に作用する操作は子に渡さず、親が持つ。

### codex-plugins のプロファイルと揃えている対応

| この表の役割 | codex-plugins の実行プロファイル |
|---|---|
| 設計の独立案、敵対的レビュー、リスクゲートのレビュー | `reviewer` |
| 実装（範囲が決まっている） | `implementer` の既定 |
| 実装（複雑） | preset `complex` |
| 読み取り調査 | `researcher` |

`routine` と `bounded` の preset は、この表に対応を持たない（短く機械的な編集は親が行うため）。どちらかのリポジトリで値を変えたら、もう一方の対応する行を見直す。揃えない場合は、その理由をこのファイルに書く。

## 選び方

OpenAI の Codex のモデル一覧は、各モデルの用途を次のように説明している。

- Astra: コード・アプリ・調査にまたがる難しい作業（例: サービスをまたぐバグの追跡）
- Sol: 日常のコーディング、文章、複数の情報源からの計画
- Luna: 件数の多い、範囲の絞られた作業（要約、抽出、絞られたコーディング）

effort は、OpenAI の Codex 向けガイドの目安に合わせる。

- medium: 手早い調査や、範囲の決まった実装
- high: 1つの原因を複数の箇所にわたって追う、対立する説明と突き合わせる
- xhigh: 複数の原因が絡み、それぞれを説明し切る必要がある

次の値は、この役割表では使わない。

- `none` と `minimal`: GPT-6.2 は `none` を拒否する。OpenAI の移行ガイドは `minimal` を `low` に置き換えるよう案内している。
- Ultra: Codex が自分で subagent を立てる設定。子に再帰的な委譲をさせない（→ `codex-handoff.md`）ので使わない。ユーザーや計画がこの設定を明示していたら、handoff の「ほかのエージェントを起動しない」と両立しないので、起動する前にどちらを優先するかをユーザーに確認する。
- max: 1つの作業により長い推論時間を与える設定。使うのは、ユーザーか計画が明示したときだけにする。

## 守ること

- ユーザーや計画がモデル・effort を明示したら、この表より優先する。
- 指定したモデルや effort が使えないときは、黙って別の値に替えない。使えなかったことを報告し、必須の役（リスクゲートのレビューなど）は pending のまま残す。
- sandbox や承認を外すフラグ（サンドボックスと承認を両方飛ばすもの、全域に書けるもの、承認を一切求めないもの）を、handoff の都合で付けない。
- 実行中の担当の役割を、追伸でモデルや役割を告げて切り替えない。新しい担当を起動して所有を移す。

## 起動の引数

Codex CLI 0.166.0 のヘルプで確かめた範囲を書く。引数の正はインストール済みの CLI のヘルプ（`codex --help`、`codex exec --help`）で、食い違ったらヘルプに従う。

| 目的 | 引数 |
|---|---|
| モデル | `-m <model>` |
| effort | `-c model_reasoning_effort=<effort>` |
| 読み取り専用の sandbox | `-s read-only` |
| 作業ディレクトリ（と、既定では一時ディレクトリ）に書ける sandbox | `-s workspace-write` |
| 作業ディレクトリ | `-C <dir>`（端末の作業ディレクトリと揃える） |
| 一発実行 | `codex exec <上の引数> -o <出力ファイル> "<handoff を読む指示>"` |
| 対話 | `codex <上の引数> "<handoff を読む指示>"`（最初の指示は起動の引数として渡す） |

`-o` を付けると、最終メッセージを CLI がファイルに書く。read-only の役は自分でファイルを書けないので、結果を欠けずに受け取るにはこの形を使う。

codex-plugin-cc（`/codex:*`）は、指定が無ければ利用者の Codex の既定で動く。モデルと effort を指定できるのは `/codex:rescue` で、役割を分けたいときだけ `--model` と `--effort` を明示する。`/codex:review` と `/codex:adversarial-review` は、利用者の Codex の既定で動く。codex-plugin-cc 1.0.6 の `spark` という別名は退役済みのモデルを指すので使わない。

## requested と verified

- プロンプトや引数に書いた値は requested にとどまる。
- `codex exec` は起動時に model・sandbox・reasoning effort・session id を出力する。この出力を確かめたら、クライアントが報告した実行設定として verified と記録する。
- 対話の起動では、端末のステータス行に出るモデルと effort を読んで確かめる。読めなければ requested のまま記録する。

記録の書き方は → `dev-core:best-practices` の `references/delegation-and-review.md` §10

## 出典

- Codex のモデル一覧: https://learn.chatgpt.com/docs/models
- Codex 向けのプロンプトのガイド: https://learn.chatgpt.com/guides/prompting-gpt-6-2-astra
- モデルページ: https://developers.openai.com/api/docs/models/gpt-6.2-astra
- 移行ガイド: https://developers.openai.com/api/docs/guides/latest-model
