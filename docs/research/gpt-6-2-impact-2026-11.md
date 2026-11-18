# GPT-6.2（Astra / Sol）リリースの影響調査（2026-11）

- 調査日: 2026-11-18
- 対象: cc-plugins と codex-plugins の、Codex との協働に関わる skill・workflow・設定
- 計画と実施記録: [docs/plans/task-gpt62-herdr-2026-11.md](../plans/task-gpt62-herdr-2026-11.md)

## 1. 結論

- cc-plugins には、モデル ID を前提にした記述がほとんど無かった。古くなっていたのは、Codex を呼ぶ面と役割の説明である。`codex-collab` を「誰が何を持つか・どの面で渡すか・どう渡してどう確かめるか」の正本に組み直した。
- codex-plugins の実行プロファイルは `gpt-6-astra` と `gpt-6-sol` を指していた。ID を `gpt-6.2-astra` と `gpt-6.2-sol` に差し替えた。役割・preset・effort は変えていない。
- Herdr の端末で Codex を動かす workflow を2つ新設した（設計用の `/dev-core:herdr-design`、実行用の `/dev-core:herdr-execute`）。
- 役割ごとのモデルと effort の割り当ては、公開情報からの推論であり、測定していない。

## 2. 確認した事実

出典の種類を分けて書く。「一次」は OpenAI の文書、「報道」は発表を伝えた記事、「実機」は調査日に手元で実行した結果を指す。発表の本文は取得できなかった（HTTP 403）ので、発表にしか無い内容は報道に頼っている。文書と記事は、取得したページを要約させて読んだ。数値を使うときは原文で確かめること。

### モデル

| 事実 | 種類 |
|---|---|
| モデル ID は `gpt-6.2-astra` と `gpt-6.2-sol` | 一次（モデルページ、Codex のモデル一覧） |
| Luna の 6.2 版は一覧に無く、`gpt-6-luna` が現行 | 一次（Codex のモデル一覧） |
| Astra はコード・アプリ・調査にまたがる難しい作業、Sol は日常のコーディング・文章・計画、Luna は件数の多い絞られた作業向け | 一次（Codex のモデル一覧） |
| コンテキストは API で 1,050,000 トークン、最大出力 128,000 トークン。Codex の既定は Astra 272,000、Sol 500,000 | 一次（モデルページ、Codex のモデル一覧） |
| 両モデルは reasoning effort `none` を拒否する。`minimal` を使っていたら `low` に置き換える | 一次（モデルページ、移行ガイド） |
| Codex の effort は Light（設定では low）・Medium・High・Extra High・Max・Ultra。Max は1つの作業により長い推論時間を与え、Ultra は subagent を使う | 一次（Codex のモデル一覧） |
| 価格（100万トークン、Standard）は Astra が入力 8 ドル・出力 40 ドル、Sol が入力 2 ドル・出力 10 ドル。入力が 272,000 トークンを超えると単価が上がる | 一次（モデルページ） |
| 発表は 2026-11-17。Astra は GPT-6 Astra の後継、Sol は GPT-6.1 Sol の後継 | 報道 |
| OpenAI は、コーディングの評価で Sol が Astra に近い成績を、より低いコストで出したと発表した | 報道（OpenAI 自身の評価。第三者の検証は未確認） |
| システムカードは、モデル単体の評価（障害を開示しない傾向を測るもの）で、両モデルが作業の報告から既知の障害を省きやすくなったことを後退として記載した。Codex の開発者向けプロンプトは、この評価での省略を大きく減らすとしている | 一次（システムカード） |
| API を直接使う場合は、Codex の開発者向けプロンプトが適用されない | 報道 |
| 両モデルはサイバーセキュリティの能力で Critical の閾値に達し、高リスクなサイバーセキュリティ支援の既定の制限が強化された。Astra は AI の自己改善の能力で High の閾値に達した | 一次（システムカード） |

### Codex 向けの書き方（一次: Codex 向けのプロンプトのガイド）

- 必要なことを、プロジェクトを知っている同僚に話すように書く。そのうえで、レビューで何を見るかを伝える。
- 何をもって終わりとするか、どこを徹底してほしいかを伝える。
- effort の目安は、Medium が手早い調査、High が1つの原因を複数の箇所にわたって追う作業、Extra High が複数の原因が絡む作業。
- 独立した部分があるときは「必要に応じて subagent を使う」と伝える。Ultra は自分で subagent を立てるので、きれいに分かれる大きな作業に取っておく。
- AGENTS.md は短く保ち、コード・テスト・文書から推測できない要件と規約だけを書く。日常の進め方は任せる。
- 複数のエージェントが同じマシンを使うときは、同時に走らせる build とテストを絞らせる。終わるときに、自分が始めたバックグラウンドのジョブを止め、一時ファイルを消させる。

### 手元での確認（実機）

| 事実 | 確かめ方 |
|---|---|
| Codex CLI 0.166.0 は両方のモデル ID を受理する | read-only の最小の `codex exec` |
| 対話の `codex` と `codex exec` は、モデル・effort・sandbox の引数を受け付ける。`codex exec` は最終メッセージをファイルに書ける | CLI のヘルプと実行 |
| `codex exec` は起動時に model・sandbox・reasoning effort・session id を出力する | 実行の出力 |
| Herdr には制御面が2つある（TUI 版の `herdr`、デスクトップ版の `hc`）。環境変数で見分けられる | ヘルプと、実行中の環境 |
| デスクトップ版で、Codex の起動・状態の検出・送信・完了待ち・読み取り・後始末が通る | 対話と一発実行のスモーク |
| デスクトップ版で、使い捨ての fixture に対する通しの流れ（渡す前の状態の保存、対話の実装役、親による比較と受け入れチェックの再実行、読み取り専用の一発レビュー、後始末）が通る | references の手順どおりのスモーク。実装役は許した2ファイルだけを変え、レビュー役は終了コード 0・新しい出力ファイル・一致する dispatch ID で返った |
| TUI 版で、一発実行（pane で実行し、終了の目印を待ち、結果ファイルを読む）と対話（agent の起動・送信・待ち・読み取り）が通る | 隔離した名前付きセッションでのスモーク。pane の外から操作したので、自分の pane を基準にする指定は未確認 |
| 待ちがタイムアウトしても、端末のプログラムは動き続ける | 短いタイムアウトでのスモーク |
| 書き込める sandbox（`workspace-write`）は、作業ディレクトリ・`/tmp` の配下・`TMPDIR` の配下に書け、ホームの下のほかの場所には書けない | `codex sandbox` での確認（モデルは呼ばない） |
| 対話の Codex に、最初の指示を起動の引数として渡すと、起動時の確認を見送ったあとに、送信なしで処理が始まる | デスクトップ版でのスモーク |
| 作業ツリー版の `/dev-core:herdr-execute` を Herdr の外で起動すると、引数が渡り、execute の本文が読まれ、端末を操作せずに `/dev-core:execute` が案内される | ヘッドレスでの1回の実行（Sonnet 5.5） |
| Codex は、信頼されていないディレクトリで起動すると信頼の確認で止まる。更新の案内やフックの確認の画面が、入力欄より先に出ることがある | スモークでの観察 |
| 確認の画面が出ている間は、状態が idle と報告されたり、送信が成功を返したのに文面が入力欄に残ったりする | TUI 版のスモークでの観察 |
| codex-plugin-cc の最新は 1.0.6。`spark` の別名は退役済みのモデルを指し、effort の選択肢に `none` と `minimal` が残っている | プラグインのソースとタグ |

## 3. 変更

### cc-plugins（dev-core 5.3.0）

| 変更 | ファイル |
|---|---|
| `codex-collab` を、所有・面の選び方・契約の正本に組み直す | `dev-core/skills/codex-collab/SKILL.md` |
| 役割ごとのモデルと effort（モデル ID を書く唯一の場所） | `dev-core/skills/codex-collab/references/codex-roles.md` |
| handoff の文面と、結果の受け取り方 | `dev-core/skills/codex-collab/references/codex-handoff.md` |
| Herdr の端末の扱い | `dev-core/skills/codex-collab/references/herdr-terminals.md` |
| 設計用の workflow | `dev-core/workflows/herdr-design/SKILL.md` |
| 実行用の workflow | `dev-core/workflows/herdr-execute/SKILL.md` |
| eval ケース、README、版 | `dev-core/evals/`、`dev-core/README.md`、`README.md`、各 `plugin.json` |

### codex-plugins（dev-core 5.8.0）

| 変更 | ファイル |
|---|---|
| 実行プロファイルの ID を GPT-6.2 に差し替える | `plugins/dev-core/skills/codex-collab/assets/execution-profile.json` |
| テスト・eval・評価の手引き・README を追随させる | `scripts/tests/`、`plugins/dev-core/evals/`、`README.md` ほか |
| 外部の親から handoff を受ける側の契約を足す | `plugins/dev-core/skills/codex-collab/references/external-handoff.md` ほか |

### 設計の要点

- **モデル ID の置き場所**: cc では1ファイルに絞った。これまでは「Codex 側のモデルの値は cc に持ち込まない」方針だったが、端末で役割ごとに起動するには値が要るので、置き場所を絞ったうえで反転した。
- **起動の形**: 読み取り専用の役（設計・レビュー・調査）は一発実行にし、結果を CLI にファイルへ書かせる。read-only の役は自分でファイルを書けず、対話の端末の履歴は欠けることがあるため。実装役は対話で起動する。
- **結果の扱い**: 実装役の報告は主張として扱い、親が渡す前の状態と比べ、変更をすべて読んでから、受け入れチェックを自分で実行し直す。報告に問題が書かれていないことを、問題が無かった証拠にしない。
- **親の記録を守る**: 書き込める sandbox の子は一時ディレクトリにも書けるので、親が書いた記録（渡す前の状態、準備した handoff、計画）はハッシュを控えて照合する。
- **入力の渡し方**: 対話の実装役には、最初の指示を起動の引数として渡す。起動時の確認の画面に親が送ってよいのは、見送りや閉じる操作と表示されている Esc だけにし、届いたか分からないときは送り直さない。
- **権限**: 新しい workflow は、端末を操るコマンド（起動・送信・読み取り・待機）を事前に許可しない。起動と送信は任意のコマンドの実行と同じ力を持ち、読み取りはほかの端末の内容にも届くので、すべて利用者の権限モードに委ねる。子の Codex の権限は、起動時の sandbox と承認の設定で決まり、Claude Code 側の許可は届かない。
- **Herdr の構文**: skill には写していない。面の検出と動詞の対応だけを書き、構文はバイナリのヘルプに委ねた。

## 4. リポジトリの外（利用者の環境で確かめること）

リポジトリからは直せないので、編集していない。

- Codex の既定のモデルが前の世代のままなら、端末で役割を指定しない起動や codex-plugin-cc の既定の実行は、前の世代のモデルで動く。
- Codex CLI に新しい版が出ている。更新すると引数や出力が変わることがあるので、更新後は `codex-roles.md` の「起動の引数」をヘルプと突き合わせる。
- herdr の個人スキルが古いと、今の CLI に無いコマンドを案内することがある。`herdr --skill` が出力する内容で置き換える。
- デスクトップ版の Herdr を使っている場合、TUI 版向けの skill は環境変数の確認で止まる。新しい workflow はデスクトップ版を別に検出する。
- Codex が起動時に更新の案内を出す間は、対話の実装役の起動のたびに画面を1つ閉じることになる。Codex を更新するか、案内を次の版まで止めると出なくなる。
- Codex のプラグインのフックが承認待ちになっていると、起動時に確認の画面や警告が出る。承認するかどうかは利用者が決める。
- codex-plugins を更新した後は、再インストールして新しいスレッドを始めるまで反映されない。

## 5. 未測定・未確認

- 役割ごとのモデルと effort の割り当ての効果。実装を Sol、レビューを Astra とする根拠は、公開されている用途の説明と OpenAI 自身の評価であり、手元の作業での比較はしていない。
- TUI 版の `herdr` で、pane の中から自分の pane を基準に操作する経路。確認は、隔離したセッションを外から操作して行った。
- 長いレビュー結果を、対話の端末の履歴から欠けずに読めるか（そのため一発実行を既定にした）。
- 新設の workflow を、インストールした状態で slash command から起動した通しの実行。確認したのは、references の手順を手で追った流れである。
- 新しい eval ケースの実行。スキーマ検証は通しているが、行動は実行していない。

## 6. フォローアップ

- Codex が親になって Herdr の端末を操る手順（今回は対象外）。
- TUI 版の、pane の中からのスモーク。
- インストールした状態での、2つの workflow の通しの実行。
- 割り当ての比較評価（同じ作業で1つの値だけを変える）。
- codex-plugin-cc が現行モデルに追随したら、`codex-collab` の注記を見直す。

## 出典

- Codex のモデル一覧: https://learn.chatgpt.com/docs/models
- Codex 向けのプロンプトのガイド: https://learn.chatgpt.com/guides/prompting-gpt-6-2-astra
- モデルページ: https://developers.openai.com/api/docs/models/gpt-6.2-astra
- 移行ガイド: https://developers.openai.com/api/docs/guides/latest-model
- 発表（調査時は本文を取得できなかった）: https://openai.com/index/introducing-gpt-6-2-astra-sol/
- システムカード: https://deploymentsafety.openai.com/gpt-6-2-astra-sol
- Codex の sandbox と承認: https://learn.chatgpt.com/docs/agent-approvals-security
- 報道: https://www.itmedia.co.jp/news/article/2611/18/2000003279/ 、https://forest.watch.impress.co.jp/docs/news/2157295.html 、https://www.watch.impress.co.jp/docs/news/2157303.html
- Claude Code の skills のドキュメント: https://code.claude.com/docs/en/skills
- codex-plugin-cc: https://github.com/openai/codex-plugin-cc
