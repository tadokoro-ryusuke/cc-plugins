# ADJUST.md — テンプレート適用時の置換ポイント

assets/ のテンプレートは pnpm + Next.js/TS + Azure Container Apps + AWS Bedrock 東京を
前提に書かれている。適用時に必ず確認・置換する箇所の一覧。

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
- [ ] Phase 1 では security ジョブの `continue-on-error: true` を有効化

## workflows/ai-review.yml
- [ ] Tier 2 paths-filter → アセスメントで特定したリスクパスに全面書き換え(最重要)
- [ ] CODEOWNERS と paths 定義を同期させる
- [ ] Phase 1 の間は prompt 内の「exit 1 でブロック」指示を無効のままにする

## workflows/agent-implement.yml
- [ ] Issue テンプレート(受入条件必須)を .github/ISSUE_TEMPLATE/ に併設する
- [ ] ブロックする操作(依存追加・カラム削除)がプロジェクト実態と合うか確認

## workflows/eval-gate.yml(エージェント系のみ)
- [ ] 発火 paths(prompts/ 等)→ 実際のプロンプト・検索ロジックの置き場所
- [ ] TARGET_ENDPOINT / EVAL_BUCKET の vars 設定
- [ ] thresholds.json の値はそのまま使わず、初回 full 実行の実測から設定する
- [ ] PR 時の trusted-runner 方式(base 側 checkout)は維持する。runner(run_evals.py)を
      変更する PR では「マージ後の nightly で初めて新 runner が secrets 付きで走る」ことをチームに周知

## evals/run_evals.py(エージェント系のみ)
- [ ] `call_target()` を評価対象の API 契約に合わせて書き換える(この1関数に隔離してある)
- [ ] L1 メトリクス(recall@5 / MRR)は検索型 QA 前提。検索を伴わないエージェントなら
      決定的チェック(禁止出力・フォーマット・refusal)のみに削る
- [ ] golden set のファイル名・カテゴリを自分のドメインで設計し直す
      (雛形の golden.sample.jsonl は構造の例。references/eval-design.md のカテゴリ設計に従う)

## workflows/deploy.yml
- [ ] デプロイ先コマンド一式(Container Apps 前提)→ 実際の基盤に書き換え。
      不変条件: staging自動 → environment承認(CP3)→ health watch → 自動ロールバック
- [ ] /api/health 相当のヘルスエンドポイントの存在確認(なければ先に実装)
- [ ] GitHub Environments(production)の Required reviewers 設定手順を成果物に添える

## workflows/incident-triage.yml
- [ ] 調査用ロールが Read-Only であることを IaC/手順で担保(Reader + ログ閲覧のみ)
- [ ] --allowedTools のコマンド列を対象基盤の read 系コマンドに書き換え
- [ ] アラート → repository_dispatch の中継(Function/Logic App)は別途実装が必要

## templates/
- [ ] CLAUDE.md.template → プロジェクトの絶対規範・コマンド・規約に全面書き換え(雛形の構造だけ維持)
- [ ] CODEOWNERS.template → 実ユーザー名、Tier 2 パス
- [ ] setup-branch-protection.sh → Phase 2 で実行(Phase 1 では実行しない)
