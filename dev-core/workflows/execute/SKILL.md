---
name: execute
description: "作成済みの docs/plans/task-*.md を、永続的な進捗・証拠・判断ログを更新しながら自律的に実行する。計画の実装、再開、完了に /dev-core:execute を使う。親が実装し、委譲とレビューは条件に該当するときだけ行う。commit・push・PR は明示指定時だけ行う。"
argument-hint: "[計画書のパス] [--commit] [--pr]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Agent(dev-core:tdd-practitioner), Agent(dev-core:build-error-resolver), Agent(dev-core:code-reviewer), Agent(dev-core:security-auditor)
---

# 永続計画の自律実行

開始前に `dev-core:best-practices` をロードする。計画を唯一の実行状態として扱い、コンテキスト圧縮や別セッションでも再開できるよう更新し続ける。委譲とレビューの原則は `dev-core:best-practices` の `references/delegation-and-review.md` にあり、この skill はそれを計画の実行に適用する規則を持つ。

## 1. Prepare Gate

1. `$ARGUMENTS` を解析し、最初の非option引数を `PLAN_PATH`、`--commit` と `--pr` を delivery flags とする。不明なoptionや計画書path欠落は実装前に報告する。
2. `PLAN_PATH` の計画書を読み、Completion Contract、未決事項、Current Next Action を確認する。旧versionの計画に Completion Contract、Progress Log、Decision Log、Blockers And Open Questions、Current Next Action がない場合は、コード変更前に既存の受け入れ条件から default-fail contract と永続状態sectionを一度backfillし、migrationをProgress Logへ記録する。観測可能な受け入れ条件を導けない場合だけ重要判断として確認する。
3. `git status --short` とプロジェクト指示・`.claude/*.local.md` を確認する。
4. 既存の安全な worktree/branch なら継続する。clean な local checkout、またはdirty差分が対象planと今回スコープ内の計画作業だけなら、それらを保持したままリポジトリ規約に従うbranchを作成・switchする。無関係な未コミット変更がある場合は切り替えや上書きをしない。
5. `--commit` と `--pr` の有無を Delivery Strategy に反映する。`--pr` は commit と push も許可する明示的な delivery 指定として扱う。
6. このターンの実効 effort は `${CLAUDE_EFFORT}` である。開始・再開のたびに Progress Log へ記録する。表示された値が effort の段階名（low / medium / high / xhigh / max）でなければ `unknown` と記録する。
7. effort が xhigh か max で、Progress Log にまだ案内の記録がなければ、計画の実行には medium を推奨していること（切り替えは `/effort medium`）を一度だけ伝え、案内したことを Progress Log に記録して続行する。xhigh と max は品質の向上を測定できた作業に向く設定で、確定した計画の実行では medium で足りることが多いため。effort はユーザーの選択なので、この skill からは変えず、確認も待たない。
8. Status を `in-progress` にし、最初の Current Next Action を記録する。

## 2. Default-Fail Completion Contract

- 全 criterion は `pending` から開始する。
- 現在のコンテキストで指定されたテスト、コマンド、artifact を確認した場合だけ `satisfied` にする。
- 実装したという自己申告、子 agent の報告、過去セッションの結果、「通るはず」は証拠にしない。
- 証拠が不足する criterion は `pending` のまま残す。

## 3. Execution Loop

親（このセッション）が既定の実装者として、各 iteration を小さく実行する。密結合・逐次の作業は、計画の大きさに関係なく親が進める。サブエージェントは親と会話の文脈もキャッシュも共有しないので、委譲は受け渡しのコストを上回る利得があるときだけ行う。

1. plan と Current Next Action を読む。
2. コードの振る舞い変更は、親が Red → Green → Refactor で実装する。docs/config のみで意味のある自動テストがない場合は、決定的 validator や構文検証を先に定義して直接変更してよい。
3. focused verification（変更に関係する test・typecheck・lint）を、親がツールで直接実行する。コマンドを流すためだけに agent を立てない。
4. 結果を §4 の Concern Triage で処理する。
5. 変更がレビューゲートに当たるなら、候補が安定した時点でゲートのレビューを行う（下記）。
6. 指摘や失敗を修正し、影響する検証を再実行する。同じ修正経路での失敗は3回までとする。
7. plan の Progress Log、Decision Log、Completion Contract、Current Next Action、最終更新時刻を更新する。

### 委譲の条件

次のどれかに当たるときだけ委譲する。「その役割の agent がある」「テストがある」だけでは利得にならない。

| 条件 | 使う agent |
| --- | --- |
| 書き込み範囲・依存・共有リソースが重ならない独立トラックがあり、並行で進める利得がある | `tdd-practitioner` |
| 大量の出力を親の文脈から隔離したい（例: 実際の build failure で、エラーログが大量に出ている） | `build-error-resolver` |
| リスクゲートで独立評価が要る | `code-reviewer`、`security-auditor` |

- 委譲したら、Decision Log に1行記録する: 利得、書き込み範囲、agent、戻る条件。
- handoff には、目的・書き込みを許す範囲・受け入れチェックだけを渡し、会話の全履歴は渡さない。前提が崩れたら親に返すよう伝える。
- 子の報告は自己申告として扱う。変更ファイルと検証の生の出力を親が確かめてから、plan に反映する。
- 書き込みが重なるタスクは並列化しない。

### レビューゲート

レビューは batch ごとには行わず、変更が次のどれかに当たるときに行う。行数や計画の大きさだけではゲートにしない。

- セキュリティ・権限・秘密情報の境界
- 永続データ・migration
- 並行処理・冪等性
- 重要な公開契約（API、イベント、公開する設定やスキーマ）
- plan や依頼でレビューが明示的に要求されている

進め方:

- 候補が安定してから（focused verification が通り、続けて変更する予定がない状態で）、新しい文脈の `code-reviewer` に1回レビューさせる。渡すのは元の要件、diff の識別子（base と head、または対象ファイル）、検証の生の出力で、実装の経緯や自己評価は渡さない。
- セキュリティ・権限・秘密情報の境界に当たる変更では、`security-auditor` も使う。
- 指摘を直した後は、影響する範囲だけを見直す。
- 必須のレビューが起動できないときは、`dev-core:codex-collab` の Codex レビューで代替する。それもできなければ、該当する criterion を `pending` のまま残し、「独立性は未充足」と理由を Decision Log に記録する。

## 4. Concern Triage

| 状態 | 自律的な対応 |
| --- | --- |
| COMPLETED | 次へ進む |
| COMPLETED_WITH_CONCERNS: 安全・スコープ内・検証可能 | 修正して検証し、続行する |
| COMPLETED_WITH_CONCERNS: non-blocking residual risk | plan に記録して続行する |
| COMPLETED_WITH_CONCERNS: product judgment / scope expansion / security boundary /不可逆・外部操作 | 証拠と推奨案を示してユーザー判断を待つ |
| 子 agent が `needs-parent` か `blocked` で返った | 親が証拠を確かめて範囲を定め直し、引き取るか委譲し直すかを Decision Log に記録する。親でも進められなければ BLOCKED として扱う |
| BLOCKED | 理由、3回までの試行、必要判断を記録して停止する |

命名や内部構造など安全で可逆な選択だけを理由にユーザーを止めない。

## 5. Delivery Gate

- `--commit` または明示依頼がある場合だけ、目的別にファイルを指定して stage/commit する。
- `--pr` または明示依頼がある場合だけ push と PR 作成を行う。
- 明示指定がなければ working tree の変更と検証証拠を報告して終了する。

## 6. Final Gate

1. 親が `dev-core:verify` を実行する（build、typecheck、lint、test、security、diff）。証拠は、最終 diff と同じ入力に対する実行結果に限る。同じ入力で直前に実行した結果は、`dev-core:verify` の再利用条件を満たす場合だけ、再利用したと明記して使ってよい。
2. 最終 diff がレビューゲートに当たる場合は、そのゲートのレビューが最終 diff に対して済んでいるかを確かめる。未実施か、レビュー後に影響する変更があれば、ここで1回行う。ゲートに当たらない変更ではレビューしない。必須のレビューが実施できなければ、§3 のとおり Codex で代替するか `pending` にする。
3. 各 criterion の証拠を開き、`satisfied` または `pending` を確定する。
4. 全 criterion が `satisfied` で、P0/P1 指摘がなく、依頼された delivery が完了した場合だけ Status を `done` にする。
5. 変更、検証、レビュー（実施したか、しなかった理由）、残存リスクを報告する。

## 7. 無人実行の規律

ユーザーが見ていない実行（非対話モード、バックグラウンド、外側のループ）では、次の条件で完了を判定する。長いタスクの途中で、進捗を報告するテキストだけで end_turn してしまうことがあるため。

- テキストだけの end_turn は完了とみなさない。Completion Contract に `pending` が残り、ユーザーの判断待ちもなければ、Current Next Action を実行する。
- 実行中のバックグラウンド agent があるうちは完了にしない。
- 同じ plan での自動継続は2回までとし、継続するたびに Progress Log に記録する。上限に達したら、Status を `blocked` にして理由と Current Next Action を記録し、ユーザーに返す。上限に達したことは受け入れにはならない。

## Stop Rules

- 同じ修正経路が3回失敗した。
- 1 cycle 完了しても意味のある進捗がない。
- 証拠が計画を否定する。
- ユーザー変更を上書きする必要がある。
- 破壊的、不可逆、外部副作用のある操作に権限がない。

停止・中断・コンテキスト圧縮の前に、plan に status、証拠、判断、blocker、Current Next Action を保存する。
