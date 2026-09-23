# Changelog — hotl-engineering

このスキルへの変更は必ずここに記録する（HANDOFF の運用ルール）。
references の内容変更・description の意味的変更は PR で提案し、承認を得てから反映する。

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
