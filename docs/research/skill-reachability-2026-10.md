# スキルの発火と常時コストの計測（2026-10）

鮮度監査（`docs/research/skill-freshness-audit-2026-10.md`）の C18・C17・C35 の計測記録。スキルが自動で発火するかを、隔離した環境と実際のインストール構成の2つで測り、プラグインごとの常時コストを測った。

- 計測日: 2026-10-26
- Claude Code: 2.1.310
- モデル: `claude-opus-5-5`（`--model` で固定）。effort は指定していない（CLI の既定）
- 回数: 各ケース1回。**1回ずつなので誤差が大きい**。ここから言えるのは傾向だけで、発火率の推定ではない

## 1. 隔離した環境での自動発火（`claude plugin eval`）

対象のプラグインだけを読み込んだ環境で、行動ケース（`dev-core/evals/skill-behavior-cases.json`）のうち自動発火のケースを流した。ケースは `scripts/gen-plugin-evals.mjs` で生成し、Skill ツールが呼ばれたかだけを無料の grader で見た。この計測の grader は、名前空間の無い同名の呼び出しも発火に数える版だった（今の生成スクリプトは、正例では `dev-core:<skill>` の呼び出しだけを数える）。

- 対象: dev-core 5.1.0（このブランチの作業ツリー）。正例 11 件、負例 5 件
- 実行: `claude plugin eval ./dev-core --eval-dir evals/plugin --runs 1 --ablation none --no-publish --trust-plugin --max-cost-usd 5 --model claude-opus-5-5 -j 4`
- 費用: 2.24 USD（16 run、72 秒）

| ケース | 期待 | 結果 |
|---|---|---|
| verify-labeled-evidence-reuse | verify が発火 | 発火せず |
| verify-stale-evidence-invalidated | verify が発火 | 発火せず |
| verify-flags-test-weakening | verify が発火 | 発火 |
| debug-three-strikes-same-path | debug が発火 | 発火せず |
| debug-distinct-failures-not-strikes | debug が発火 | 発火せず |
| debug-red-reproduction-before-hypotheses | debug が発火 | 発火 |
| codex-collab-rescue-needs-consent | codex-collab が発火 | 発火せず |
| codex-collab-rescue-preauthorized | codex-collab が発火 | 発火せず |
| best-practices-no-test-weakening | best-practices が発火 | 発火せず |
| best-practices-independent-expected-values | best-practices が発火 | 発火せず |
| data-design-ops-no-explain-analyze-in-production | data-design-ops が発火 | 発火せず |
| verify-negative-run-app | verify が発火しない | 発火せず |
| debug-negative-claude-code-itself | debug が発火しない | 発火せず |
| best-practices-negative-typo-fix | best-practices が発火しない | 発火せず |
| codex-collab-negative-plain-review | codex-collab が発火しない | 発火せず |
| data-design-ops-negative-er-modeling | data-design-ops が発火しない | 発火せず |

正例は 11 件中 2 件しか発火しなかった。負例はすべて発火しなかったが、正例もほとんど発火していないので、負例の結果だけでは誤発火が無いとは言えない。

## 2. 実際のインストール構成での自動発火

利用者の設定とインストール済みの全プラグインを読み込んだ状態で、同じプロンプトを `claude -p` に流し、どのスキルが発火したかを記録した（`scripts/measure-skill-firing.mjs`）。

- 対象: **インストール済みの版**（dev-core 5.0.0、hotl-engineering 2.0.1 など）。作業ツリーの版ではない
- 安全のため、使えるツールを Skill と読み取り系（Read・Glob・Grep）に絞り、MCP を読み込まなかった（`--tools`、`--strict-mcp-config`）。起動直後の init イベントで、それ以外のツールが無いことを確かめてから流した
- `--max-turns 2`
- **この計測では hooks が有効だった**（スクリプトの初版）。動いたのは、利用者の SessionStart（セッションの状態の記録）、インストール済みの dev-core 5.0.0・codex companion・compact-plus の SessionStart / UserPromptSubmit / Stop / SessionEnd など。どれもセッションの記録やコンテキストの注入で、外部への送信や破壊的な操作をするものは無かった。ただし dev-core の SessionStart が注入する規律の文面は、スキルの選び方に影響しうる。hooks はツールの一覧に出ず、利用者の権限で書き込みや通信ができるので、スクリプトは今は既定で hooks を切る（`--settings '{"disableAllHooks":true}'`。`--with-hooks` で有効にする）
- 判定は `dev-core:<skill>` の発火だけを対象の発火として数えた。組み込みの `run`・`code-review` のように名前空間の無い名前は別のスキルとして扱った

| ケース | 期待 | 発火したスキル | 判定 |
|---|---|---|---|
| verify-labeled-evidence-reuse | verify が発火 | なし | 不合格 |
| verify-stale-evidence-invalidated | verify が発火 | dev-core:verify | 合格 |
| verify-flags-test-weakening | verify が発火 | dev-core:verify | 合格 |
| debug-three-strikes-same-path | debug が発火 | なし | 不合格 |
| debug-distinct-failures-not-strikes | debug が発火 | なし | 不合格 |
| debug-red-reproduction-before-hypotheses | debug が発火 | dev-core:debug | 合格 |
| codex-collab-rescue-needs-consent | codex-collab が発火 | dev-core:debug | 不合格 |
| codex-collab-rescue-preauthorized | codex-collab が発火 | なし | 不合格 |
| best-practices-no-test-weakening | best-practices が発火 | なし | 不合格 |
| best-practices-independent-expected-values | best-practices が発火 | なし | 不合格 |
| data-design-ops-no-explain-analyze-in-production | data-design-ops が発火 | なし | 不合格 |
| verify-negative-run-app | verify が発火しない | run（組み込み） | 合格 |
| debug-negative-claude-code-itself | debug が発火しない | なし | 合格 |
| best-practices-negative-typo-fix | best-practices が発火しない | なし | 合格 |
| codex-collab-negative-plain-review | codex-collab が発火しない | code-review（組み込み） | 合格 |
| data-design-ops-negative-er-modeling | data-design-ops が発火しない | dev-core:data-design-ops, dev-core:data-auth-boundary-design | 不合格 |

正例は 11 件中 3 件で発火した。負例は 5 件中 4 件で合格した。費用は 2.95 USD（16 件）。

## 3. 観測と、ここから言えること

- **自動発火は弱い**。隔離した環境でも実際の構成でも、正例の多くで対象のスキルが発火しなかった。行動ケースの多くは「振る舞い」を確かめるために作ったもので、プロンプトが説明の語彙（「検証して」「原因を調べて」など）を含まないものが多い。発火そのものを測るケースとしては弱い
- **組み込みのスキルとの取り合いは期待どおり**だった例がある。実際の構成で `verify-negative-run-app`（アプリを起動して画面を見る）は組み込みの `run` が発火し、dev-core:verify は発火しなかった
- **期待するスキルの置き方に議論の余地がある**例もある。`codex-collab-rescue-needs-consent`（同じ修正が3回失敗した）では、実際の構成で dev-core:debug が発火した。Three Strikes Rule の正本は debug なので、この発火は誤りとは言い切れない
- **紛らわしい依頼での誤発火が1件あった**。実際の構成で `data-design-ops-negative-er-modeling`（ER 図と正規化の方針）に、正しい dev-core:data-auth-boundary-design と一緒に dev-core:data-design-ops（物理設計）も発火した。インストール済みの 5.0.0 での結果なので、5.1.0 の説明で再計測してから直すかを決める
- `/dev-core:execute` のような明示起動は、子のセッションで展開される（init のコマンド一覧に載り、モデルは execute の手順どおりに best-practices を読み込んだ）。ただし展開された本文は trace に残らないので、明示起動のケースは振る舞い（ツールの呼び出し）で判定する

次にやること（この PR の範囲外）:

- 発火を測るための正例を、説明の語彙に沿った短いプロンプトで別に用意し、3回以上流して率を出す（C30・C73 の判断材料）
- 説明を変えるスキルは、変更の前後で同じケースを流して比べる
- `--behavior`（llm grader）での振る舞いの判定は、判事の費用がかかるので、対象を絞って行う
- hotl-engineering の相談ケース（`hotl-engineering/evals/cases.json`）は skill-creator 形式で、生成スクリプトはまだ読めない。C17 の第1段（hotl #3〜#6）はこの形式への対応か、ケースの移し替えが先に要る
- indie-product-marketing の自動発火のケースも未計測（外部への投稿を頼むケースは、実際の構成での計測から除く）

## 4. 常時コスト

`claude --plugin-dir <dir> plugin details <name>` の Always-on から、手動起動専用（`disable-model-invocation: true`）のスキルの分を引いた値。手動起動専用のスキルは一覧に載らないため。計測した版は、鮮度対応の PR を重ねた状態（knowledge-freshness ブランチ、70c1b1a）。

| プラグイン | 版 | Always-on（CLI の推定） | 手動起動専用の分 | 差し引き |
|---|---|---|---|---|
| dev-core | 5.1.0 | 6,284 | 780 | 5,504 |
| github-tools | 2.1.1 | 210 | 210 | 0 |
| hotl-engineering | 2.0.2 | 981 | 250 | 731 |
| delivery-core | 0.2.0 | 1,659 | 0 | 1,659 |
| ai-engineering | 0.4.0 | 734 | 0 | 734 |
| compliance-core | 0.2.0 | 852 | 0 | 852 |
| design-core | 0.3.0 | 1,051 | 0 | 1,051 |
| indie-product-marketing | 0.1.0 | 1,263 | 0 | 1,263 |

dev-core の値には、エージェント5つの説明（約 0.7k）が入っている。再現するときは、各プラグインのディレクトリで次を実行し、手動起動専用のスキルの行を引く。

```bash
claude --plugin-dir ./dev-core plugin details dev-core
```

## 5. 費用

| 計測 | 費用（USD） |
|---|---|
| 試行（plugin eval の動作確認、明示起動の展開の確認） | 0.48 |
| 隔離した環境での自動発火（16 run） | 2.24 |
| 実際のインストール構成での自動発火（16 件） | 2.95 |
| 合計 | 5.67 |
