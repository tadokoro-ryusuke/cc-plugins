# hotl-engineering のトリガー境界 — 既存スキルとの棲み分け

cc-plugins 内の全スキル（dev-core 知識7 + ワークフロー8、github-tools 2、ui-ux-pro-max 1）の
description と突合した衝突チェックの結果。判定原則は1つ:

> **hotl-engineering は「開発フロー・運用・体制を設計/導入する」スキル（メタ次元）。
> 「このコード/バグ/PR に今作業する」依頼（オブジェクト次元）では起動しない。**

## 前提: 自動起動で実際に競合しうるスキル

dev-core の workflows（refactor / task / task-team / tdd / e2e / execute / debug-team）は
`disable-model-invocation: true` の **スラッシュ専用**であり、自動起動では構造的に競合しない。
自動起動でライブに競合しうるのは model-invocable なスキル、特に
**dev-core:verify と dev-core:code-review**（および知識スキル群）である。
以下の表はユーザー発話ベースの判定例として、スラッシュ専用スキルも含めて整理する。

## 競合しうる語彙と判定例

| 語彙 | 判定例（ユーザー発話 → 起動すべきスキル） |
|---|---|
| 品質ゲート・検証 | 「実装できたので**検証して**」→ dev-core:verify（今の作業の6段階検証）。「このリポジトリに**品質ゲートを入れて**」→ hotl-engineering（CI としてのゲート設計・導入） |
| レビュー | 「この PR を**レビューして**」→ dev-core:code-review。「Codex に**レビューさせて**」→ dev-core:codex-collab。「AI レビューを**パイプラインに組み込みたい**」→ hotl-engineering（レビュー自動化の設計） |
| CI/CD・GitHub Actions | 「**CI/CD を設計して**」「**デプロイフローを整備して**」→ hotl-engineering。「**CI が落ちてる、直して**」→ dev-core:debug / build-error-resolver（今の障害の調査・修復であり、フロー設計ではない） |
| テスト・eval | 「この機能の**テストを書いて**」→ dev-core:tdd。「**E2E を実行して**」→ dev-core:e2e。「エージェントの**eval ゲートを作って**」→ hotl-engineering（eval 語彙は hotl が受ける） |
| 改善 | 「この**コードを改善/リファクタして**」→ dev-core:refactor。「この**リポジトリの開発フロー/運用を改善したい**」「**リポジトリを引き継いだので開発が回るようにしたい**」→ hotl-engineering |
| インシデント | 「この**バグの原因を調べて**」→ dev-core:debug。「**インシデント対応を自動化したい**」「アラート時の一次調査をエージェントにやらせたい」→ hotl-engineering |
| 学習・振り返り | 「同じミスを繰り返さない仕組みを」→ dev-core:continuous-learning（セッション単位の学習抽出）。「失敗を golden set に還流する**運用ルールを設計**」→ hotl-engineering（原則11）。近接領域だが、前者は「今のセッションから抽出」、後者は「チームの仕組み設計」 |
| 計画・タスク | 「新機能の**計画を立てて**」→ dev-core:task / task-team（1タスクの実装計画）。「**開発体制を立ち上げたい**」→ hotl-engineering（体制・フローの設計） |
| PR・ドキュメント | 「PR を作って」→ github-tools:pr。「README を更新して」→ github-tools:docs。衝突なし |
| UI/UX | ui-ux-pro-max と共通語彙なし。衝突なし |

## 過剰トリガー防止（eval ケース #6 の担保）

- 通常のコーディング質問（例:「TypeScript で zod のスキーマからフォームを自動生成する方法」）では起動しない
- SKILL.md の description に負の境界を明記している:
  個別のコード実装・バグ修正・リファクタリング・エラー解消は対象外（dev-core 側のスキルが受ける）
- 検証は `evals/cases.json` #6（trigger-boundary-negative）で回帰確認する

## 新スキル追加時の運用

新しいスキルを cc-plugins に追加するときは、この表に対して同じ突合を行い、
競合語彙があれば判定例を追記する。
