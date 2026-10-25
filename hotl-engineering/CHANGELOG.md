# Changelog — hotl-engineering

このスキルへの変更は必ずここに記録する（HANDOFF の運用ルール）。
references の内容変更・description の意味的変更は PR で提案し、承認を得てから反映する。

## 2.1.0 — 2026-10-25

**BREAKING（テンプレートを適用する人向け）**: モデル ID をテンプレートに書かず、リポジトリ変数で指定する。
既定だった Sonnet 4.5 は deprecated（Anthropic 運営基盤での退役は 2026-11-30）で、適用先が気づかないまま
退役に巻き込まれるのを防ぐ。

- モデル ID を `vars.HOTL_MODEL_LIGHT`（ai-review の全 PR、incident-triage、agent-implement）、
  `vars.HOTL_MODEL_DEEP`（Tier 2 の深堀りレビュー）、`vars.HOTL_JUDGE_MODEL`（eval の judge）に移した。
  未設定の job は、エージェントを動かす前に失敗する。run_evals.py の JUDGE_MODEL も既定値を持たず、
  未設定なら評価を始めずに終了コード 2 で止まる
- **ai-review**: エージェントにツールを1つも許可していなかったため、判定ファイルを書けず、強制モードでは
  全 PR が通らなくなるおそれがあった。上流の PR レビュー例と同じコメント手段（インラインコメント、
  `gh pr comment`・`gh pr diff`・`gh pr view`）と、判定ファイル1つへの書き込みを事前承認した。
  判定ファイルのディレクトリはエージェントの前に新しく作り、`github_token` を明示した
- **全エージェント**: `--setting-sources user` と `--strict-mcp-config` を付け、リポジトリ（PR の head を含む）の
  `.claude/settings.json` の allow や `.mcp.json` で権限が広がらないようにした（上流の action は既定で
  user・project・local の設定を読み、`--allowedTools` は事前承認の追加で上限ではないため）
- **agent-implement**: 同じく Bash を許可しておらず、手順の「lint / typecheck / test を実行」「push」
  「Draft PR の作成」ができなかった。必要なコマンドを直接のコマンドとして事前承認した（push 先は Issue の
  ブランチに固定、`gh api`・merge・force push・依存の追加は事前承認しない）。依存はエージェントの前に
  ロックファイルどおり入れる。`gh pr create` に `--repo` / `--head` / `--draft=` を付けることは拒み、
  作られた PR はエージェントの後の step で Draft に戻す。プロンプトに、テストを弱めて通さないこと、
  仕様とテストが矛盾したら質問して終了すること、PR 本文に変更・削除した既存テストと根拠を書くことを加えた。
  テストと git commit（フック）がリポジトリのコードを実行し、そのとき job の認証情報が環境にあることを、
  残るリスクとしてヘッダと ADJUST.md に明記した
- CLAUDE.md.template: 自前の DB はモックせず、実物で integration テストする
- ADJUST.md: モデル変数の選び方、レビューと自律実装のツール付与の確認項目を追加
- 回帰テスト: モデル ID の直書きが無いこと、変数が未設定なら止まること、各エージェントの `--tools` が決めた
  集合と一致しリポジトリの設定を読まないこと、事前承認と拒否のツールが明示した集合と一致すること（同じ
  フラグの複数回指定も合わせて読む）、PR が Draft に戻されること、判定ファイルのディレクトリが毎回新しく
  なること、環境変数の無い CLI 実行で judge のモデルが必須であること

## 2.0.2 — 2026-10-25

配布テンプレートの不具合修正（スキル本文の判断基準は変更なし）。

- **eval-gate.yml / run_evals.py**: anthropic SDK 1.0.0（2026-08-20）以降、`messages.create` は
  sampling パラメータ（temperature / top_p / top_k）を受け付けない。2.0.0 で入れた「temperature を
  受け付けるモデルにだけ送る」処理は、既定の judge（Sonnet 4.5）と thresholds.json の `temperature: 0`
  の組み合わせで全票が TypeError になり、fail-closed のゲートが常に閉じていた。テンプレートは SDK を
  固定せず、ランナーが毎回最新の SDK を入れるため、テンプレートのまま使っている適用先では
  2026-08-20 以降のすべての実行が該当する
  - judge には sampling パラメータを送らない。thresholds.json に残っていても無視し、実行ログに出す。
    thresholds.json から `temperature` を削除
  - SDK を `anthropic[bedrock]>=1.17,<2` に固定。2.x は API 2026-10-21 を送り、旧世代の judge は
    Bedrock で非対応になる
  - judge の失敗ログに例外メッセージの先頭を出す（型名だけでは SDK の破壊的変更を追えなかった）
  - 既定の judge（Sonnet 4.5）は deprecated（Anthropic 運営基盤での退役は 2026-11-30）。後継への移行と
    SDK 2.x 化は次の minor で扱う。ADJUST.md に移行の確認項目を追加
  - eval-gate.yml: `inputs.suite` を `run:` に直接展開していたのを env: 経由に変更
- **incident-triage.yml**: 「Read-Only」の宣言と実装の食い違いを修正
  - `Bash(gh api:*)` を外した。claude-code-action に `github_token` を渡していなかったため、
    書き込み権限を持つ Claude GitHub App トークンがエージェントに渡っていた。`github_token: ${{ github.token }}`
    を明示し、triage job の権限を read と id-token に絞った
  - 使えるツールを `--tools` で Read / Grep / Glob / Bash に絞り、Bash の事前承認を読み取り専用の
    コマンド接頭辞に限定した（`az monitor:*` と `az webapp log:*` は変更系サブコマンドも含むため、
    `az monitor activity-log list` などの具体的なコマンドと `az containerapp logs show` に置き換え）。
    ファイル編集系ツールは `--disallowedTools` でも明示的に禁止
  - アラートの payload を prompt に直接展開していたのを、env: 経由でファイルに書き出し、非信頼データと
    明示して読ませる形に変更
  - Issue 作成と Teams 通知を、エージェントが動かない report job（`issues: write` のみ）に分離。
    Teams の webhook URL も env: 経由にした
  - Issue 本文に execution file（ツール出力を含む実行ログ全体）をそのまま投稿していたのを、最終回答だけを
    取り出して投稿する形に変更（2.0.1 以前からの問題）
  - 要約が無い・空白だけ・投稿に失敗した場合も、Run への案内だけで Issue を作る（`find` の失敗で
    フォールバックの前に終了していた）
- **ci.yml**: 「Coverage on changed files (>= 70%)」ステップを削除。実際には全体カバレッジの閾値で判定し、
  入力形式も vitest の出力と合っていなかった。カバレッジ閾値は、適用先の vitest.config の
  `coverage.thresholds` で全体に掛ける運用に改め（テンプレートは vitest.config を同梱しない）、
  ADJUST.md の確認項目も合わせた
- references/eval-design.md: sampling パラメータと SDK の版固定についての記述を更新
- docs/trigger-boundaries.md: ui-ux-pro-max が cc-plugins から削除されたことを反映
- 回帰テスト（cc-plugins の scripts/tests/）: 上記の各点を検査するテストと、固定した版の SDK で judge の
  呼び出し経路をネットワークなしで通す契約テスト（test_hotl_sdk_contract.py）を追加

## 2.0.1 — 2026-09-23

dev-core 5.0.0 の構成変更に合わせたドキュメントの修正。スキル本文・テンプレート・evals は変更なし。

- docs/trigger-boundaries.md: 廃止された dev-core の task-team への案内を削除。レビューの境界に、
  バグ探索全般は Claude Code 組み込みの `/code-review`、規約レンズでのレビューは dev-core:code-review
  という分担を追加。スキル数の固定値を削除し、スラッシュ専用の workflows に grill を追加

## 2.0.0 — 2026-09-23

Codex 版（codex-plugins の hotl-engineering 2.0.0 / 2.0.1）の変更を日本語正本へ翻案反映。

- **BREAKING**: テンプレートは trusted な verdict 検証・対象 revision の証拠・プロジェクト固有の
  recovery adapter を要求する
  - ai-review.yml: verdict を `$RUNNER_TEMP` 配下に出力し、レビュー対象の head SHA を含める。
    集約 job `ai-review-gate` は trusted base 側に設置した `.github/scripts/check_review_verdicts.py`
    （同梱 `assets/scripts/check_review_verdicts.py`）で、欠落・不正形式・revision 不一致・ジョブ失敗を
    不完全な証拠として扱う（観測中は記録のみ、`AI_REVIEW_ENFORCE=true` で fail）
  - eval-gate.yml / run_evals.py: 対象レスポンスのデプロイ済み `revision` を `--expected-revision` と
    照合し、対象/judge の実行エラー・無効票・空の suite を品質スコアと分けて fail にする。
    PR 実行時は閾値も trusted base 側を使い、レポートは新しい一時ディレクトリにだけ出力する
  - deploy.yml: `.github/scripts/capture-production-state.sh` / `restore-production-state.sh` が
    揃うまで本番の preflight が失敗する。ロールバックは revision の有効化ではなく、
    capture した状態（ルーティング含む）の restore とヘルス検証で行う
  - agent-implement.yml: ラベル付与者のリポジトリ admin 権限を読み取り専用の認可ジョブで確認し、
    API エラー時は fail closed。書き込み権限は実装ジョブにだけ付与する
- **BREAKING**: 導入手順は既存の保護を弱めない（SKILL.md Step 4 を改訂）
  - 旧: security 層を `continue-on-error: true`、branch protection は PR 必須 + force push 禁止のみ、
    2週間の較正期間で強制化
  - 新: 新規の advisory/AI チェックだけを観測モードで導入し、既存の blocking な security チェック・
    branch protection・must-pass 条件は維持する。昇格条件は代表的な実行結果・責任者・無効化手段
    （経過期間だけを証拠にしない）。branch protection の変更は明示的な外部変更権限の範囲でのみ、
    差分を先に示す
- SKILL.md: 既存のユーザー承認を再利用し、実装依頼ならローカル変更を準備する（質問は未解決の
  重要な方針と権限外の外部変更だけ）。必要なテンプレートだけを適用し、`quality-gate` で既存の
  required checks を黙って置き換えない。限定的な変更に CP1〜CP4 のすべてを導入しない。
  本番プロダクト / エージェント系の推奨サブセットを「実際のリスクで正当化できるゲート」に改訂。
  Bedrock/Azure は任意のプロバイダアダプタとして扱う。Step 5 にオフライン fixture での
  失敗系検証と verdict 検証スクリプトの設置を追加。モードBは回答の形を判断に合わせる
  （description はトリガー評価で較正済みのため据え置き）
- ADJUST.md: 上記テンプレートの適用要件（verdict 検証スクリプトの設置を有効化より先に、
  revision 照合、baseline の明示的初期化、recovery adapter の実装とリハーサル、`$RUNNER_TEMP`）を追加。
  旧来の「prompt 内の exit 1 を無効のまま」項目を削除
- decision-frameworks.md / eval-design.md: 数値閾値・件数・期間は較正すべき例と明記。
  F1 の「Tier 2 が3割超ならパス定義が広すぎる」と F5 の「4週間誤分類ゼロ」を証拠ベースの表現に改訂。
  eval の完全性条件と、ワークフロースキルの振る舞い eval の要件を追加
- workflows/apply・assess: 新しい Step 4 の方針に合わせ、既存の保護の棚卸しと維持を明記
- evals/cases.json: #7（既存の required checks を持つプロジェクトへ導入しても保護を弱めない）を追加。
  #1 の期待値を新しい承認・観測モードの方針に合わせて更新

## 1.0.0 — 2026-07-04

- hotl-engineering スキル v1 を cc-plugins マーケットプレイスに統合（独立プラグインとして新設）
- 公開リポジトリ向けにクライアント・案件固有の識別子を汎用プレースホルダへ置換
  （リソース名・CODEOWNERS ユーザー名・eval 対象システム名・golden サンプルのドメイン）。
  スキルの思想・構成・判断フレームは v1 のまま不変
- description を拡張: リポジトリ引き継ぎ・開発フロー構築・少人数自律開発のトリガーを追加し、
  通常のコーディング作業では起動しない負の境界を明記（blanket 節は scoped に書き換え）。
  検証イテレーション2で「実験・PoC への導入依頼も対象（押し返すため）」を追記
- 検証ケース 6 件を `evals/cases.json` として同梱し、with-skill / baseline 比較 +
  トリガー判定 5 試行を実施（結果: `evals/report-2026-07-04.md`。6/6 合格）
- 独立レビュー（advisor / Codex）の指摘を反映:
  - incident-triage.yml: 非信頼入力（alert_name）の shell 直展開を env 経由 + jq 生成に修正（injection 防止）
  - ci.yml: security 層の Phase 1 既定を `continue-on-error: true` に（day-one enforcement 防止、原則6と整合）
  - eval-gate.yml: PR トリガー + secrets のリスク注記を追加、CODEOWNERS.template の Tier 2 に `/evals/` を追加
  - agent-implement.yml: Issue 本文 = prompt injection 経路の注記と推奨ガードを追記
  - ADJUST.md: サードパーティ actions の SHA pin 項目、run_evals.py の置換ポイント（call_target / metrics / golden 設計）を追加
  - run_evals.py: judge 1 票の API 失敗で suite 全体が落ちないよう例外処理を追加
- レビューで提案された強化 4 点を実装:
  - eval-gate.yml: PR 実行時は runner コードを base 側から checkout する trusted-runner 方式に
    （PR による runner 差し替え + secrets 実行を遮断）
  - agent-implement.yml: `environment: agent-implement` を追加（Required reviewers を設定すると
    ラベル付与後にもう1段の人間承認を挟める。未設定なら従来どおり）
  - ai-review.yml: verdict(JSON artifact) + 集約 job `ai-review-gate` による機械的ゲート化。
    Phase 2 の強制化は vars.AI_REVIEW_ENFORCE=true + required check "ai-review-gate" の2手
    （prompt 内 exit 1 依存を廃止）。setup-branch-protection.sh のヒントも更新
  - 適用モードの明示スラッシュ入口 `/hotl-engineering:assess`（Step 1–2 で停止）と
    `/hotl-engineering:apply`（Step 3–5、計画なしの全部入りコピー禁止）を workflows/ に追加
