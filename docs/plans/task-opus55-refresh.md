# Task: Opus 5.5 対応のプラグイン刷新（hotl 2.0.0 / dev-core 5.0.0 / indie 0.1.0）

- Status: done
- 結果: cc-plugins #9〜#12 を 2026-09-23 に main へ merge 済み。codex-plugins は「Current Next Action」を参照。未達の完了条件は「未達の完了条件（バックログ）」に移した
- Plan file: docs/plans/task-opus55-refresh.md
- 設計書: docs/research/opus-5-5-plugin-strategy.md
- Last updated: 2026-10-26

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
| AC-C1 | indie が Claude で動く | インストールした新しいセッションでのスキル一覧、トリガーの正例と負例 各1件 | satisfied（`--plugin-dir` で起動した headless の新しいセッションで確認。3スキルを認識し、正例は indie-idea-discovery が起動、負例は起動なし。marketplace からインストールした状態での確認は、merge 後にユーザー環境で行う） |
| AC-C2 | 公開データが一般化されている | grep で 0 件 | satisfied（codex-plugins#7、cc の PR C とも。作者のメタデータは既存プラグインと同じ公開表記） |
| AC-X | 各 PR が Codex の diff レビューを通っている | 指摘を検証した記録 | satisfied（#9 と codex#7・#8 は指摘なし。#10 は P2 が1件で、未コミットの変更があるときの検証対象を実ファイルで確認して修正した。#11 は指摘なし。hosted CI は #9〜#11 とも全 pass） |

## 未達の完了条件（バックログ）

上の AC は、本計画の範囲（定義とスキーマ検証、固定 effort の live 確認）では満たした。設計書 §5・§8 の完了条件のうち、次は未達のまま残っている。本計画では扱わず、別の計画か Issue で扱う。

| 出典 | 未達の条件 | 現状 |
|---|---|---|
| 設計書 §8 A-1 | 変更した契約を代表する行動ケースを実行し、記録する | dev-core の行動ケースはスキーマ検証だけ（AC-B1） |
| 設計書 §8 A-2 | 代表的な行動ケースで spawn 数が減り、合格率が下がらない | 未測定 |
| 設計書 §5 indie のリリース条件4 | 追加した契約を代表する行動ケースを実際に実行し、観測した行動と判定を記録する | 未実行。indie の README の「検証」節どおり pending として扱う |
| 設計書 §8 Phase C | 固定するすべての effort に eval ケースと計測日が紐づいている | 未着手。レビュアーの high は暫定値のまま。測定で effort の差を作るときは frontmatter の変種で作り、呼び出しごとの effort は使わない（設計書の追記3） |

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
| codex-2 逆反映 | hotl の judge temperature 条件と較正の文言を codex へ翻案（2.0.2） | 親が直接（小さく、書き込み範囲が1つ） | 完了。テストを追加し、Codex レビューで指摘なし。codex-plugins#8 |
| PR C 実装 | 3スキルの翻案と骨組みを、書き込み範囲の重ならない4担当で並列実装し、統合担当が検証と live トリガーを確認する | workflow（C1〜C4 と check） | 完了。親が validator 一式を再実行し、RTL の注記を追加した |
| PR B 実装 | dev-core・validator・docs を書き込み範囲の重ならない6担当で並列実装し、統合担当が整合を取る | workflow（B1〜B6 と integrate） | B2/B3/B5 は完了。B1/B4/B6/integrate はセッション上限で失敗したが、大半は書き込み済みだった。親が項目ごとに監査し、不足（AGENTS 索引、README の2節）を直接補った |

## Progress Log

- 2026-09-23: 設計書を作成し、設計パネル、反証、advisor、Codex のレビューを統合した。ユーザーが推奨どおりの実施を了承した。
- 2026-09-23: 個人設定（リポジトリ外、本人承認）を更新した。global CLAUDE.md の C3 はレンズを正本として更新し、射影ツールの dry-run で冪等を確認した（無関係な他 target の保留中の射影は適用していない）。settings のトップレベル effortLevel（Opus 5.5 には効かない legacy 値）は削除した。modelSettings と MAX_THINKING_TOKENS はユーザーの選好として据え置いた。バックアップはリポジトリ外に置いた。
- 2026-09-23: PR A（hotl）と codex-1（indie の一般化）の実装ワークフローを開始した。
- 2026-09-23: PR A の検証一式が pass（21 tests）し、Codex のブランチレビューも「対処が必要な欠陥なし」だった。draft PR を作成した（cc-plugins#9）。codex-1 も Codex レビューで退行なしとなり、過去の計画記録を含めてプロダクト名・価格の残存が0件になったので、draft PR を作成した（codex-plugins#7）。
- 2026-09-23: probe の結果: allowed-tools の `Agent(...)` と `Task(subagent_type:...)` はどちらも動作した。skill 本文の `${CLAUDE_EFFORT}` は実効 effort に置換される。これを受けて PR B の実装を開始した。
- 2026-09-23: draft PR: cc-plugins #9（hotl 2.0.0）、#10（dev-core 5.0.0）、#11（indie 0.1.0）、codex-plugins #7（indie 0.3.1）、#8（hotl 2.0.2）。hosted CI は cc の3本とも全 pass。
- 2026-09-23: PR C: indie 0.1.0 を追加した。references と assets は codex 68322c9 と同一で、SKILL.md は日本語へ翻案した。Claude 固有の実行ノートを加えた。design-core は lang の規定を直して 0.2.1 に、marketplace は 5.1.0 にした。validator と全9プラグインの validate が pass し、live のトリガー確認も通った。
- 2026-09-23: PR B のワークフローはセッション上限で4担当が中断した。再ログインの後、作業ツリーを項目ごとに監査し、AGENTS.md の索引行と dev-core README の「Opus 5.5 での運用」節・移行節を補った。検証一式と全8プラグインの validate が pass し、固定 effort を live で確認した。
- 2026-09-23: cc-plugins #9 を main へ、#10・#11 を `feature/hotl-2.0.0` へ merge し、#12 でそれを main へ merge した（GitHub の PR の記録で確認）。
- 2026-10-26: 2026-10 の鮮度監査を受けて、状態を merge 済みに合わせた。Claude Code 2.1.284（ultracode を effort から分離）と 2.1.292（Agent ツールの呼び出しごとの effort）による effort の前提の変化を、設計書の追記、dev-core README、`scripts/agent-effort-pins.json` の description に反映した。未達の完了条件をバックログの表に移した。

## Decision Log

- レビュアーの effort は high に暫定固定する。バッチごとのレビューをゲート制に絞るのと同時に、残るレビューの effort まで下げないため。
- indie の正本は codex に一本化する。cc へは一方向に翻案し、Claude 固有の部分だけを cc が所有する。

## Blockers And Open Questions

- なし

## Current Next Action

本計画で行う作業は残っていない（2026-10-26 時点）。

- cc-plugins: #9〜#12 は 2026-09-23 に merge 済み。
- codex-plugins: #7（indie 0.3.1）は open のまま。#8（hotl 2.0.2）は 2026-10-25 に close され、#10（open）に引き継がれた。merge するかどうかはユーザーが判断する。
- インストール済みプラグインの更新（`/plugin marketplace update cc-plugins`、`codex plugin add <plugin>@codex-plugins`）が済んだかは、この計画では確認していない。
- 残りの作業は「未達の完了条件（バックログ）」と、設計書の Phase C（effort の比較測定、行動ケースの live 評価）と Phase D。
