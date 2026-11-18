---
name: herdr-execute
description: "作成済みの docs/plans/task-*.md を、Herdr の端末に起動した Codex に実装とレビューを渡しながら実行する。親（Claude）が計画・判断・統合・検証・受け入れを持ち、範囲と受け入れチェックが決まった実装単位を Codex に渡す。Herdr の中で、計画の実装を Codex（GPT）に任せたいときに /dev-core:herdr-execute で起動する。commit・push・PR は明示指定時だけ行う。"
argument-hint: "[計画書のパス] [--commit] [--pr]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Agent(dev-core:build-error-resolver), Agent(dev-core:code-reviewer), Agent(dev-core:security-auditor)
---

# Herdr の端末を使った計画の実行

計画の実行契約は `/dev-core:execute` と同じものを使う。この workflow が変えるのは、実装単位を誰が持つかと、渡し方・受け取り方だけである。親（このセッション）は、計画・判断・統合・検証・受け入れを持ち続ける。

## 0. 読み込みと前提

1. `dev-core:best-practices` と `dev-core:codex-collab` をロードする。`dev-core:codex-collab` の references を3つ読む: `codex-roles.md`（役割とモデル）、`codex-handoff.md`（渡し方と受け取り方）、`herdr-terminals.md`（端末の扱い）。
2. `${CLAUDE_PLUGIN_ROOT}/workflows/execute/SKILL.md` を Read する。その §1〜§7 と Stop Rules を、下の読み替えと、この skill の §1〜§5 の追加を加えて適用する。ファイルを読めなければ、実装を始めずに報告する。
3. `herdr-terminals.md` §1 で面を検出する。Herdr の外なら端末を操作せず、そのことを伝えて `/dev-core:execute` を案内して終える。
4. 端末の起動・送信・読み取りは、この skill の `allowed-tools` に入れていない。利用者の権限モードに従う。

### execute の本文の読み替え

Read した本文では、置換変数が置換されずに名前のまま残っている。次のとおりに読み替える。

| execute の本文に残っているもの | この workflow での値 |
|---|---|
| 引数の置換変数（§1 の 1 で解析する対象） | `$ARGUMENTS` |
| effort の置換変数（§1 の 6 の「このターンの実効 effort」） | `${CLAUDE_EFFORT}` |
| 「この skill」、`/dev-core:execute` | この workflow（`/dev-core:herdr-execute`） |
| `allowed-tools` にある agent | この skill の `allowed-tools` にある agent。`tdd-practitioner` への委譲は、この workflow では Codex の実装役への dispatch に置き換える |

引数の解析（最初の非 option 引数が計画書のパス、`--commit` と `--pr` が delivery flags）と、delivery flags が無いときの扱い（commit・push・PR をしない）は、execute §1 と §5 のままにする。

## 1. Prepare で足すこと

最初に、計画を読むだけで再開かどうかを確かめる。Dispatch Ledger に済んでいない dispatch があれば再開である。

- **再開のとき**: execute §1 のうち書き込みとブランチの切り替えを伴う手順（計画の backfill、branch の作成・switch、Status や Progress Log の更新）より先に、`herdr-terminals.md` §7 の突き合わせを行う。前の書き手が動いているうちは、ブランチを切り替えず、計画ファイル以外に書き込まず、別の書き手も起動しない。所有が確かめられてから、execute §1 の残りに進む。
- **新しく始めるとき**: execute §1 をそのまま行う。

そのうえで、次を足す。

1. 計画の先頭の metadata に `- Workflow: herdr-execute` が無ければ書く。再開するときに、同じ workflow で続けるための記録になる。
2. 計画に Dispatch Ledger の節が無ければ作る（書く内容は `herdr-terminals.md` §9）。
3. 検出した面と、その CLI と Codex CLI の版を Progress Log に記録する。

## 2. 実装単位の持ち主

この workflow を起動したことは、「範囲と受け入れチェックが決まった実装単位を Codex の実装役に渡してよい」という明示の指示として扱う。それ以外の作業の持ち主は、execute §3 のままにする。

| 作業 | 持ち主 |
|---|---|
| 範囲・インターフェース・受け入れチェックが決まった実装単位 | Codex の実装役（対話） |
| 判断が残る作業（曖昧な要件、アーキテクチャ、スコープ、公開契約、データ） | 親。判断を済ませてから、決まった範囲を渡す |
| 渡すと handoff の往復が増えるだけの、密結合な統合 | 親 |
| 決定的なコマンド（build・typecheck・lint・test・diff の確認）、短く機械的な編集 | 親がツールで直接 |
| 大量のエラーログの隔離、リスクゲートの独立評価 | execute §3 の表の agent（条件もそのまま） |

- 範囲が決まっていることは、渡してよい条件であって、利得そのものではない。渡すたびに、Decision Log に1行（期待する利得、書き込み範囲、役割、親に戻る条件）を残す。
- execute §3 の Execution Loop は、手順をそのまま使う。2 の「親が Red → Green → Refactor で実装する」は、「実装単位の持ち主が」と読み替える。Codex に渡すときも、テストを先に書くことと、既存のテストを弱めないことを handoff に書く。
- 3 の focused verification は、Codex に渡した単位でも親がツールで直接実行する。Codex の「通った」という報告は証拠にしない。

## 3. 渡して受け取る

実装単位ごとに、次の順で進める。

1. **準備**: dispatch ID を決め、dispatch の作業ディレクトリに handoff を書き、渡す前の状態を保存して、その記録のハッシュを応答に書き出す（`codex-handoff.md`）。Dispatch Ledger に記録する。
2. **起動**: handoff のハッシュが控えた値と一致することを確かめる。役割の設定（`codex-roles.md`）と、作業ディレクトリ・sandbox を明示し、handoff を読む指示を起動の引数として渡して、対話の実装役を起動する（`herdr-terminals.md` §4）。必要な制限を付けて起動できなければ、起動せずに §5 で扱う。起動したら画面を読み、起動時の確認が出ていれば `herdr-terminals.md` §5 の「起動時の案内と確認」のとおりに扱う。
3. **待つ**: 指示の処理が始まったことを確かめて待つ。待つ間、親が同じチェックアウトに書くのは計画ファイルだけにし、読み取りの調査や次の単位の handoff の準備を進める。準備した handoff と、更新した計画は、ハッシュを応答に書き出しておく（`codex-handoff.md`）。
4. **完了を確かめる**: 状態だけで判断せず、その dispatch の報告であることを確かめる（`herdr-terminals.md` §6）。
5. **受け取る**: `codex-handoff.md` の「結果の受け取り方」の順で進める。渡す前の状態の記録が書き換えられていないことをハッシュで確かめてから、今の状態と比べ、変更をすべて読み（テストが弱められていないか、受け入れチェックが実行するスクリプトや設定が変えられていないか）、そのあとで受け入れチェックを親が実行し直す。報告の「実行しなかったチェック」「遭遇した問題」も読む。
6. **Triage**: 結果を execute §4 の Concern Triage で処理する。実装役の `needs-parent` と `blocked` は、表の「子 agent が `needs-parent` か `blocked` で返った」の行で扱う。
7. **修正を返す**: 直すことがあれば、確かめた内容と範囲だけを同じ端末に返す。同じ dispatch ID に新しい試行の番号を付け、返却にその番号を求める。送るのは、状態と画面で入力を待っていると確かめられたときだけにする（`herdr-terminals.md` §5）。同じ修正の経路での失敗は3回までとし、担当を替えても回数を引き継ぐ。
8. **記録**: 計画の Progress Log、Completion Contract、Dispatch Ledger、Current Next Action を更新する。

同じチェックアウトで書き込む担当は、同時に1人までにする。並行に進めるのは、計画が独立トラック（書き込み範囲・依存・共有リソースが重ならない）と別の作業場所を明示しているときだけにする。

## 4. レビュー

execute §3 のレビューゲート（対象、候補が安定してから1回、渡す入力、指摘を直した後の見直し）と §6 の Final Gate は、そのまま使う。足すのは担当の選び方だけである。

- **受け取りの確認はゲートのレビューではない**: Codex が書いた変更は、§3 の 5 で親が diff をすべて読む。これは受け入れの確認で、リスクゲートの独立レビューの代わりにはならない。
- **ゲートの独立レビュー役**: 既定は、Codex の読み取り専用のレビュー役（一発実行、新しい dispatch）にする。実装役の端末や文脈を使い回さない。渡すのは、元の要件、候補の識別子、検証の生の出力で、実装の経緯や自己評価は渡さない。
- **独立性**: 独立性を支えるのは、新しい文脈、元の要件、実装の経緯を渡さないことである。別のモデルであることだけでは足りない。
- **セキュリティ・権限・秘密情報の境界**: execute のとおり `security-auditor` も使う。Codex のレビューで置き換えない。
- **使えないとき**: Codex のレビュー役を起動できない、結果が返らない、依頼を断られた、のどれかなら、`code-reviewer` で代替する。それもできなければ、該当する criterion を `pending` のまま残し、「独立性は未充足」と理由を Decision Log に記録する。
- 指摘は、親が実ファイルと実行出力で確かめてから修正を割り当てる。

## 5. 止めない・越えない（execute §7 に足す）

- **端末が動いているうちは完了にしない**: execute §7 の「実行中のバックグラウンド agent」と同じに扱う。
- **blocked の端末には答えない**: 承認・信頼・実行を与える選択は、ユーザーの判断に属する。画面を読み、求められている内容をユーザーに伝える。Blockers には、dispatch ID、止まっている理由の種類、必要な判断だけを書く。端末は閉じずに残す。書き込みを伴う端末が残っている間、親は同じチェックアウトへの書き込みを計画ファイルの更新だけにとどめ、読み取りの調査や次の handoff の準備を進める。依存する criterion は `pending` のまま残す（`herdr-terminals.md` §5）。
- **待ちのタイムアウトは失敗ではない**: 状態と画面を読んでから次の手を決める。動いている書き手を残したまま、別の書き手を起動しない。
- **渡せないとき**: 端末の操作が権限で止められた、必要な制限を付けて起動できない、Codex が使えない、のどれかなら、越えようとしない。理由を Decision Log に記録してユーザーに伝え、その単位は親が実装して続ける（execute の既定に戻る）。ただし、起動は済んでいて、その後の操作だけができなくなったときは、書き手が動いているかもしれない。止まったことを確かめられるまで、親は実装を始めず、ユーザーに伝える（`herdr-terminals.md` §7）。必須の独立レビューは §4 の代替の順で扱う。
- **Codex に依頼を断られたとき**: 言い換えて同じ依頼を通そうとしない。断られた範囲を記録し、親が持つか、ユーザーに報告する。
- **保護された操作と外部に作用する操作**: commit・push・PR・デプロイ・共有データへの書き込みは、子に渡さない。親が execute §5 の Delivery Gate と §4 の確認に従って行う。

## 6. 終了

execute §6 の Final Gate を行ったうえで、次を足す。

1. 自分が起動して記録した端末を片付ける。blocked のまま残す端末があれば、Status を `done` にせず、その dispatch ID と理由を報告する（`herdr-terminals.md` §10）。
2. dispatch の作業ディレクトリは、受け入れが済んで計画に要約を残したものから消す。
3. 報告に、dispatch ごとの要約（役割、要求した設定と確かめられた設定、状態）と、親が実装に切り替えた単位を足す。

停止・中断・コンテキスト圧縮の前に、execute の Stop Rules のとおり計画を保存する。Dispatch Ledger には、動いている端末の名前と状態も残す。
