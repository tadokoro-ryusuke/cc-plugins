# Task: GPT-6.2 への追随と、Herdr の端末で Codex を動かす workflow の新設（2026-11）

- Status: in-progress
- Plan file: docs/plans/task-gpt62-herdr-2026-11.md
- 調査報告: docs/research/gpt-6-2-impact-2026-11.md
- Last updated: 2026-11-18

## 目標

1. GPT-6.2（Astra / Sol）のリリースに合わせて、Claude Code と Codex の協働の説明を今の事実に直す。
2. 設計と実装のどこで GPT を使うかを、1つの構造に整理する（面の選び方、役割とモデル、handoff の契約）。
3. Herdr の端末で Codex を起動し、設計の独立案・敵対的レビューと、実装・レビューを任せる workflow を2つ新設する。
4. codex-plugins を、端末で仕事を受ける側としてきちんと動くように更新する。

## スコープ

### トラック A: GPT-6.2 への追随（Herdr に依存しない）

- cc `dev-core/skills/codex-collab`: 面の選び方・役割・handoff の正本に組み直す。references を3つ足す。
- cc `docs/research/gpt-6-2-impact-2026-11.md`: 事実・出典・変更・リポジトリの外の報告。
- codex `execution-profile.json`: モデル ID を GPT-6.2 に差し替える。テスト・eval・README を追随させる。
- codex: 外部の親から handoff を受ける側の契約を足す。

### トラック B: Herdr の workflow（cc のみ）

- cc `dev-core/workflows/herdr-design`: 設計。
- cc `dev-core/workflows/herdr-execute`: 計画の実行。
- eval ケース、README、版（dev-core 5.3.0、codex dev-core 5.8.0）。

トラック A は B の未検証の部分に依存させない。ファイルの持ち主はトラックごとに分ける（`codex-collab/references/herdr-terminals.md` と workflows、eval の herdr ケースは B）。

## 非目標

- Codex が親になって Herdr の端末を操る手順（依頼に無い。フォローアップとして報告する）。
- 実行プロファイルの役割・preset・effort の組み替え（ID の差し替えだけにする。比較評価は未実施）。
- インストール済みプラグインの更新、利用者の Codex 設定や個人スキルの編集。
- main への push と merge（merge はユーザーが行う）。

## Evidence Baseline（2026-11-18 に確認）

| 事実 | 確かめ方 |
|---|---|
| モデル ID は `gpt-6.2-astra` と `gpt-6.2-sol`。Luna の 6.2 版は無く `gpt-6-luna` のまま | OpenAI のモデルページ、Codex のモデル一覧 |
| 両モデルは reasoning effort `none` を拒否する。`minimal` は `low` に置き換える | モデルページ、移行ガイド |
| Codex の effort は Light（low）/ Medium / High / Extra High / Max / Ultra。Ultra は subagent を使う | Codex のモデル一覧 |
| Codex CLI 0.166.0 は、認証済みの1つの環境で両 ID を受理する | read-only の最小の `codex exec` を2回実行。どちらも exit 0 |
| 対話の `codex` と `codex exec` は `-m`・`-s`・`-c model_reasoning_effort=` を受け付ける。`codex exec` は `-o` で最終メッセージをファイルに書く | `codex --help`、`codex exec --help` |
| `codex exec` は起動時に model・sandbox・reasoning effort・session id を出力する | 実行の出力 |
| Herdr の制御面は2つある。TUI 版は `herdr` CLI（pane・agent。`HERDR_ENV=1`）。デスクトップ版は `hc`（terminal。`HC_TERMINAL_ID`） | `herdr --help`（0.8.2）、`hc --help`（0.1.21）、実行中の環境変数 |
| `hc` で、起動・状態の検出（idle → done）・送信・ターンの完了待ち・読み取り・子の一括待機・削除が通る | 対話の Codex を read-only で起動するスモーク |
| `hc` の端末で `codex exec -s read-only -o <file>` を流すと、exit code と出力ファイルが得られる。read-only でも workspace の外の handoff を読める | 一発実行のスモーク |
| `hc` には pane の配置を変える API が無い（配置はアプリが持つ） | `hc schema` |
| `herdr` 0.8.2 に `herdr wait` というコマンド群は無い（待つのは `agent wait` と `pane wait-output`）。古い手引きはこの構文を案内していることがある | `herdr wait` の実行、`herdr --skill` |
| codex-plugin-cc の最新は 1.0.6。`spark` の別名は退役済みのモデルを指す | GitHub のタグ、プラグインのソース |
| `${CLAUDE_PLUGIN_ROOT}` と `${CLAUDE_SKILL_DIR}` は skill の本文で置換される。`disable-model-invocation: true` の skill は Skill ツールで読み込めない | Claude Code の skills のドキュメント |

未確認:

- TUI 版の `herdr` で、pane の中から自分の pane を基準に操作する経路（確認は、隔離したセッションを外から操作して行った）。
- 長いレビュー結果を、対話の端末の履歴から欠けずに読めるか。
- 新設の workflow を、インストールした状態で slash command から起動した通しの実行。
- 役割ごとのモデルと effort の割り当てが品質とコストに与える効果（比較評価は未実施）。

## 判断

| ID | 判断 | 理由 | 戻し方 |
|---|---|---|---|
| D1 | モデル ID を cc に置く。置き場所は `codex-collab/references/codex-roles.md` の1ファイルだけ | 端末で役割ごとに起動するには `-m` が要る。Codex の既定を継承すると役割を分けられない。これは「Codex 側のモデル値を cc に移さない」という以前の方針の反転 | そのファイルを消し、継承に戻す |
| D2 | codex の実行プロファイルは ID の差し替えだけにする | 役割・preset・effort はこれまで利用者が決めてきた。発表当日の公開ベンチで組み替えない | ID を戻す |
| D3 | codex-plugins は「handoff を受ける側」までにする | 依頼の素直な読み。Codex が親になる手順は依頼に無い | — |
| D4 | Herdr の構文は skill に写さない。面の検出と、動詞の対応だけを書く | Herdr は速く変わる。個人スキルはすでに古い。正はインストール済みのバイナリのヘルプ | — |
| D5 | 新 workflow の `allowed-tools` に、端末を操る Bash（`hc`・`herdr`・`codex`）を入れない | 起動と送信は任意のコマンドの実行と同じ力を持ち、読み取りはほかの端末の内容にも届く。利用者の権限モードに委ねる（レビュー F13 で読み取りも外した） | 利用者が自分の設定で許可を足す |
| D6 | herdr-execute は execute の契約を `${CLAUDE_PLUGIN_ROOT}/workflows/execute/SKILL.md` の Read で再利用する。引数・effort・tools は herdr-execute が自分で束ね、読んだ本文の置換変数を読み替える。execute の §3 は丸ごと残し、差し替えるのは「委譲の条件」の表と、渡し方・受け取り方だけ | 実行契約の二重管理を避ける。Read した本文では `$ARGUMENTS` と `${CLAUDE_EFFORT}` が置換されない（レビュー F4）。§3 には TDD・テストを弱めない規則・レビューゲートがあり、落とせない（F5）。execute 本体を references に割る案は、常に効かせたい規則を追加の読み込みに依存させるので採らない | 契約を写して独立させる |
| D7 | 読み取り専用の役（設計・レビュー）は一発実行にし、最終メッセージを CLI にファイルへ書かせる。実装役は対話で起動する | 指摘は忠実に受け取る必要がある。read-only の役は自分でファイルを書けない。実装役の報告は主張で、証拠は親の diff と再実行 | — |
| D8 | cc の handoff は単独で成立させる（返却の形式・状態・未実行のチェック・再帰の禁止・後始末を handoff 自体に書く） | codex-plugins は再インストールするまで反映されず、入れていない利用者もいる | — |
| D9 | `blocked` の端末に親は答えない。例外は、画面に見送りや閉じる操作と表示されている、何も許可せず何も保存しない選択だけ（更新の案内の見送りなど）。届いたか分からない端末に、キーだけを追って送らない | 承認・信頼はユーザーの判断。execute §7 の「意図的なブロッカーは越えない」と揃える。スモークで、起動時の案内が毎回出ること、確認の画面が idle と報告されることを観察した | — |
| D10 | 既定は同じチェックアウトで書き手1人。worktree・別タブは計画が明示したときだけ | 委譲の原則 §3。Herdr の既定とも揃う | — |
| D11 | 子の権限は起動時に決める。作業ディレクトリと sandbox を明示し、承認の設定は弱めない。保護された操作と外部に作用する操作は親が持つ | 子の Codex の権限は Codex の sandbox と承認で決まり、Claude 側のフックや許可は届かない。handoff の書き込み範囲は指示にとどまる（F1） | — |
| D12 | dispatch ごとに ID・非公開の作業ディレクトリ・渡す前の状態（HEAD、staged・unstaged の差分、untracked の一覧）を記録する。再開時は台帳と端末の現在の状態を突き合わせ、前の書き手が止まったことを確かめてから所有を移す | タイムアウトや親の再起動で、書き手が生き残ることがある（F2、F12） | — |
| D13 | 完了は面ごとの証拠で確かめる。一発実行は終了コードと、その dispatch の出力ファイル。対話は、その handoff に対応する報告（dispatch ID）と、親の diff と再実行 | 状態が idle や done になっただけでは、その作業が終わったとは言えない（F3） | — |
| D14 | herdr-design は、親が自分の案を記録してから独立案を読む。統合した計画を task の形式で保存してから、その版を敵対的にレビューさせる | 2つの案が互いに引きずられるのを防ぎ、レビューされていない受け入れ条件を残さない（F10） | — |
| D15 | herdr-execute の起動は、範囲と受け入れチェックが決まった実装単位を Codex に渡してよいという明示の指示として扱う。密結合な統合・判断が残る作業・決定的なコマンド・短い機械的な編集は親が行う | 範囲が決まっていることは委譲の資格であって、利得ではない（F11） | — |
| D16 | TUI 版 `herdr` は「隔離したセッションで確認。pane の中からの経路は未確認」と明記して出す | 確かめた範囲だけを主張する（F7） | 検証が通ったら表記を外す |
| D17 | 書き込みを伴う dispatch では、渡す前の状態の記録のハッシュを親が自分の応答に控え、受け取るときに照合する | 書き込める sandbox は一時ディレクトリにも書ける。`codex sandbox` で確かめたところ、作業ディレクトリ・`/tmp`・`TMPDIR`・親のセッションの作業用ディレクトリに書け、ホームの下のほかの場所には書けなかった（実装レビュー R3） | — |
| D18 | 受け取りでは、変更をすべて読んでから受け入れチェックを実行する | 子が変えたスクリプトを、親の権限で先に動かさない（R5） | — |
| D19 | 書き込みを伴う端末が残っている間（blocked を含む）、親が同じチェックアウトに書くのは計画ファイルだけにする | 書き手は1人（D10）。比較で親の変更と子の変更が混ざらない（R4） | — |
| D20 | 計画には、端末のアドレス・ローカルのパス・画面の文面を書かない | 計画は追跡されるファイルで、公開されることがある（R16、R27） | — |
| D21 | 対話の実装役には、handoff を読む指示を起動の引数として渡す。あとから文面を送るのは修正を返すときだけにし、届いたか分からないときは送り直さない | 起動後に送った入力は、起動時の確認の画面が受け取ることがある。送信は Enter を伴うので、確認への答えになりうる（再レビュー）。起動の引数で渡した指示が、確認を Esc で見送ったあとに処理されることを実機で確かめた | — |
| D22 | 計画ファイルは親だけが書く。親が書いた記録（渡す前の状態、準備した handoff、計画）は、ハッシュを応答に控えて照合する | 書き手の子は、親の一時ディレクトリとチェックアウトに書ける（再レビュー） | — |

## 設計

### 役割

| 役割 | 既定の担当 | 面 |
|---|---|---|
| 親（要件・設計の判断・統合・受け入れ） | Claude（このセッション） | — |
| 設計の独立案・敵対的レビュー | Codex の上位モデル、read-only | 一発実行 |
| 実装 | Codex の汎用モデル、書き込みは handoff の範囲 | 対話 |
| リスクゲートのレビュー | Codex の上位モデル、read-only | 一発実行 |
| 範囲の決まった調査 | Codex の軽量モデル、read-only | 一発実行 |

モデル ID と effort は `codex-roles.md` にだけ書く。

### 面の選び方（codex-collab）

| 面 | 向く場面 |
|---|---|
| codex-plugin-cc（`/codex:*`） | 単発のレビュー、レスキュー。Herdr が無い環境 |
| Herdr の端末 | 見える場所で動かしたい、途中で介入したい、実装を続けて任せたい、複数の役を並べたい |
| `codex exec` を親の Bash で直接 | 端末も plugin も使えないときの読み取り専用の一発実行 |

### herdr-design

1. 親が要件・制約・評価軸を証拠付きで固め、要件メモを書く。
2. 計画の下書き（設計の案は無し）と Dispatch Ledger を保存してから、読み取り専用の設計役に要件メモだけを渡す。
3. 独立案を読む前に、親の案を応答の本文に書き出す（ファイルには書かない）。
4. 2つの案を突き合わせ、採否を証拠で決める。
5. 統合した計画を task の形式で保存する。
6. 保存した版を、読み取り専用のレビュー役に敵対的にレビューさせる。
7. 指摘を実ファイルで確かめ、計画に反映する。

### herdr-execute

execute の §1〜§7 と Stop Rules を、引数と effort を束ね直したうえでそのまま使う。足すのは次の点。

- 再開のときは、書き込みやブランチの切り替えより先に、前の書き手との突き合わせを行う。
- 範囲と受け入れチェックが決まった実装単位は、対話の実装役に渡す。判断が残る作業、密結合な統合、決定的なコマンド、短い機械的な編集は親が持つ。
- 実装役の報告は主張として扱う。親が渡す前の状態と比べ、変更をすべて読み、そのあとで受け入れチェックを自分で実行する。
- レビューゲートは execute のまま。独立レビュー役の既定は読み取り専用の Codex で、セキュリティの境界では `security-auditor` も使う。
- 承認待ちの端末には答えない。書き込みを伴う端末が残っている間、親が同じチェックアウトに書くのは計画ファイルだけにする。
- 終了時に、自分が起動した端末だけを片付ける。

## Iteration

1. トラック A（cc）: codex-collab の SKILL と references（`codex-roles.md`、`codex-handoff.md`）、報告書。
2. トラック B（cc）: `herdr-terminals.md`、workflows 2つ、eval、README、版。
3. トラック A（codex）: プロファイルの ID、テスト、eval、README、受け側の契約、版。
4. 検証と独立レビュー。

## 検証コマンド

- cc: AGENTS.md の「検証コマンド」節の全コマンド。
- codex: `node scripts/validate-codex-plugins.mjs`、`node scripts/validate-skill-evals.mjs`、`python3 -m unittest discover -s scripts/tests`。

## Completion Contract

| ID | 観測可能な完了条件 | 必要な証拠 | Evidence Observed | Status |
|---|---|---|---|---|
| AC-1 | cc のゲートが通る。対象は drift、agent 参照、eval スキーマ（dev-core と indie-product-marketing）、hook 検証、`node --test scripts/*.test.mjs`、dev-core の hook テスト3本、contrast のテスト、`claude plugin validate --strict`（ルートと dev-core）。hotl と `scripts/tests/` は変えないので hotl の回帰テストは対象外 | 各コマンドの出力と exit code | 実装レビューの反映後に全コマンドを実行し直した。結果は Progress Log の最後の項 | satisfied |
| AC-2 | codex のゲートが通る。対象は `validate-codex-plugins.mjs`、`validate-skill-evals.mjs`、`HOTL_REQUIRE_SDK=1` での unittest discover（CI と同じ前提） | 同上 | plugin 検証 passed、eval 検証 passed（68 ケース）、127 tests OK（PyYAML 6.0.2、anthropic 1.17.0 を入れた仮想環境） | satisfied |
| AC-3 | cc の skill・workflow・eval・README・AGENTS.md で、モデル ID（`gpt-` で始まる完全な ID）が出るのは `codex-roles.md` だけ。報告書・計画書・過去の調査文書は対象外 | 対象パスを絞った `grep` の出力 | 一致は `codex-roles.md` の8箇所だけ。`dev-core/README.md` の2箇所は報告書のファイル名 | satisfied |
| AC-4 | codex の現行の設定（実行プロファイル）・その値を固定するテスト・eval ケース・評価の手引き・README の現行の表に、旧 ID と旧ラベルが残らない。README の変更履歴と `docs/plans/` は履歴なので対象外 | 対象パスを絞った `grep` の出力 | `plugins/dev-core`・`scripts`・`AGENTS.md`・README の現行の表で一致なし | satisfied |
| AC-5 | デスクトップ版（`hc`）で、使い捨ての fixture に対して references の手順どおりに、読み取り専用の一発実行・範囲を絞った対話の実装・親による比較と再実行・後始末が通る。タイムアウト後に端末が生き残ることも確かめる | スモークの出力（計画には要約だけを書く） | 2回行った。1回目は直す前の手順（通しと、読み取り専用の一発レビュー、タイムアウト後の生存）。2回目は実装レビューを反映した手順で、基準のハッシュを控える、起動時の確認を Esc で見送る、ハッシュを照合する、変更をすべて読む、受け入れチェックを実行し直す、の順で通った（許した2ファイルだけが変わり、5テストが通った）。そのあとの再レビューで入れた「指示を起動の引数で渡す」は、単独のスモークで確かめた。起動した端末と fixture はすべて片付けた | satisfied |
| AC-6 | TUI 版 `herdr` で同じ流れが通る | スモークの出力 | 隔離した名前付きセッションで、一発実行（pane で実行、終了の目印を待つ、結果ファイル）と対話（agent の起動・送信・待ち・読み取り）が通った。セッションは停止して削除した。pane の外から操作したので、自分の pane を基準にする指定は未確認。起動の引数で指示を渡す形も TUI 版では未確認 | pending |
| AC-7 | 計画と実装のそれぞれに、新しい文脈の独立レビューを1回ずつ通し、P0/P1 が残っていない | レビューの出力と、指摘ごとの確認の記録 | 計画のレビュー17件、実装のレビュー28件（P1 が6件）、P1 の修正に絞った再レビュー（解消3件、部分解消3件、新規 P1 4件・P2 2件）を、実ファイルと実機で確かめて反映した（下の3つの表）。再レビューの指摘を反映した最後の版は、親が読み直してゲートを実行し直しただけで、独立レビューには出していない | satisfied |
| AC-8 | 新設の2 workflow と `codex-collab` の新しい振る舞いに eval ケースがあり、スキーマ検証を通る。行動の実行は未実施と明記する | `validate-skill-evals.mjs` の出力 | 13ケースを足し、検証は passed（dev-core 55 ケース）。行動を実行したのは、Herdr の外で起動するケースに当たる1回だけ（作業ツリー版のヘッドレス起動、Sonnet 5.5）で、ほかは未実行。端末と fixture が要るケースの判定方法を evaluatorNotes に書いた | satisfied |
| AC-9 | 利用者が新しい経路を見つけられる。報告書がある。ルートと dev-core の README、AGENTS.md の索引、`codex-collab` の description と compatibility が今の内容と合う。SessionStart の再開の案内が、計画に記録された workflow を示す | 該当箇所の差分 | 該当箇所を更新した。SessionStart は、対応している値（`herdr-execute`）だけを出し、テストを3ケース足した | satisfied |
| AC-10 | 新設の workflow を、インストールした状態でユーザーが slash command から起動して通す | ユーザーの実行結果 | 未実施（この作業の中では起動できない） | pending |

## Delivery Strategy

- 2026-11-18 にユーザーが「2つに分けて commit して draft PR まで進めて」と依頼した。
- cc-plugins: `feature/gpt62-herdr` に2つの commit を積み、draft PR を1つ作る。
  1. GPT-6.2 への追随（`codex-collab` の SKILL と references、報告書、索引、`codex-collab` の eval ケース）
  2. Herdr の workflow（workflow 2つ、その eval ケース、README、SessionStart の案内、版、本書）
- codex-plugins: `codex/gpt62-handoff` に1つの commit（GPT-6.2 への追随に当たる）を積み、draft PR を1つ作る。
- main への push、merge、Issue の作成、インストール済みプラグインの更新はしない。

## Risks And Stop Conditions

- Herdr の CLI が変わると、動詞の対応表が古くなる。表には確認した版を書き、ヘルプを正とする。
- 役割の割り当ては未測定。利用者に明示する。
- eval のスキーマ検証は行動の実行ではない。新ケースは pending として扱う。
- 端末の起動は利用者の Codex のクレジットを使う。スモークは最小にする。

## Progress Log

- 2026-11-18: 調査と実機確認を終え、計画を保存した。モデルは Fable 5.2、effort は high。ブランチは cc `feature/gpt62-herdr`、codex `codex/gpt62-handoff`。
- 2026-11-18: Iteration 1 のうち `codex-collab` の SKILL と references 3つ、報告書を書いた。計画のレビューを受け、D5・D6 を改訂し、D11〜D16 と AC-9・AC-10 を足した。
- 2026-11-18: Iteration 2（workflows、eval、README、索引、版）と Iteration 3（codex 側）を終えた。codex のプロファイルは、テストを先に更新して失敗（7件）を確かめてから ID を差し替え、28件が通った。
- 2026-11-18: スモークを行った。デスクトップ版は fixture での通し、TUI 版は隔離したセッション。観察したこと: 信頼されていないディレクトリでは起動時に信頼を求められる（親は答えず、信頼済みのリポジトリの配下に fixture を置き直した）。更新の案内が入力欄より先に出る。確認の画面が出ていても idle と報告されることがあり、送信が成功を返しても文面が入力欄に残ることがある。待ちがタイムアウトしても端末は動き続ける。これらを references に反映した。
- 2026-11-18: 実装のレビューを受け、28件を確かめて反映した（D17〜D20）。SessionStart の再開の案内は、テストを先に足してから実装した。
- 2026-11-18: advisor の助言で、直した手順での再スモーク、sandbox の書き込み先の実機確認、作業ツリー版の `/dev-core:herdr-execute` のヘッドレス起動（Herdr の外。Sonnet 5.5 で1回。引数の受け渡し、execute の読み込み、Herdr の外の分岐が働いた）を行った。スモーク中のキー入力で、Codex の設定ファイルは変わっていない。
- 2026-11-18: P1 の修正に絞った再レビューを受け、9件を反映した（D21、D22）。
- 2026-11-18: ユーザーの依頼で、2つの commit に分けて draft PR を作る（Delivery Strategy）。
- 2026-11-18: 最後の反映後にゲートを実行し直した。cc: drift passed、agent 参照 passed、eval passed（dev-core 55、indie 16）、hook 検証 passed、`node --test scripts/*.test.mjs` 34 pass、hook テスト3本 passed、contrast 35 pass、`claude plugin validate --strict` はルートと dev-core とも passed。codex: AC-2 のとおり。

## Decision Log

- 2026-11-18: D1〜D10 を決めた。D1 は以前の方針の反転（理由は表）。
- 2026-11-18: advisor の助言で、codex-plugins の範囲を受け側の契約までに狭め、プロファイルは ID の差し替えだけにした。

## Dispatch Ledger

| 作業 | 利得 | 役割 | 要求した設定 | 入力 | 状態 |
|---|---|---|---|---|---|
| 計画の敵対的レビュー | 実装の前に、別のモデルの新しい文脈で前提を疑う | 読み取り専用のレビュー役 | 上位モデル / high / read-only（requested） | 保存直後の計画 | completed。17件を確認して反映 |
| スモーク: fixture の実装 | 手順どおりの通しを確かめる | 実装役（対話） | 汎用モデル / low / workspace-write（画面の表示でモデルと effort を確認） | 使い捨ての fixture | completed。親が比較と再実行で確認 |
| スモーク: fixture のレビュー | 同上 | 読み取り専用のレビュー役 | 上位モデル / low / read-only（requested） | fixture の変更 | completed |
| 実装のレビュー | 両リポジトリの変更を、新しい文脈で評価する | 読み取り専用のレビュー役 | 上位モデル / high / read-only（requested） | 両リポジトリの作業ツリー | completed。28件を確認して反映 |
| スモーク: 直した手順での fixture の実装 | 直した手順を確かめる | 実装役（対話） | 汎用モデル / low / workspace-write（画面の表示でモデルと effort を確認） | 使い捨ての fixture | completed |
| P1 の修正の再レビュー | 修正が解消になっているか、矛盾を生んでいないかを確かめる | 読み取り専用のレビュー役 | 上位モデル / high / read-only（requested） | 反映後の作業ツリー | completed。9件を確認して反映 |

## 計画レビューの反映（2026-11-18）

読み取り専用の一発実行で、Codex の上位モデルに計画を敵対的にレビューさせた（要求: 上位モデル / high / read-only。起動ヘッダーは履歴から流れて読めなかったので requested として記録する）。指摘は17件（P1 が7件、P2 が9件、P3 が1件）。実ファイルで確かめた結果は次のとおり。

| 指摘 | 確認 | 反映 |
|---|---|---|
| F1 子の権限は Claude 側の許可では決まらない | 正しい。フックは親の Bash だけを見る | D11 |
| F2 タイムアウトや再起動で書き手が生き残る。SessionStart が `/dev-core:execute` だけを案内する | 正しい（`session-start-context.sh` の再開の案内） | D12、案内の文面を変える（AC-9） |
| F3 動詞の対応だけでは、その作業の完了を確かめられない | 正しい | D13 |
| F4 Read した execute の本文では置換変数が束ねられない | 正しい（skills のドキュメント） | D6 を改訂 |
| F5 §3 の差し替えで TDD・テストの規則・レビューゲートが落ちる | 正しい（execute §3、§6 は §3 を参照する） | D6 を改訂 |
| F6 AC-5 を先に satisfied にしていた。eval の検証は新 workflow が無くても通る | 正しい | AC-5 を pending に戻し、通しのスモークを足す。AC-8・AC-10 |
| F7 TUI 版を検証できる環境が無い | 正しい | D16、AC-6 は pending |
| F8 2つのリポジトリで役割の既定が食い違いうる | 正しい | `codex-roles.md` に、揃えている対応と見直しの手順を書く |
| F9 受け側の規則が dev-execute にしか無い | 正しい | codex 側は `codex-collab` の reference に置き、dev-execute から参照する |
| F10 設計の2案が引きずられる。保存した計画がレビューされない | 正しい | D14 |
| F11 範囲が決まっていることは利得ではない | 正しい（委譲の原則 §3） | D15 |
| F12 diff の基準が定まっていない | 正しい（untracked と staged が抜ける） | D12 |
| F13 端末の読み取りは機密の境界をまたぐ | 正しい（`hc read` はほかの端末にも届く） | D5 を改訂、references に規則を足す |
| F14 「全コマンド」が曖昧 | 正しい（codex の CI は `HOTL_REQUIRE_SDK=1`） | AC-1、AC-2 |
| F15 grep の条件に範囲が無い。評価の手引きの比較の腕に旧 ID がある | 正しい | AC-3、AC-4。比較の腕は現行世代の ID に直し、世代をまたぐ比較は別に記録すると書く |
| F16 報告書と、利用者が経路を見つける手段の条件が無い | 正しい（レビュー時点で報告書は未作成だった） | AC-9 |
| F17 トラック A を単独で出せる境界が無い | 一部採用 | 版と README は1つのリリース（dev-core 5.3.0 / codex 5.8.0）に属するものとし、commit はトラックで分ける |

## 実装レビューの反映（2026-11-18）

読み取り専用の一発実行で、Codex の上位モデルに両リポジトリの変更をレビューさせた（要求: 上位モデル / high / read-only。終了コード 0、新しい出力ファイル、dispatch ID の一致を確かめた。実行設定の表示は読めなかったので requested として記録する）。指摘は28件（P1 が6件、P2 が16件、P3 が6件）。

| 指摘 | 確認 | 反映 |
|---|---|---|
| R1 再開時に、前の書き手を突き合わせる前に execute §1 が書き込みとブランチの切り替えをする | 正しい | herdr-execute §1 で突き合わせを先にした。起動後に操作できなくなった場合も同じ扱いにした |
| R2 届いたか分からない端末にキーだけを送ると、確認への答えになりうる | 正しい（スモークで、確認の画面が idle と報告された） | キーを追って送る手順を消した。信頼の確認は端末を残してユーザーに委ねる |
| R3 書き込める sandbox は一時ディレクトリにも書ける。比較の基準を子が書き換えうる | 正しい（`codex sandbox` での実機確認。スモークでは基準を一時ディレクトリに置いていた） | D17 |
| R4 blocked の端末が残っているのに親が文書を編集する eval ケースが、書き手1人の規則と矛盾する | 正しい | D19。eval ケースを直した |
| R5 変更を読む前に受け入れチェックを実行すると、子が変えたスクリプトを親の権限で動かす | 正しい | D18 |
| R6 handoff の禁止事項が、範囲の外に限ると読める。デプロイや PR が明記されていない | 正しい | 両リポジトリの契約で、親だけが行う操作を無条件に書いた |
| R7 範囲の外の untracked のファイルの書き換えを検出できない | 正しい | untracked のファイルは範囲の内外ともハッシュを控える |
| R8 修正を返したあと、前の試行の報告と区別できない | 正しい | dispatch ID に試行の番号を足す |
| R9 結果が返っても Status が completed とは限らない | 正しい | 完了の確かめ方と受け取り方に Status の分岐を足した |
| R10 herdr-design が、計画と台帳を作る前に最初の子を起動する | 正しい | 起動の前に下書きと台帳を保存する |
| R11 設計役が、親の案を書いたリポジトリを読める。レビュー役への「渡さない」が計画の中身と矛盾する | 正しい | 親の案は独立案が返るまでファイルに書かない。レビューの対象は保存した計画の全体と明記した |
| R12 `/codex:review` は文面を受け取らず、契約の ID を返せない | 正しい（codex-plugin-cc 1.0.6 のコマンド定義） | 契約の適用範囲を、文面を渡せる面に絞った |
| R13 `/codex:adversarial-review` は親から起動できない | 正しい（`disable-model-invocation: true`） | 親の代替は `codex exec` の直接実行にし、slash command はユーザーに頼む |
| R14 Ultra の明示指定が、再帰委譲の禁止と両立しない | 正しい | 起動の前に確認する |
| R15 欠けた報告を、親の記録の場所に書かせる手順が契約と矛盾する | 正しい | 欠けた節だけを出し直させる |
| R16 blocked の画面の内容や端末のアドレスを、追跡される計画に写す | 正しい | D20 |
| R17 SessionStart が、計画に書かれた workflow の値を検証しない | 正しい | 対応している値だけを出す。テストを足した |
| R18 eval ケースが、用意されていない fixture と操作を前提にする | 一部採用 | evaluatorNotes に判定方法を書いた。fixture の整備はフォローアップ |
| R19 AC-1 のゲートの一覧に漏れがある | 正しい | AC-1 |
| R20 計画・報告書・次の action が、別々の段階を指している | 正しい（レビューの最中に更新を止めていたため） | 本書と codex 側の記録を、残した証拠に合わせて直した |
| R21 報告書が「読み取りと待機は事前に許可」と書いている | 正しい | 報告書を直した |
| R22 起動してからアドレスを控えるまでの中断で、所有が曖昧になる | 正しい | 端末の名前を dispatch ID にし、確かめられないときはチェックアウトを空いていないものとして扱う |
| R23 読み取り専用の返却が、指摘の形しか持たない | 正しい | 設計役と調査役の節を足した |
| R24 「全ての腕を同じ世代に」が、世代の混ざったプロファイルと矛盾する | 正しい | プロファイルの版を固定し、腕ごとに実際のモデルを記録する、に直した |
| R25 cc の2つのマニフェストの description が違う | 正しい。今回の変更より前からある | 対象外。報告に書く |
| R26 README のトラブルシューティングが codex-plugin-cc を必須と書いている | 正しい | 直した |
| R27 計画に、作者の個人の設定の内容が書かれている | 正しい | 一般的な事実に書き直した |
| R28 報告漏れの記述を、報道でなくシステムカードから引く | 正しい（システムカードを確認した） | 報告書の出典を直した。発表の本文は調査時に取得できなかったので、そのままにした |

## 再レビューの反映（2026-11-18）

実装レビューの P1 の修正に絞って、同じ形でもう一度レビューさせた（終了コード 0、新しい出力ファイル、dispatch ID の一致を確かめた）。

| 指摘 | 確認 | 反映 |
|---|---|---|
| R1・R5・R6 は解消 | — | — |
| R2 の残り: 「送り直す前に画面を読む」が、読めば送り直してよいと読める。送信は Enter を伴う | 正しい | D21。曖昧なときは何も送らず、端末を残してユーザーに伝える |
| R3 の残り: 利用者がより狭い sandbox に絞っているときに広げてしまう | 正しい | 分かっているときは広げず、ユーザーに確認する |
| R4 の残り: 親の計画ファイルが、子の書き込み範囲と重なりうる | 正しい | D22 |
| 新規: 作業ディレクトリが消えた再開で、状態を取り直しても基準にならない | 正しい | 該当する条件を pending のまま残し、ユーザーに確認する |
| 新規: 親が書いた計画の変更を、記録なしに比較から外している | 正しい | D22 |
| 新規: 書き手が動いている間に準備した handoff を、書き手が書き換えうる | 正しい（sandbox の実機確認） | D22 |
| 新規: 試行の番号を dispatch ID に足すと、端末の名前と合わなくなる | 正しい | dispatch ID は変えず、試行の番号を別に持つ |
| 新規: 断られた依頼を、別の面から Codex に出し直す形になっている | 正しい | 出し直すのは、起動や受け取りの失敗のときだけにした |

## Blockers And Open Questions

- AC-6 の残りは、TUI 版の Herdr の pane の中でしか確かめられない。
- AC-10 はユーザーの実行が要る。

## Current Next Action

draft PR のレビューと merge はユーザーが行う。残りは、AC-10（インストールした状態で、ユーザーが2つの workflow を slash command から起動して通す）と、AC-6 の残り（TUI 版を pane の中から使う経路）。
