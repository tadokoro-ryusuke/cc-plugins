# Changelog — hotl-engineering

このスキルへの変更は必ずここに記録する（HANDOFF の運用ルール）。
references の内容変更・description の意味的変更は PR で提案し、承認を得てから反映する。

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
