---
name: execute
description: "作成済みの docs/plans/task-*.md を、永続的な進捗・証拠・判断ログを更新しながら自律的に実行する。計画の実装、再開、完了に /dev-core:execute を使う。commit・push・PR は明示指定時だけ行う。"
argument-hint: "[計画書のパス] [--commit] [--pr]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Task(subagent_type:dev-core:tdd-practitioner), Task(subagent_type:dev-core:quality-checker), Task(subagent_type:dev-core:security-auditor), Task(subagent_type:dev-core:build-error-resolver), Task(subagent_type:dev-core:code-reviewer)
---

# 永続計画の自律実行

開始前に `dev-core:best-practices` をロードする。計画を唯一の実行状態として扱い、コンテキスト圧縮や別セッションでも再開できるよう更新し続ける。

## 1. Prepare Gate

1. `$ARGUMENTS` を解析し、最初の非option引数を `PLAN_PATH`、`--commit` と `--pr` を delivery flags とする。不明なoptionや計画書path欠落は実装前に報告する。
2. `PLAN_PATH` の計画書を読み、Completion Contract、未決事項、Current Next Action を確認する。旧versionの計画に Completion Contract、Progress Log、Decision Log、Blockers And Open Questions、Current Next Action がない場合は、コード変更前に既存の受け入れ条件から default-fail contract と永続状態sectionを一度backfillし、migrationをProgress Logへ記録する。観測可能な受け入れ条件を導けない場合だけ重要判断として確認する。
3. `git status --short` とプロジェクト指示・`.claude/*.local.md` を確認する。
4. 既存の安全な worktree/branch なら継続する。clean な local checkout、またはdirty差分が対象planと今回スコープ内の計画作業だけなら、それらを保持したままリポジトリ規約に従うbranchを作成・switchする。無関係な未コミット変更がある場合は切り替えや上書きをしない。
5. `--commit` と `--pr` の有無を Delivery Strategy に反映する。`--pr` は commit と push も許可する明示的な delivery 指定として扱う。
6. Status を `in-progress` にし、最初の Current Next Action を記録する。

## 2. Default-Fail Completion Contract

- 全 criterion は `pending` から開始する。
- 現在のコンテキストで指定されたテスト、コマンド、artifact を確認した場合だけ `satisfied` にする。
- 実装したという自己申告、過去セッションの結果、「通るはず」は証拠にしない。
- 証拠が不足する criterion は `pending` のまま残す。

## 3. Execution Loop

各 iteration を小さく実行する。

1. plan と Current Next Action を読む。
2. コードの振る舞い変更では `tdd-practitioner` を使い Red → Green → Refactor を実行する。docs/config のみで意味のある自動テストがない場合は、決定的 validator や構文検証を先に定義して直接変更してよい。
3. focused verification を実行する。
4. Status をリスク別に処理する。
5. plan の Progress Log、Decision Log、Completion Contract、Current Next Action、最終更新時刻を更新する。
6. logical batch ごとに `quality-checker` を使う。
7. 非自明な batch または最終段階で、実装報告を渡しすぎない新鮮な `code-reviewer` に独立レビューを依頼する。
8. 指摘を修正して影響する検証を再実行する。類似失敗は最大3回とする。

セキュリティ、認証、権限、機密境界、migration を触る場合だけ `security-auditor` を追加する。実際の build failure が発生した場合だけ `build-error-resolver` を使う。独立していない write-heavy タスクを並列化しない。

## 4. Concern Triage

| 状態 | 自律的な対応 |
| --- | --- |
| COMPLETED | 次へ進む |
| COMPLETED_WITH_CONCERNS: 安全・スコープ内・検証可能 | 修正して検証し、続行する |
| COMPLETED_WITH_CONCERNS: non-blocking residual risk | plan に記録して続行する |
| COMPLETED_WITH_CONCERNS: product judgment / scope expansion / security boundary /不可逆・外部操作 | 証拠と推奨案を示してユーザー判断を待つ |
| BLOCKED | 理由、3回までの試行、必要判断を記録して停止する |

命名や内部構造など安全で可逆な選択だけを理由にユーザーを止めない。

## 5. Delivery Gate

- `--commit` または明示依頼がある場合だけ、目的別にファイルを指定して stage/commit する。
- `--pr` または明示依頼がある場合だけ push と PR 作成を行う。
- 明示指定がなければ working tree の変更と検証証拠を報告して終了する。

## 6. Final Gate

1. `dev-core:verify` で build、typecheck、lint、test、security、diff の6段階検証を実行する。`quality-checker` はlogical batchの追加fix gateとして使い、最終検証の代替にしない。
2. `code-reviewer` に最終 diff と Completion Contract を独立確認させる。
3. 各 criterion の証拠を開き、`satisfied` または `pending` を確定する。
4. 全 criterion が `satisfied` で、P0/P1 指摘がなく、依頼された delivery が完了した場合だけ Status を `done` にする。
5. 変更、検証、レビュー、残存リスクを報告する。

## Stop Rules

- 同じ修正経路が3回失敗した。
- 1 cycle 完了しても意味のある進捗がない。
- 証拠が計画を否定する。
- ユーザー変更を上書きする必要がある。
- 破壊的、不可逆、外部副作用のある操作に権限がない。

停止・中断・コンテキスト圧縮前にも、plan に status、証拠、判断、blocker、Current Next Action を必ず保存する。
