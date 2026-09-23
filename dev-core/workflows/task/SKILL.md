---
name: task
description: "リポジトリを先に調査し、要件・BDDシナリオ・証拠付き完了条件・TDD計画を永続化する。新機能・改修・曖昧な開発依頼を実装可能な計画へ変えるときに /dev-core:task で起動する。GitHub Issue は明示指定時だけ作成する。"
argument-hint: "[タスクの概要] [--issue]"
disable-model-invocation: true
allowed-tools: Read, Write(*.md), Agent(Explore)
---

# 証拠ベースのタスク計画

開始前に `dev-core:best-practices` をロードする。最初に `$ARGUMENTS` から `--issue` を delivery flag として分離し、残りを `TASK_INPUT` とする。`TASK_INPUT` を、別セッションでも再発見なしに実行できる永続的な計画へ変換する。

## Phase 1: リポジトリ調査

質問する前に以下を確認する。

- `AGENTS.md` / `CLAUDE.md` / README / プロジェクト固有設定
- 関連コード、既存テスト、実際の build・lint・test コマンド
- 現在の Git 状態と既存の `docs/plans/task-*.md`

リポジトリから分かる package manager、命名規約、構造、既存コマンドをユーザーへ質問しない。

## Phase 2: 不確実性ゲート

残った情報を分類する。

| 種類 | 対応 |
| --- | --- |
| 検証可能な事実 | 環境から確認し、証拠を記録する |
| 安全で可逆な仮定 | 推奨デフォルトと戻し方を記録し、続行する |
| 重要判断 | 一度に1問だけ、推奨回答・理由・トレードオフとともに確認する |

重要判断は、回答によってプロダクト意図、スコープ、アーキテクチャ、セキュリティ、不可逆データ、外部副作用が変わる場合に限定する。深い圧力テストを求められた場合は `/dev-core:grill` を案内する。

## Phase 3: 要件と BDD

以下を具体化する。

- タイトル、目標、背景、スコープ、非目標
- ユーザーストーリー
- 正常系・異常系・境界値の BDD シナリオ
- 影響モジュール、既存テスト、設計制約

## Phase 4: 実装計画

計画は親（このセッション）が書く。ユーザーとの対話で得た意図と判断の文脈を保ったまま書けるため。

対象が広く、関連コードの洗い出しに大量の読み取りが要るときは、組み込みの Explore サブエージェントに読み取り調査を任せてよい。調べる問いと範囲を具体的に渡し、返ってきた file:line の要約は、計画の前提にする箇所を親が開いて確かめてから使う。

計画を `docs/plans/task-<slug>.md` に保存し、以下を含める。

1. 先頭metadataの正準行 `- Status: draft`（許容値 `draft | approved | in-progress | blocked | done`）、最終更新時刻、目標、スコープ、非目標
2. Evidence Baseline
3. 検証済み事実、可逆な仮定、重要判断
4. 設計と BDD シナリオ
5. TDD iteration と検証コマンド
6. Completion Contract
7. Delivery Strategy
8. Risks And Stop Conditions
9. Progress Log、Decision Log、Blockers And Open Questions、Current Next Action

Completion Contract は次の形式にし、全行を `pending` で開始する。実行時に指定証拠を確認するまで `satisfied` にしない。

| ID | 観測可能な完了条件 | 必要な証拠 | Evidence Observed | Status |
| --- | --- | --- | --- | --- |
| AC-1 | ... | テスト、コマンド、または確認対象 artifact | not yet observed | pending |

commit、push、Issue、PR は、現在の依頼で明示されていなければ Delivery Strategy に `not requested` と記載する。

設計の選択肢が複数あり、計画そのものを独立に批評させたいときは、計画を保存した後に新しい文脈で1回レビューする（例: `dev-core:codex-collab` の敵対的レビュー）。指摘は実ファイルで確かめてから計画に反映する。

## Phase 5: Optional Issue

`--issue` があるか、ユーザーが明示的に依頼した場合だけ、親が計画書から Issue を作る。Issue の書き方は `dev-core:issue-driven-dev` に従う。

1. `gh auth status` で認証を確かめる。認証済みの GitHub CLI がなければ、Issue 本文の draft を返して終える。認証やログインを勝手に進めない。
2. 本文をリポジトリ外の一時ファイルに書き、`gh issue create --title "<タイトル>" --body-file <一時ファイル>` で作成する。本文をコマンドライン引数に埋め込むと、改行や記号が崩れたりシェルに展開されたりするため。
3. ラベルとマイルストーンは、リポジトリに既にあるものだけを付ける。

## 終了条件

- 計画ファイルと未決事項を報告する。
- Issue を作った場合だけ URL を報告する。
- 実装も依頼されている場合を除き、実装開始の確認で対話を増やさず `/dev-core:execute <plan>` を次アクションとして示して終了する。
