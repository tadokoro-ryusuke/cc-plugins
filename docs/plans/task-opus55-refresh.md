# Task: Opus 5.5 対応のプラグイン刷新（hotl 2.0.0 / dev-core 5.0.0 / indie 0.1.0）

- Status: in-progress
- Plan file: docs/plans/task-opus55-refresh.md
- 設計書: docs/research/opus-5-5-plugin-strategy.md
- Last updated: 2026-09-23

## 目的と権限

設計書 §8 の Phase A-0 / A-1 / A-2 / B を実装する。ユーザーは次の2点を了承済み。

- 設計どおりのロールアウト
- indie の自社名と暫定価格を一般化して codex に push すること

### 実施すること

- cc-plugins と codex-plugins の feature ブランチを push し、**draft PR** を作成する。

### 実施しないこと

- main への push
- merge
- インストール済みプラグインの更新
- `codex plugin add` による再インストール
- dotfiles のコミット

### 範囲外（バックログ）

- 設計書 §8 の Phase C（測定）と Phase D（Workflow スクリプト）
- 知識スキル全体の streamline（description の短縮など）
- verify.sh 相当の決定的ランナー

## PR 構成（線形スタック）

| PR | ブランチ | base | 範囲 |
|---|---|---|---|
| A | `feature/hotl-2.0.0` | main | hotl-engineering 2.0.0: codex 06afa51 の hotl 一式、2449cee の SKILL.md、Python の回帰テスト、CI の python job |
| B | `feature/opus55-dev-core` | A | 設計書・本計画、validator と CI、dev-core 5.0.0、github-tools 2.1.0、hotl 2.0.1（trigger-boundaries）、ai-engineering、README / AGENTS |
| C | `feature/indie-product-marketing` | B | indie-product-marketing 0.1.0、design-core の lang 修正、marketplace |
| codex-1 | `codex/indie-generalize` | codex main | indie 0.3.1: 一般化、references / assets の `$skill` の中立化、AGENTS の sibling 節 |
| codex-2 | 必要な場合のみ | codex main | B の知識層変更のうち、codex に無いものの翻案 |

マージ順は A → B → C。先の PR がマージされたら、後続 PR の base を main に切り替える。

## 翻案の原則

- codex で変わった箇所だけを、cc の既存の日本語本文へ差分単位で反映する。丸ごと訳し直すことはしない。
- yml と py のロジックは codex と同一にする。
- 未検証の挙動を前提にした指示は出荷しない。probe で確かめられなかった項目は、文言に入れない。

## Completion Contract

| ID | 基準 | 必要な証拠 | 状態 |
|---|---|---|---|
| AC-A1 | hotl の導入手順が既存の required checks を弱めない | SKILL.md の差分、evals ケース #7 の追加（ケース自体は未実行） | satisfied（文書・ケース定義） |
| AC-A2 | hotl テンプレートの欠陥（verdict / SHA、eval の revision、target の失敗の集計、rollback、権限）が修正されている | 移植した回帰テストが pass すること | satisfied（21 tests OK。hosted の実行は未実施） |
| AC-B1 | dev-core のトポロジーが「親実装が既定・委譲は利得があるときだけ・リスクゲートでレビュー」になっている | workflow / agent の差分、evals ケース（23件、スキーマ検証のみ） | satisfied（定義。live での挙動評価は Phase C） |
| AC-B2 | 固定した effort（実行系 medium、レビュアー high）が効いている | subagent の transcript に記録された実効値（1〜2 run） | satisfied（親 xhigh の run で、tdd-practitioner=medium、code-reviewer=high、どちらも claude-opus-5-5。background 起動でも反映） |
| AC-B3 | 廃止した agent / workflow への現役の参照が0件 | 新しい validator の出力 | satisfied（check-plugin-agents: 5 agents / 119 references が pass。grep で残存0件。README の移行節と CHANGELOG は除外） |
| AC-B4 | validator と CI が新規プラグインを含めて機能する | 検証コマンド一式、負例 fixture | satisfied（ローカル。drift / evals / hooks / agents / 全8プラグインの validate が pass し、負例 fixture は exit 1 で13規則すべてを報告した。hosted CI は PR 上で確認する） |
| AC-C1 | indie が Claude で動く | インストールした新しいセッションでのスキル一覧、トリガーの正例と負例 各1件 | pending |
| AC-C2 | 公開データが一般化されている | grep で 0 件 | codex 側は satisfied（codex-plugins#7）。cc 側は PR C で確認する |
| AC-X | 各 PR が Codex の diff レビューを通っている | 指摘を検証した記録 | pending |

## 各 PR の提出前ゲート

1. 検証コマンド一式（AGENTS.md）
2. Codex による diff レビュー（companion の review。base を指定する）
3. 指摘を実ファイルで確認する
4. 修正する
5. 公開用の grep（個人の絶対パス、ユーザー名、非公開のプロダクト名と価格、セッション ID、一時ディレクトリのパス）
6. commit → push → draft PR

## Dispatch ledger

| 作業 | 利得と範囲 | agent | 状態 |
|---|---|---|---|
| PR A 実装 | hotl 本文・テンプレート・テストを書き込み範囲の重ならない3担当で並列実装。親が統合と検証を行う | workflow（A1/A2/A3、セッションの effort） | 完了。親が再検証し、21 tests OK |
| codex-1 実装 | 別リポジトリの一般化 | workflow（CX1） | 完了。親が grep と validator で再確認 |
| PR B 実装 | dev-core・validator・docs を書き込み範囲の重ならない6担当で並列実装し、統合担当が整合を取る | workflow（B1〜B6 と integrate） | B2/B3/B5 は完了。B1/B4/B6/integrate はセッション上限で失敗したが、大半は書き込み済みだった。親が項目ごとに監査し、不足（AGENTS 索引、README の2節）を直接補った |

## Progress Log

- 2026-09-23: 設計書を作成し、設計パネル、反証、advisor、Codex のレビューを統合した。ユーザーが推奨どおりの実施を了承した。
- 2026-09-23: 個人設定（リポジトリ外、本人承認）を更新した。global CLAUDE.md の C3 はレンズを正本として更新し、射影ツールの dry-run で冪等を確認した（無関係な他 target の保留中の射影は適用していない）。settings のトップレベル effortLevel（Opus 5.5 には効かない legacy 値）は削除した。modelSettings と MAX_THINKING_TOKENS はユーザーの選好として据え置いた。バックアップはリポジトリ外に置いた。
- 2026-09-23: PR A（hotl）と codex-1（indie の一般化）の実装ワークフローを開始した。
- 2026-09-23: PR A の検証一式が pass（21 tests）し、Codex のブランチレビューも「対処が必要な欠陥なし」だった。draft PR を作成した（cc-plugins#9）。codex-1 も Codex レビューで退行なしとなり、過去の計画記録を含めてプロダクト名・価格の残存が0件になったので、draft PR を作成した（codex-plugins#7）。
- 2026-09-23: probe の結果: allowed-tools の `Agent(...)` と `Task(subagent_type:...)` はどちらも動作した。skill 本文の `${CLAUDE_EFFORT}` は実効 effort に置換される。これを受けて PR B の実装を開始した。
- 2026-09-23: PR B のワークフローはセッション上限で4担当が中断した。再ログインの後、作業ツリーを項目ごとに監査し、AGENTS.md の索引行と dev-core README の「Opus 5.5 での運用」節・移行節を補った。検証一式と全8プラグインの validate が pass し、固定 effort を live で確認した。

## Decision Log

- レビュアーの effort は high に暫定固定する。バッチごとのレビューをゲート制に絞るのと同時に、残るレビューの effort まで下げないため。
- indie の正本は codex に一本化する。cc へは一方向に翻案し、Claude 固有の部分だけを cc が所有する。

## Blockers And Open Questions

- なし

## Current Next Action

PR B をコミットし、Codex の diff レビューを通してから draft PR を作成する（base: feature/hotl-2.0.0）。その後 PR C（indie）に進む。
