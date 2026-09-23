# ADJUST.md — テンプレート適用時の置換ポイント

assets/ のテンプレートは pnpm + Next.js/TS + Azure Container Apps + AWS Bedrock の例であり、
選定したプロジェクトに合わせて適合させる。そのままデプロイできる汎用スタックではない。
既存の強制ゲートは維持し、新規の advisory チェックは比例的に導入する。
適用時に必ず確認・置換する箇所の一覧。

## 全ファイル共通
- [ ] Bedrock モデルID(`apac.anthropic.claude-*`)→ 組織で有効化済みの inference profile に置換
- [ ] AWS リージョン(ap-northeast-1)→ 組織のリージョン
- [ ] secrets 名(GITHUB_OIDC_ROLE / AZURE_CLIENT_ID* / TEAMS_WEBHOOK_URL 等)→ 実在の secrets に合わせ、未作成なら作成手順を成果物に添える
- [ ] サードパーティ actions(`dorny/paths-filter` / `marocchino/sticky-pull-request-comment` /
      `gitleaks/gitleaks-action` 等)をタグでなく commit SHA に pin する
      (テンプレは可読性のため `@vN` で書いてある。CI 自体が Tier 2 である以上、適用時に pin が既定)

## workflows/ci.yml
- [ ] pnpm → 実際のパッケージマネージャ(npm/yarn/uv/poetry)。Python系ならL1-L5を ruff / mypy / pip-audit / pytest に読み替え
- [ ] `pnpm lint` / `pnpm test` / `pnpm build` → 実在するスクリプト名
- [ ] カバレッジ閾値(70%)→ 既存カバレッジ実績に合わせて現実的な値から開始
- [ ] 新規に導入するノイズの多いチェックは較正期間中に観測する。既存の強制済み security ジョブを弱めない

## workflows/ai-review.yml
- [ ] Tier 2 paths-filter → アセスメントで特定したリスクパスに全面書き換え(最重要)
- [ ] CODEOWNERS と paths 定義を同期させる
- [ ] workflow を有効化する前に、`assets/scripts/check_review_verdicts.py` を trusted base 側の
      `.github/scripts/check_review_verdicts.py` にコピーする
- [ ] 観測中は `AI_REVIEW_ENFORCE` を未設定のままにする。不完全な証拠は不完全として記録し、
      較正後に強制化する
- [ ] light/deep の verdict は、その実行で新たに作られ、非負の件数と、レビュー対象の head SHA を
      含むことを必須にする。欠落・不正形式・revision 不一致・失敗・skipped の各ケースをテストする
- [ ] レビュープロバイダの認証情報と許可ツールを制限する。JSON として妥当でも、PR の内容と
      モデル出力は非信頼のまま扱う

## workflows/agent-implement.yml
- [ ] Issue テンプレート(受入条件必須)を .github/ISSUE_TEMPLATE/ に併設する
- [ ] ブロックする操作(依存追加・カラム削除)がプロジェクト実態と合うか確認
- [ ] 読み取り専用の認可ジョブが、ラベル付与者のリポジトリ権限を照会できることを確認する
      (サンプルは admin 権限を要求し、API エラー時は fail closed)
- [ ] 自律実装を有効化する前に environment reviewer を設定し、承認時点の Issue 本文/revision を
      保存する。編集可能な Issue 本文は、恒久的な承認スナップショットにならない

## workflows/eval-gate.yml(エージェント系のみ)
- [ ] 発火 paths(prompts/ 等)→ 実際のプロンプト・検索ロジックの置き場所
- [ ] TARGET_ENDPOINT / EVAL_BUCKET の vars 設定
- [ ] PR の評価は候補を隔離したプレビュー環境に向ける。対象の各レスポンスに、`EXPECTED_REVISION` と
      一致するデプロイ済み `revision` を含めることを必須にする。共有 staging での PASS は PR の証拠にならない
- [ ] PR 実行時は runner と閾値を trusted base 側に置く。閾値ポリシーの変更は別途レビューし、
      候補が自分のゲートを下げられないようにする
- [ ] thresholds.json の値はそのまま使わず、初回 full 実行の実測から設定する
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
- [ ] --allowedTools のコマンド列を対象基盤の read 系コマンドに書き換え
- [ ] アラート → repository_dispatch の中継(Function/Logic App)は別途実装が必要

## templates/
- [ ] CLAUDE.md.template → プロジェクトの絶対規範・コマンド・規約に全面書き換え(雛形の構造だけ維持)
- [ ] CODEOWNERS.template → 実ユーザー名、Tier 2 パス
- [ ] setup-branch-protection.sh → Phase 2 で実行(Phase 1 では実行しない)
