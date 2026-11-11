# ADJUST.md — テンプレート適用時の置換ポイント

assets/ のテンプレートは pnpm + Next.js/TS + Azure Container Apps + AWS Bedrock の例であり、
選定したプロジェクトに合わせて適合させる。そのままデプロイできる汎用スタックではない。
既存の強制ゲートは維持し、新規の advisory チェックは比例的に導入する。
適用時に必ず確認・置換する箇所の一覧。

## 全ファイル共通
- [ ] モデル ID はテンプレートに書かれていない。リポジトリ変数に設定する。未設定の job は、エージェントを動かす前に失敗する
      - `HOTL_MODEL_LIGHT`: ai-review(全 PR)・incident-triage・agent-implement
      - `HOTL_MODEL_DEEP`: ai-review の Tier 2 深堀りレビュー
      - `HOTL_JUDGE_MODEL`: eval-gate の judge(生成側と別のモデルが理想)
      - 値は Bedrock で組織が有効化済みの推論プロファイル ID(`claude-` を含む ID)にする。現行モデルの ID は
        Anthropic の「Claude in Amazon Bedrock」と「Claude on Amazon Bedrock(legacy)」のモデル表で確認する。
        deprecated のモデル(Sonnet 4.5 など)は選ばない。設定した日付と、モデル表を確認した日付を記録する
      - alias(`sonnet` / `opus` / `haiku` / `fable`)は入れない。Bedrock では alias が旧世代のモデルに解決される
        ことがある(2026-11-12 確認: `sonnet` は Sonnet 4.5、`haiku` は Haiku 4.5)
      - アプリケーション推論プロファイルの ARN は避ける(下の effort の項)
- [ ] Bedrock のモデルのライフサイクルは、Anthropic とは別に決まる。AWS の model lifecycle(Active / Legacy / EOL /
      public extended access)で確かめ、Legacy のモデルは選ばない。Legacy のモデルは、15日使わないとアクセスを
      失うことがある。めったに走らない incident-triage では特に避ける(障害のときに初めて失敗する)
      - 例(2026-11-12 確認): Sonnet 4.5 は、ap-northeast-1 を含む商用リージョンで 2026-10-08 に Legacy になった。
        public extended access は 2027-01-08 から、EOL は 2027-04-08。Anthropic 運営基盤での退役(2026-11-30)とは
        日程が違う
- [ ] データの処理地域は、プロジェクトの要件で決める。テンプレートの要件は「コードを Anthropic の直 API に出さない」
      ことで、国内処理までは約束しない。処理地域は推論プロファイルで決まる。Geo プロファイル(`jp.`・`apac.` など)は
      その地域の中で、Global プロファイル(`global.`)は世界中でルーティングされる
      - 国内処理が要件なら、`jp.` の Geo プロファイルがあるモデルを選ぶ。2026-11-12 時点では Opus 5.5 と Haiku 5.5 に
        ある(東京と大阪へルーティング)。選ぶ前に AWS の model card で確かめ直す
      - Sonnet 5.5 と Fable 5.2 は、東京からは `global.` しか使えない(2026-11-12 確認)。2.0.x のテンプレートが
        使っていた `apac.` より、処理地域が広がる
      - Fable 5.2 は bedrock-runtime のエンドポイントでしか使えない(bedrock-mantle は不可)。テンプレートの経路
        (claude-code-action と run_evals.py)は bedrock-runtime を使う
- [ ] effort はモデル変数と組で決め、組で記録する。テンプレートは各エージェントに `--effort` を明示し、値を
      リポジトリ変数で受け取る。変数が無ければ既定を使い、不正な値はエージェントを動かす前に止める
      - `HOTL_EFFORT_LIGHT`(既定 medium): ai-review の全 PR
      - `HOTL_EFFORT_DEEP`(既定 high): ai-review の Tier 2 深堀りレビュー
      - `HOTL_EFFORT_IMPLEMENT`(既定 medium): agent-implement
      - `HOTL_EFFORT_TRIAGE`(既定 medium): incident-triage
      - effort を省くと、モデル変数を替えるだけで effort も黙って変わる。Claude Code の既定はモデルごとに違う
        (2026-11-12 確認: Fable 5.2・Opus 5.5・Sonnet 5.5・Haiku 5.5 は medium、Opus 4.7 は xhigh、ほかは high)
      - 使える level はモデルで違う。対応しない level を指定すると、Claude Code はそれ以下で最も高い level で動かす。
        effort に対応しないモデル(Haiku 4.5 など)では効かない
      - Claude Code は、モデル ID を既知のパターンと照らして、effort と thinking への対応を判定する。アプリケーション
        推論プロファイルの ARN のような ID は判定できないことが多く、そのときはこれらの機能が無効になる
        (`--effort` も効かない)。
        能力を宣言する `ANTHROPIC_DEFAULT_*_MODEL_SUPPORTED_CAPABILITIES` は pin したモデル向けの変数で、
        claude-code-action が Claude Code に渡す env の一覧に無い。`--model` に渡した ARN に効くかは確かめていない
      - `--effort` は、Claude Code 2.1.72 の changelog に修正の記載があり、遅くともその版から使える。`xhigh` は
        2.1.111 から。claude-code-action が入れる Claude Code の版は、pin した SHA で決まる(下の項)
- [ ] エージェントは `--setting-sources user` で動くので、プロジェクトの CLAUDE.md は自動では読み込まれない
      (Claude Code 2.1.322 で確認)。各プロンプトの先頭で、リポジトリのルートの CLAUDE.md を Read で読ませている。
      プロンプトを書き換えるときも、この指示を残す。`--setting-sources user` は外さない(ai-review の節)
      - ルートの CLAUDE.md だけを規範として読ませる。PR のイベントで base の版に戻るのはルートの CLAUDE.md で、
        サブディレクトリの CLAUDE.md は PR の head の版のまま
      - agent-implement と incident-triage は PR のイベントではないので、既定ブランチの checkout を読む。
        incident-triage は runbooks/ も読ませる
- [ ] AWS リージョン(ap-northeast-1)→ 組織のリージョン
- [ ] secrets 名(GITHUB_OIDC_ROLE / AZURE_CLIENT_ID* / TEAMS_WEBHOOK_URL 等)→ 実在の secrets に合わせ、未作成なら作成手順を成果物に添える
- [ ] サードパーティ actions(`dorny/paths-filter` / `marocchino/sticky-pull-request-comment` /
      `gitleaks/gitleaks-action` 等)をタグでなく commit SHA に pin する
      (テンプレは可読性のため `@vN` で書いてある。CI 自体が Tier 2 である以上、適用時に pin が既定)。
      Organization / enterprise の allowed actions policy で SHA ピンを強制している場合、pin していない
      workflow は実行時に失敗する。pin と更新は Renovate などで機械化し、手作業にしない
- [ ] `anthropics/claude-code-action` も commit SHA に pin する。SHA が次の2つを決めるので、pin を上げる前と、
      モデル変数や effort を替える前に確かめる。Renovate の更新 PR でも確かめる
      - 中で入れる Claude Code の版(`src/entrypoints/run.ts` の `claudeCodeVersion`。2026-11-12 時点の v1 は 2.1.322)。
        モデルごとに必要な版がある(例: Fable 5.2 は 2.1.321 以上)。足りなければ pin を上げる
      - PR のイベントで、ルートの CLAUDE.md・`.claude/`・`.mcp.json` などを PR の base ブランチの版に戻してから
        Claude Code を起動すること(`src/github/operations/restore-config.ts` と、`run.ts` の `restoreConfigFromBase`)。
        CLAUDE.md が復元の対象に入ったのは commit `6e2bd52`(2026-04-05)から。ai-review のプロンプトは、この復元を
        前提に作業ツリーの CLAUDE.md を読ませる。復元を含まない版を使うなら、`git show <base.sha>:CLAUDE.md` のように、
        信頼できる base から読ませる
- [ ] actions はどれも Node 24 で動く版にしてある(GitHub のホストランナーから Node 20 は 2026-09-23 に外れた)。
      self-hosted runner なら v2.327.1 以上にする。版を下げて Node 20 の版に戻さない

## workflows/ci.yml
- [ ] pnpm → 実際のパッケージマネージャ(npm/yarn/uv/poetry)。Python系ならL1-L5を ruff / mypy / pip-audit / pytest に読み替え
- [ ] `pnpm/action-setup` は pnpm 11 以降なら v6.1.0 以降、pnpm 10 以下なら v5 にする(`@v6` の浮動タグは
      2026-10-26 時点で v6.0.10 を指し、pnpm 12 に対応していない)
- [ ] `NODE_VERSION` は現行の LTS から選ぶ(2026-10-26 時点で v24。v22 は 2027-04-30 に EOL、v26 は 2026-10-28 に LTS 入り)
- [ ] `pnpm lint` / `pnpm test` / `pnpm build` → 実在するスクリプト名
- [ ] カバレッジ閾値 → vitest.config の `coverage.thresholds`(全体)に、既存カバレッジ実績に合わせた
      現実的な値から設定し、段階的に上げる。変更ファイルだけに要求したい場合は、差分を実際に判定する
      ツールを選び、入力形式との互換を fixture で確かめてから導入する
- [ ] 新規に導入するノイズの多いチェックは較正期間中に観測する。既存の強制済み security ジョブを弱めない

## workflows/ai-review.yml
- [ ] Tier 2 paths-filter → アセスメントで特定したリスクパスに全面書き換え(最重要)
- [ ] CODEOWNERS と paths 定義を同期させる
- [ ] workflow を有効化する前に、`assets/scripts/check_review_verdicts.py` を trusted base 側の
      `.github/scripts/check_review_verdicts.py` にコピーする。テンプレを更新するときは、この validator と
      ai-review.yml を同じ版に揃える(validator は workflow が渡す `LIGHT_DOWNLOAD` / `DEEP_DOWNLOAD` を前提にする)
- [ ] 観測中は `AI_REVIEW_ENFORCE` を未設定のままにする。不完全な証拠は不完全として記録し、
      較正後に強制化する
- [ ] light/deep の verdict は、その実行で新たに作られ、非負の件数と、レビュー対象の head SHA を
      含むことを必須にする。欠落・不正形式・revision 不一致・失敗・skipped の各ケースをテストする
- [ ] レビュープロバイダの認証情報と許可ツールを制限する。JSON として妥当でも、PR の内容と
      モデル出力は非信頼のまま扱う
- [ ] レビュー job の `--allowedTools` は、PR へのコメント手段と判定ファイル1つへの書き込み(`Edit(//<絶対パス>)`)
      だけにする。`github_token: ${{ github.token }}` を外さない。判定ファイルのディレクトリはエージェントの前に
      新しく作る(前回の判定を残さない)
- [ ] エージェントの `claude_args` から `--setting-sources user` と `--strict-mcp-config` を外さない。`--allowedTools` は
      事前承認の追加で上限ではないため、外すとリポジトリ(PR の head を含む)の `.claude/settings.json` の allow や
      `.mcp.json` で権限が広がる
- [ ] レビューのエージェントが読む作業ツリーの CLAUDE.md は、claude-code-action が PR の base の版に戻したもの
      (全ファイル共通の claude-code-action の項)。プロンプトは、PR の差分にある CLAUDE.md の変更を、指示ではなく
      レビューの対象として扱わせる
- [ ] light review は `--max-turns 5` で、CLAUDE.md を読む分の手番が増える。プロンプトは差分の取得と同じ手番で
      読ませているが、観測期間に手番が足りているか(判定ファイルが毎回書かれているか)を確かめる
- [ ] LIGHT か DEEP に、安全分類器を持つモデル(Fable 系・Opus 5.5・Sonnet 5.5・Opus 5)を使うなら、拒否のときの
      fallback 先を設定する。攻撃者の視点の深堀りレビューは cyber の分類に当たりやすく、初回のリクエストから
      拒否されうる
      - Bedrock では、Opus の pin(`ANTHROPIC_DEFAULT_OPUS_MODEL`)が無く、プロバイダのモデル一覧に Opus 4.8 も無いと、
        fallback はどのモデルでも無効になり、拒否のまま終わる(Claude Code の model-config の「Enable fallback on
        Bedrock, Agent Platform, and Foundry」。2026-11-12 確認)
      - テンプレートは各エージェントの job の env で、`ANTHROPIC_DEFAULT_OPUS_MODEL` をリポジトリ変数
        `HOTL_FALLBACK_OPUS_MODEL` から、`ANTHROPIC_DEFAULT_SONNET_MODEL` を `HOTL_FALLBACK_SONNET_MODEL` から受け取る。
        claude-code-action はこの2つを job の env から Claude Code に渡す。変数が未設定なら空のまま渡り、従来と変わらない
      - 値には、組織で有効化済みの別の Opus(例: Opus 4.8)と Sonnet(例: Sonnet 5)の推論プロファイル ID を入れる。
        fallback 先は、元のモデル以上のコンテキストウィンドウ(Bedrock では既定で 1M)を持つ必要がある。拒否した
        モデル自身や、別の系列のモデルを入れると、拒否のまま終わる
      - Sonnet 5.5 は、Opus の pin に加えて Sonnet の pin(か、モデル一覧の Sonnet 5)が要る
      - fallback が起きると、その後のレビューと判定ファイルは fallback 先のモデルが書く。監査証跡には、変数に設定した
        モデルではなく、実際に動いたモデル(実行ログ(execution file)の result メッセージの `modelUsage`)を残す
      - 拒否で終わると判定ファイルが書かれず、validator は不完全な証拠として扱う(Phase 2 ではマージが止まる)。
        観測期間に拒否の件数を記録する。拒否が続くなら、PoC の指示を「攻撃が成立する根拠(到達経路と前提条件)を
        示す」に弱めることも検討する
- [ ] LIGHT・DEEP のモデル変数や effort を替えるときは、Phase 1(`AI_REVIEW_ENFORCE` 未設定)に戻すか、同じ PR 群で
      新旧の verdict を並べて比べてから切り替える。CRITICAL の件数の出方は、モデルと effort の組で変わる

## workflows/agent-implement.yml
- [ ] Issue テンプレート(受入条件必須)を .github/ISSUE_TEMPLATE/ に併設する
- [ ] ブロックする操作(依存追加・カラム削除)がプロジェクト実態と合うか確認
- [ ] 読み取り専用の認可ジョブが、ラベル付与者のリポジトリ権限を照会できることを確認する
      (サンプルは admin 権限を要求し、API エラー時は fail closed)
- [ ] 自律実装を有効化する前に environment reviewer を設定し、承認時点の Issue 本文/revision を
      保存する。編集可能な Issue 本文は、恒久的な承認スナップショットにならない
- [ ] `--allowedTools` の lint / typecheck / test のコマンドを、プロジェクトの実在するスクリプトに置き換える。
      依存のインストールはエージェントの前の step で行い、エージェントには install を直接のコマンドとして許さない。
      push 先は Issue のブランチに固定したままにし、`gh api`・merge・force push を足さない。PR の作成をエージェントに
      許さない(`gh pr create` の引数は接頭辞の許可では縛りきれない)。PR は別の job が repo・head・base・Draft を
      固定して作る。ファイルの編集の許可は作業ツリー(`Edit(//<workspace>/**)`)と PR 用の2ファイルに限り、
      何も付けない Edit / Write を足さない(作業ツリーの外の Actions の環境ファイルを書き換えられるため)
- [ ] PR を作る step は既定で GITHUB_TOKEN を使うので、その PR では pull_request の workflow が自動では走らない。
      PR 上で CI や ai-review を走らせるなら、独自の GitHub App を作り(Contents・Pull requests の書き込み)、
      `vars.HOTL_APP_ID` と `secrets.HOTL_APP_PRIVATE_KEY` を設定する。create-github-app-token v3.1 以降は
      `client-id`(App の Client ID)が推奨だが、actionlint 1.7.12 が未対応なので、テンプレは `app-id` のまま
- [ ] テストと git commit(フック)はリポジトリのコードを実行し、job の認証情報が環境にある。その子プロセスの中の
      操作は事前承認の範囲では制限されない。外部者が Issue を起票できる環境では、environment reviewer と CP1 での
      本文確定を必ず組み合わせる

## workflows/eval-gate.yml(エージェント系のみ)
- [ ] 発火 paths(prompts/ 等)→ 実際のプロンプト・検索ロジックの置き場所
- [ ] TARGET_ENDPOINT / EVAL_BUCKET の vars 設定
- [ ] PR の評価は候補を隔離したプレビュー環境に向ける。対象の各レスポンスに、`EXPECTED_REVISION` と
      一致するデプロイ済み `revision` を含めることを必須にする。共有 staging での PASS は PR の証拠にならない
- [ ] PR 実行時は runner と閾値を trusted base 側に置く。閾値ポリシーの変更は別途レビューし、
      候補が自分のゲートを下げられないようにする
- [ ] thresholds.json の値はそのまま使わず、初回 full 実行の実測から設定する
- [ ] 2.0.x から上げるときは、thresholds.json の `judge_total_floor` / `judge_total_drop_allowed` を
      `judge_axis_pass_rate_floor` / `judge_axis_pass_rate_drop_allowed` と `judge.pass_score` に置き換え、
      baseline.json は `--baseline` を付けない較正実行で作り直す。古い設定や baseline のままだと、
      run_evals.py は理由を出して止まる(比較を黙って飛ばさない)
- [ ] anthropic SDK は major を固定したまま使う(テンプレートは `>=1.17,<2`)。1.x 以降は sampling
      パラメータ(temperature 等)を受け付けないので、judge の分散は票数で抑える。2.x(API 2026-10-21)に
      上げるときは、judge を Bedrock で 2026-10-21 に対応したモデル(Claude 4.7 以降)へ移し、
      IAM・エンドポイントの変更をあわせて行う。上げる前にネットワークなしの契約テスト
      (cc-plugins の scripts/tests/test_hotl_sdk_contract.py が例)を新しい版で通す
- [ ] judge の `max_tokens` は thinking の分を見込む。thinking が既定で有効な judge(Opus 5 以降、Sonnet 5 以降、
      Haiku 5.5、Fable 系)は、`thinking` を送らなくても考え、thinking も `max_tokens` に含まれる。Opus 4.7 / 4.8 は、
      省略すると thinking なしで動く。テンプレートの既定は 16000。初回の較正で `usage.output_tokens` を見て決める。
      SDK は、非ストリーミングの呼び出しで約 21,333 を超える値を送る前に拒否するので、それより上げない
      - 足りないと、票は JSON を書き切る前に止まる。run_evals.py は、捨てた票ごとに理由と `stop_reason` を出す。
        `stop_reason=max_tokens` なら、`judge.max_tokens` を上げるか `judge.effort` を下げる
- [ ] judge の effort は、`thresholds.json` の `judge.effort`(low / medium / high / xhigh / max)で指定できる。
      指定したときだけ送り、不正な値なら評価を始めずに止まる。指定しなければモデルの API の既定が効き、
      Claude Code の既定とは違うことがある(2026-11-12 確認: Messages API の既定は Fable 5.2 と Sonnet 5.5 が high、
      Opus 5.5 と Haiku 5.5 が medium)。effort を受け付けないモデル(Haiku 4.5 など)では指定しない
- [ ] judge のモデルと effort は組で記録する(レポートと results.json に両方が出る)。どちらかを変えるときは、
      eval-gate の結果と L3 の人間較正を新旧で比べてから切り替える
- [ ] レビュー済み baseline は、`--baseline` を付けない較正実行で明示的に初期化し、workflow を
      有効化する前に保存する。通常運用でのダウンロード欠落・失敗で比較を無効化しない
- [ ] レポート/artifact の出力先はランナーの新しい一時ディレクトリ(`$RUNNER_TEMP` 配下)にする。
      公開するのはその実行で新たに得た結果だけにし、セットアップ失敗時に候補側が用意した
      PASS レポートを公開しない
- [ ] PR 時の trusted-runner 方式(base 側 checkout)は維持する。runner(run_evals.py)を
      変更する PR では「マージ後の nightly で初めて新 runner が secrets 付きで走る」ことをチームに周知

## evals/run_evals.py(エージェント系のみ)
- [ ] `call_target()` を評価対象の API 契約に合わせて書き換える(この1関数に隔離してある)
- [ ] 対象から返るデプロイ済み revision の証拠を保持する。runner に渡された期待 SHA から合成しない
- [ ] 対象/judge の実行エラーは品質スコアと分けて扱い、不完全な suite は fail にする。
      設定した judge の票数とスコア範囲をすべて検証する
- [ ] L1 メトリクス(recall@5 / MRR)は検索型 QA 前提。検索を伴わないエージェントなら
      決定的チェック(禁止出力・フォーマット・refusal)のみに削る
- [ ] golden set のファイル名・カテゴリを自分のドメインで設計し直す
      (雛形の golden.sample.jsonl は構造の例。references/eval-design.md のカテゴリ設計に従う)

## workflows/deploy.yml
- [ ] デプロイ先コマンド一式(Container Apps 前提)→ 実際の基盤に書き換え。
      不変条件: staging自動 → environment承認(CP3)→ health watch → 自動ロールバック
- [ ] /api/health 相当のヘルスエンドポイントの存在確認(なければ先に実装)
- [ ] GitHub Environments(production)の Required reviewers 設定手順を成果物に添える
- [ ] 実行可能な `.github/scripts/capture-production-state.sh <output-json>` と
      `.github/scripts/restore-production-state.sh <input-json>` を実装する。両方が揃うまで
      本番の preflight は意図的に失敗する
- [ ] revision モード、不変のデプロイ済みイメージ/revision、実際のトラフィック配分を capture する。
      未対応の状態はデプロイ前に拒否する。対象の revision/イメージだけでなくルーティングも restore し、
      ヘルスを検証し、いずれかが失敗したら非ゼロで終了する
- [ ] 選定した基盤で、復旧の成功と失敗の両方をリハーサルし、タイムアウトを設け、両方の結果を
      認可済みの人間向け通知チャネルに接続する。ファイルの存在は preflight にすぎず、復旧の証明ではない

## workflows/incident-triage.yml
- [ ] 調査用ロールが Read-Only であることを IaC/手順で担保(Reader + ログ閲覧のみ)
- [ ] --allowedTools のコマンド列を対象基盤の read 系コマンドに書き換える。接頭辞は具体的なサブコマンドまで
      書く（`az monitor:*` のような広い接頭辞は変更系サブコマンドも通す）。`gh api` のような汎用コマンドや
      書き込み系コマンドを足さない。`--tools` の絞り込みと、`--disallowedTools` のファイル編集系ツールの
      禁止は外さない
- [ ] Issue に載るのはエージェントの最終回答だけだが、最終回答もログを引用しうる。Issue の閲覧範囲
      （private リポジトリか）を確認し、必要なら投稿前のマスキングを足す
- [ ] claude-code-action の `github_token: ${{ github.token }}` を外さない。外すと、書き込み権限を持つ
      Claude GitHub App トークンがエージェントに渡る。triage job の permissions は read と id-token だけにする
- [ ] Issue 作成と通知は report job に分けたままにする(エージェントを書き込み権限のある job で動かさない)
- [ ] アラートの payload は env: 経由でファイルに書き出して読ませる。prompt や run: に `${{ }}` で展開しない
- [ ] アラート → repository_dispatch の中継(Function/Logic App)は別途実装が必要

## templates/
- [ ] CLAUDE.md.template → プロジェクトの絶対規範・コマンド・規約に全面書き換え(雛形の構造だけ維持)。
      リポジトリのルートに置く(workflow のエージェントはルートの CLAUDE.md を読む)
- [ ] 「よくある間違い」に追記する行には、理由と適用範囲を付ける。モデルを替えたときと定期的に見直し、理由が
      無くなった行は削る。モデルは溜まった注意書きをよく守るので、要らない承認を求めたり、定型の作業を止めたり
      することがある。絶対に守らせる行には、適用範囲と理由を書き、例外の経路(「〜の前に人間の承認を得る」)を
      規則の中に書く
- [ ] CODEOWNERS.template → 実ユーザー名、Tier 2 パス
- [ ] setup-branch-protection.sh → Phase 2 で実行(Phase 1 では実行しない)
