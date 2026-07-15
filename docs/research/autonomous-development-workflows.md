# 自律的な開発ワークフローの調査記録

調査日: 2026-07-14

## 結論

自律性を高める中心は、agent 数や無制限 loop ではない。次の4点を優先する。

1. 事実は環境から調査し、重要判断だけを人間へ返す。
2. 完了条件を default-fail にし、現在証拠で満たす。
3. 進捗、判断、証拠、次アクションを plan に永続化する。
4. 実装者とは別の新鮮な reviewer が結果を評価する。

## 参考にした実践

### Decision grilling

Matt Pocock の [`grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) は、環境から確認できる事実を先に調べ、一度に1問だけ質問し、各質問に推奨回答を添える。重要判断には有効だが、通常作業へ常時適用すると自律性を下げる。そのため明示起動の `/dev-core:grill` として採用する。

### 小さな実装単位と独立レビュー

[`obra/superpowers`](https://github.com/obra/superpowers) は、計画、TDD、小さな実行単位、独立レビュー、完了処理を一貫させる。「主張ではなく証拠」と reviewer の独立性を採用する一方、routine edit に多数の skill/agent を強制しない。

### 長時間 agent の状態管理

Anthropic の [長時間agent harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) と [`cwc-long-running-agents`](https://github.com/anthropics/cwc-long-running-agents) は、progress file、default-fail の完了条件、fresh-context evaluator を中核にする。`docs/plans/task-*.md` を唯一の実行状態とし、Completion Contract、Progress Log、Decision Log、Current Next Action を追加する。

複雑な harness は実行コストを増やすため、モデル能力の向上に合わせて構造を減らすべきという [Harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps) の警告も採用する。Agent Team をすべての microstep に必須化しない。

### Eval と context engineering

Anthropic の [agent eval guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) は、実タスクに近い trigger/no-trigger の両方を評価し、固定経路ではなく結果を採点することを推奨する。まず version 管理された behavior case と静的 validator を導入し、live model eval は calibration 後に追加する。

OpenAI の [Harness Engineering](https://openai.com/index/harness-engineering/) は、短い repository instruction、version 管理された execution plan、機械的な validation、feedback のルール化を重視する。plan と CI を正本として採用する。

### Claude Code の権限とhook仕様

Claude Code の公式 [Skills reference](https://code.claude.com/docs/en/slash-commands) では `allowed-tools` は利用可能toolの制限ではなくpermissionの事前許可として機能する。Git/gh/package managerの広いpatternは外部副作用まで無確認化するため、workflow frontmatterから除き、通常のpermission layerと本文のdelivery flagを併用する。read-onlyのgrillは `disallowed-tools` でもWrite/Edit/Bash/Taskを禁止する。

公式 [Hooks reference](https://code.claude.com/docs/en/hooks) では `SessionStart` はcommand/MCP、`PreCompact` はcommand/HTTP/MCPのみ対応し、prompt handlerは実行されない。SessionStartをdeterministic command hookへ変え、plan本文をsession contextへコピーせずallowlist済みpath/statusだけを出す。圧縮前の永続化は実行workflow自身の責務とし、event/typeの対応を静的validatorとnegative fixtureで固定する。

## 自律性の境界

| 状況 | 動作 |
| --- | --- |
| repositoryから確認できる事実 | 調査して続行 |
| 安全で可逆な選択 | 推奨defaultを記録して続行 |
| スコープ内で機械検証できる懸念 | 修正・再検証して続行 |
| product judgment、security boundary、不可逆data、破壊的操作、外部副作用 | 証拠と推奨案を示して確認 |
| 類似失敗3回、または1 cycle進捗なし | 停止して診断を共有 |

## 導入しないもの

- 通常作業へ常時発動する grill
- 無制限の Ralph 型 loop
- すべての microstep に mandatory Agent Team
- 明示依頼のない Issue、commit、push、PR、auto-merge
- 未calibratedな live model eval の required CI 化
- Spec Kit や planning-with-files の全面導入による既存 `docs/plans` との二重管理

GitHub の star 数は注目度の参考にはなるが品質保証ではない。採否は、このリポジトリの risk、検証可能性、context cost、外部副作用に照らして判断する。
