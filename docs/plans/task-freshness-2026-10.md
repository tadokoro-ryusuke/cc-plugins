# Task: スキル鮮度監査（2026-10）の改善を実装する

- Status: in progress
- Plan file: docs/plans/task-freshness-2026-10.md
- 監査レポート: docs/research/skill-freshness-audit-2026-10.md
- 候補ごとの詳細台帳とスキルのカルテ（git 管理外）: `.claude/audit/`
- Last updated: 2026-10-25

## 目的と権限

監査で見つかった P0・P1 と、カルテで新たに見つかった問題を直し、スキルが実際に使われるかを測る。
ユーザーは「必要なものはすべてやる」ことを了承した（2026-10-25）。

### 実施すること

- cc-plugins と codex-plugins の feature ブランチを push し、**draft PR** を作成する。
- 置き換える PR（codex-plugins #8）は、理由と後継 PR を書いて close する（reopen で戻せる）。
- C18 の測定のために、上限付きで実モデルの plugin eval を実行する（費用は本書に記録する）。

### 実施しないこと

- main への push、merge（merge はユーザーが行う）
- インストール済みプラグインの更新、`codex plugin add` による再インストール
- 公開リポジトリへの Issue 作成（PR の本文で足りる）
- codex-plugins の ui-ux-pro-max の削除（ユーザー未回答。非破壊の既定として LICENSE と来歴だけを足す）

## 範囲

- 監査の P0（3件）と P1（29件）
- カルテで新たに見つかった2件
  - data-design-ops: 本番の調査で `EXPLAIN (ANALYZE)` を使わせうる
  - hotl の agent-implement / ai-review: ツールを許可していないので、テストの実行と判定ファイルの書き出しができない
- C18（スキルが実際に発火するかの測定）
- すでに編集するファイルにある P2（同じ箇所を二度触らないため）

### 範囲外（バックログ）

- 上記以外の P2・P3（監査レポート §7 の表）
- C30・C73（description の短縮と索引）は C18 の結果を見てから決める
- 静的検査（zizmor・actionlint・shellcheck）の CI への組み込みと、action の SHA 固定（C47 の一部・C23）
- スキルの統廃合の判定（監査レポート §5-2）

## PR 構成

| PR | リポジトリ | ブランチ | base | 範囲 | 状態 |
|---|---|---|---|---|---|
| 1 | cc | `feature/freshness-b0` | main | ui-ux-pro-max の削除（marketplace 6.0.0）、hotl 2.0.2（C03・C04・カバレッジゲート）、監査レポートと本計画 | draft PR #13 |
| 2 | codex | `codex/hotl-2.0.2-freshness` | codex main | hotl 2.0.2 の翻案（#8 を置き換え）、ui-ux-pro-max の LICENSE と来歴（C02） | draft PR #10（#8 は close） |
| 3 | cc | `feature/hotl-2.1.0` | 1 | モデル ID の vars 化と fail-fast、agent-implement / ai-review のツール付与（新規の発見）。SDK は 1.x に固定（2.x と 4.7 以降の judge への移行は見送り） | draft PR #14（Codex GO） |
| 3b | cc | `feature/hotl-2.1.0-evals` | 3 | C14 の hotl 側（judge を軸ごとの合格率でゲート）、C47 の hotl 側（actions のメジャー版、ADJUST） | 実装中 |
| 4 | codex | `codex/hotl-2.1.0` | 2 | 3・3b の翻案 | 3 の翻案をコミット済み（46f3ab2、未 push） |
| 5 | cc | `feature/dev-core-5.1.0` | 1 | 実装まわり（下記の commit 順）、github-tools の C29 | 実装済み。フックの作り直し（78f9cb1）の Codex 再レビュー待ち |
| 6 | codex | `codex/dev-core-freshness` | codex main | 5 のうち知識層の変更の翻案 | 未着手 |
| 7 | cc | `feature/skill-reachability` | 5 | C18 の測定、C35、C17 | 未着手 |
| 8 | cc | `feature/knowledge-freshness` | 5 | C46・C47・C51・C52・C53・C21・C14（9 を含む） | 実装済み（worktree ~/work/cc-plugins-knowledge）。Codex レビュー待ち |
| 9 | cc | （8 に統合） | - | C38・C40・C41・C45 | 8 に含めた |
| 10 | codex | 必要な分 | codex main | 8・9 のうち知識層の変更の翻案 | 未着手 |

マージ順は 1 → 3、1 → 5 → 7・8・9。先の PR がマージされたら、後続 PR の base を main に切り替える。

### PR 5 の commit 順（dev-core 5.1.0 は1回だけ上げる）

1. テストの完全性: C06（テストを弱めて通すことの禁止と、止めて返す出口）、C07（verify と Stop フックでの検出、未追跡ファイル）、C16（単独 TDD での全体テスト）、C56（flaky の隔離に承認と期限）
2. テスト知識の正本化: C09（best-practices/references/testing.md）、C10（テストダブルと実依存の integration）
3. refactor: C13、C44
4. security-auditor: C26・C69（出力の契約）、C05（OWASP Top 10:2025）
5. フック: C01・C24（危険コマンドの tripwire の照合と回帰テスト、強制力の文言）
6. E2E: C08（ロケータ、POM、npx、返却の契約）
7. debug と codex-collab: C15・C32（再現ループとハンドオフ）、C25（Three Strikes の整合）
8. data-design-ops: 本番での `EXPLAIN (ANALYZE)` の禁止（新規の発見）
9. github-tools: C29（allowed-tools の絞り込み、github-tools のバージョンを上げる）

知識層（dev-core/skills/）を変える commit は、同じサイクルで codex-plugins に英語で翻案し（PR 6）、変えた規則を判定する行動ケースを同じ commit に入れる。

## 進め方の規律

- スクリプトとテンプレートはテストを先に書き、落ちることを確かめてから直す。
- コミット前に AGENTS.md の検証コマンド一式を流す（hotl は Python のテストも）。
- セキュリティ・権限・データに触れる変更は、Codex の独立レビューを通す。指摘は実ファイルで確かめてから直す。
- 版を上げ、CHANGELOG に書く。

## Completion Contract

| ID | 基準 | 必要な証拠 | 状態 |
|---|---|---|---|
| AC-1 | ui-ux-pro-max が cc-plugins から外れ、参照が壊れていない | drift・validate の出力、grep | satisfied（ローカル。PR 1 の CI は未確認） |
| AC-2 | hotl のテンプレートが固定した SDK で動き、エージェントが GitHub に書き込めない | scripts/tests の 30 件、契約テストが旧実装と SDK 2.3.0 で落ちること、Codex レビュー | satisfied（ローカル。action の中での実挙動は未確認） |
| AC-3 | codex-plugins の hotl が同じ修正を持つ | codex の validate と tests | pending |
| AC-4 | Sonnet 4.5 の退役（2026-11-30）前に、テンプレートが既定のモデル ID に依存しない | hotl 2.1.0 の差分とテスト | pending |
| AC-5 | テストを弱めて通した変更が、実装の返却・レビュー・Stop のどこかで表に出る | 行動ケース、Stop フックのテスト | pending |
| AC-6 | refactor・security-auditor・フック・E2E・data-design-ops の指摘が直っている | 差分、テスト、行動ケース | pending |
| AC-7 | スキルの発火を、実際のインストール構成で測った結果がある | plugin eval の結果と費用 | pending |
| AC-8 | P1 の知識の鮮度（OWASP・MCP・サプライチェーン・UUIDv7・法令）が更新され、出典 URL と確認日が付いている | 差分 | pending |

## Progress Log

- 2026-10-25: 監査、カルテ、PR 1 の実装と Codex レビュー（NO-GO 2回、指摘はすべて反映）まで完了。
- 2026-10-26: PR 1（#13）・3（#14）・2（codex #10）を draft で作成し、codex #8 を close。PR 3 は Codex の NO-GO 4回を経て GO。
  PR 5 は実装済みで、フックを字句解析で作り直した（78f9cb1）。PR 8 は 7 担当で実装し、内部レビューの指摘（中4・低6）を反映した。
  C14 の hotl 側は PR 3 に載せず、PR 3b として judge のゲートを軸ごとの合格率に変えた（84dfa03、テスト 47 件 OK）。
  PR 4 は 3 の翻案をコミット済み（codex のテスト 92 件 OK、validate OK を手元で再確認）。

## Current Next Action

1. Codex の3件のレビュー（PR 5 のフック、PR 8、PR 3b）を読み、指摘を実ファイルで確かめて直す。
2. PR 3b に C47 の hotl 側（actions のメジャー版。版と破壊的変更は調査中）を足し、PR 4 に 3b を翻案する。
3. PR 5・8・3b・4 を push して draft PR にする。
4. PR 6/10（dev-core と知識層の翻案）、PR 7（C18 の測定）。
