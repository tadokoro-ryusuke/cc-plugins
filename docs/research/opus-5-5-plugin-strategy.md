# Opus 5.5 時代の cc-plugins 構成方針（調査・提案）

- 調査日: 2026-09-23
- 対象: cc-plugins `9ed9423`（dev-core 4.4.0）、codex-plugins `321e032`（dev-core 5.5.0）、Claude Code 2.1.280
- 状態: **提案**（実装・バージョン変更は未実施）
- レビュー: 3視点の設計パネル、反証レビュー、advisor、Codex の独立レビュー（P1 が3件、P2 が7件）を統合済み
- 根拠の区別:
  - **[公式]** 公開一次情報
  - **[実測]** Claude Code 2.1.280 をローカルで実行し、transcript の実効値で確認したもの
  - **[実装]** 2.1.280 のバイナリ文字列で確認したもの（docs に記載がない可能性あり）
  - **[二次]** コミュニティ情報
  - **[推測]**

---

## 1. 結論

**「実装は Opus 5.5 medium で」には賛成です。ただし「サブエージェントで」を既定にはしません。**

1. **medium は妥当な出発点です。**
   - Opus 5.5 の既定 effort は、API でも Claude Code でも medium です [公式]。
   - Anthropic の評価では、medium で Opus 5 の high と同等以上でした。大規模リポジトリでの多段コーディングでも、ステップ数が少なく、トークンは約半分でした [公式]。
   - ただし差はタスクによります。CursorBench は medium 52.5% に対して max 57.8% です。公式も effort sweep を推奨しているので、固定値ではなく出発点として扱います。
2. **トポロジーを先に決め、effort は後で決めます。**
   - 密結合・逐次の実装は、計画の大きさに関係なく親が直接行います。
   - 委譲するのは、次の3つの場合だけです。
     - 独立したトラックがある
     - 文脈を隔離したい
     - リスクゲートで独立評価が要る
   - 根拠は次の3つです。
     - Anthropic のコスト最適化ガイドでは、1つのモデルで足りる作業は、同じモデルを低い effort で回すほうが毎回安くなりました [公式]。
     - サブエージェントは親とキャッシュを共有しません [公式]。
     - codex-plugins も 5.4.0 以降、同じ結論です。
3. **Claude 版の「実行プロファイル」は、agent frontmatter の `effort` で表します。** 次のことを確認済みです [実測・実装・公式]。
   - プラグイン同梱の agent でも `effort:` が効き、セッションの effort（`/effort` や ultracode）を上書きします。
   - effort を指定しない agent はセッションの effort に従います。ultracode なら全員が xhigh で動きます。
   - Agent ツールには、呼び出しごとに effort を渡す引数がありません。

   そこで役割ごとに固定します。
   - 委譲された実装と E2E は medium
   - リスクゲートのレビューは high
   - 親はユーザーのセッションのまま（固定しません）

   レビュアーを high にするのは、レビューの頻度を減らすのと同時に、残るレビューの effort まで下げないためです。
4. **親の effort はプラグイン側で変えません。**
   - `/dev-core:execute` の frontmatter に `effort: medium` を置けば、スラッシュ起動時はターン全体に効きます（F9）。しかし、ユーザーが意図して選んだ xhigh を黙って下げてしまいます。
   - 既定の effort を下げて元に戻した前例もあります（F15）。
   - 親の effort はユーザーの選択として尊重し、README で「計画は high 以上、実行は medium のセッションで」と案内します。
5. **indie は新プラグイン `indie-product-marketing` として移植します。**
   - ドメイン知識の正本は codex に一本化し、cc へは一方向に翻案します。
   - cc が持つのは、Claude Code 固有の実行指示だけです。
6. **codex の最近の変更のうち、hotl のセキュリティゲート修正を最優先で取り込みます。**
   - cc の hotl は、導入時に既存の必須チェックを弱める手順になっています。
   - codex 06afa51 はこれを修正済みです。

---

## 2. 判断を左右した事実

| # | 事実 | 根拠 |
|---|---|---|
| F1 | Opus 5.5 は $4/$20、cache read $0.20（入力単価の5%）、コンテキスト 1M。既定 effort は medium（他のモデルは high、Opus 4.7 は xhigh）。公式の指針は「xhigh / max は品質向上を測定できた作業に限る」「Opus 5 の設定を持ち越さず、effort を sweep する」 | [公式] platform.claude.com の effort、prompting-claude-opus-5-5、models overview |
| F2 | 発表ページのベンチ表は、注記がない限り max effort の値。Terminal-Bench 4.0（66.4%）だけは xhigh。FrontierCode は medium 54.6% とほぼ max 54.4%。CursorBench は medium 52.5%、max 57.8% | [公式] anthropic.com/claude-opus-5-5 の脚注と図 |
| F3 | コスト最適化ガイドの結果: マルチモデル構成は、同じモデルを低い effort で回すより高くついた。オーケストレータが得をしたのは「ルーチン作業の裾野」と「1コンテキストに収まらない作業」の2つだけ。low で全件を回し、失敗した分だけ再実行すると、合格率を保ったまま費用は約半分（テストなどの失敗シグナルがあることが前提）。測定対象に Opus 5.5 は含まれない | [公式] optimizing-for-cost-and-intelligence |
| F4 | Opus 5 ガイド（Opus 5.5 でも出発点とされる）は、「subagent で検証せよ」といった指示が過剰検証を招くので削除するよう勧めている。一方、ハーネス設計の記事は、作業者と評価者を分けることを強いレバーとしている | [公式] prompting-claude-opus-5、engineering blog |
| F5 | Opus 5.5 は長いタスクの途中で、テキストだけの進捗報告で end_turn することがある。無人のループは完了条件で判定し、自動継続は2〜3回で止める | [公式] prompting-claude-opus-5-5 |
| F6 | effort の優先順位: `CLAUDE_CODE_EFFORT_LEVEL` ＞ ターンの effort レイヤ（agent frontmatter、スラッシュ起動した skill）＞ セッションの effort（`--effort`、`/effort`、ultracode）＞ `modelSettings.<model>.effortLevel` ＞ モデルの既定値。`maxEffortLevel` が上限になる | [実測][実装][公式] sub-agents、model-config |
| F7 | agent frontmatter の `effort` は、プラグイン agent でも有効。指定がない場合は、セッションの effort が明示されていればそれに従い、なければそのモデルの設定値か既定値を使う。user settings のトップレベルにある `effortLevel` は Opus 5.5 には効かない | [実測] transcript の実効 effort、[公式] changelog 2.1.280 |
| F8 | Agent ツールには、呼び出しごとに effort を渡す引数がない（#72596 not planned）。プラグイン agent の model / effort を settings で上書きする機能もない（#79866 not planned）。呼び出しごとに model / effort を変えられるのは Workflow の `agent()` だけ | [公式] GitHub issues、workflows docs |
| F9 | skill frontmatter の `effort` は、ユーザーがスラッシュで起動したときだけ、そのターン全体（親と、effort を指定していない子）に効く。モデルが Skill ツールで起動した場合は反映されなかった | [実測] `-p` の単発ターンで測定。複数ターンにわたって持続するかは未測定 |
| F10 | Anthropic API では、alias の opus は Opus 5.5、sonnet は Sonnet 5 を指す。3P プロバイダでは異なる（sonnet は 4.5 系、Foundry の opus は 4.6）。model の解決順は、呼び出し時の model 引数 ＞ frontmatter ＞ `CLAUDE_CODE_SUBAGENT_MODEL` ＞ 親 | [公式] model-config、sub-agents |
| F11 | プラグイン agent では hooks・mcpServers・permissionMode が無視される | [公式] sub-agents |
| F12 | プラグインは Workflow スクリプト（.js）を配布できる。既定の置き場所は `workflows/` で、直下の .js だけを読む。manifest の `workflows` で場所を変えられる。起動にはユーザーの opt-in が必要 | [公式] workflows、plugins-reference。[実装] ローダ |
| F13 | Agent ツールには、description に "proactive" とある agent を、頼まれなくても使うよう指示されている。`ultrathink` はユーザー入力のキーワードとして検出されるので、agent 本文に書いても効かない可能性が高い | [実装] |
| F14 | Agent Teams の「delegate mode」にあたる文字列が 2.1.280 に見つからない（廃止の可能性、確度は中〜低）。teammate はリーダーのセッション effort を継承する | [実装] |
| F15 | 2026-03 に Claude Code は Opus 4.6 の既定 effort を medium に下げたが、04-07 に「wrong tradeoff」として元に戻した。Opus 5.5 は較正が別物だが、UX 上の前例になる | [公式] april-23-postmortem |

---

## 3. codex-plugins の思想の変遷と、その翻訳

### 3.1 モデルの値は揺れ、トポロジーは収束した

| 版 | 実装ロール | 親・レビュアー | 決め方 |
|---|---|---|---|
| 5.1.0 | Sol medium | Astra high | ユーザーの発案 |
| 5.1.1 | Astra medium | Astra high | 品質と手戻りからの推論（未測定） |
| 5.1.2 | Sol medium | 親を Astra medium | Codex のクレジット単価（Codex 固有の事情） |
| 5.2〜5.3 | Astra high | Astra high、調査は Sol medium | ユーザーの選好 |
| 5.4.0 | 据え置き | 据え置き | **委譲判断を刷新**（親が実装するのを既定にし、レビューはリスクで判定） |
| 5.5.0 | Sol medium ＋ preset（routine = Luna high、bounded = Luna max、complex = Sol high） | Astra high、調査は Luna high | 公開ベンチと単価（Luna は Sol の 1/20）。比較評価は未実施 |

- モデルの値は5回変わりましたが、どれも比較測定に基づくものではありません。
- 一度入ってから変わっていないものがあります。
  - 所有者（親か子か）を決めてから preset を選ぶ
  - router を置かない
  - 決定的な作業はツールで行う
  - レビューはリスクで判定する
  - 独立レビューでは reviewer の設定を使う
  - requested と verified を区別する
- **移植すべきなのは、この変わっていない部分です。**

### 3.2 preset の翻訳: 同じモデルの effort 段階として表す

- Codex では Luna が Sol の 1/20 の単価なので、モデルを段階分けする preset には大きな節約効果があります。
- Claude では事情が違います。
  - Sonnet 5 は Opus 5.5 の 1/2 の単価で、cache read は同額（$0.20）です。
  - Haiku 4.5 は effort に対応していません。
  - Anthropic は「カスケードを組む前に、同じモデルで effort を sweep せよ」としています（F3）。
- そこで Claude 版は、**Opus 5.5 1つを effort で段階分けする**形で表します。
- 選ぶ順序は Codex と同じです。
  1. 委譲に価値があるかを判定する
  2. 範囲と受け入れ条件を確定する
  3. effort を選ぶ

| Codex の選択 | 使う条件（Codex） | Claude 版 |
|---|---|---|
| routine | 短く機械的で低リスク、受け入れチェックが厳密 | 当面は既定（medium）で扱う。low は、原因と修正内容が確定していて振る舞いを独立に検証できる作業に限る。測定後に agent を足すかを判断する（Phase C） |
| bounded / 既定 | 振る舞いとインターフェースが確定し、許可するファイルと依存が分かっている | `tdd-practitioner`（medium） |
| complex | モジュールをまたぐ推論や競合する仮説がある。判断は親が持つ | 原則は親が行う（セッションの effort で）。独立した complex な項目を委譲する手段は要検証とし、確認できるまでは親が持つ。候補は Workflow の `agent({agentType, effort})` だが、agent の frontmatter とどちらが優先されるか未確認 |

Agent ツールでは effort を指定できないので、段階は agent ファイルを分けて表します（F8）。

### 3.3 移植表

**移すもの**

| 思想（codex の出典） | cc での形 |
|---|---|
| 密結合・逐次の実装は親が行う。委譲は、具体的な利得（独立した進行、専門的な証拠、文脈の隔離）が調整コストを上回るときだけ。最小の構成を選ぶ（`planned-execution.md`、`orchestration.md`） | 知識層に `best-practices/references/delegation-and-review.md` を新設する（ツール非依存）。execute / tdd / refactor に数行の適用規則を書く |
| レビューはリスクで判定する（セキュリティ・権限、永続データ・migration、並行処理、重要な公開契約、明示的な要件）。独立レビューを選んだら reviewer の設定を使う。必須のレビューが実施できなければ pending にする | 同上と、execute の Final Gate |
| 決定的な作業はツールで直接実行する。コマンド1つのために agent を立てない | quality-checker を廃止し、親が `dev-core:verify` を実行する |
| 証拠の再利用条件（生の成果物がある、入力と環境が一致する、規約が許す。「前回の実行を今確認した」と明記する）。検証の `BLOCKED` や未実行を成功と区別する | `skills/verify` の Iron Law を改訂する。最終ゲートには、最終 diff と同じ入力に対する実行証拠を必須とする（条件を満たせば再利用してよい） |
| Three Strikes は同じ経路に限る。担当を替えても履歴を引き継ぐ | `skills/debug`、SessionStart |
| handoff は最小限にする（全履歴を渡さない）。子に再帰委譲させない。上限に達しても受け入れにはならない。状態は `completed / needs-parent / blocked`。前提が崩れたら親に返し、範囲を定め直す | 委譲先の agent 本文 |
| requested と verified の区別、軽量な dispatch ledger | plan の Decision Log に1行書く。実効値は `subagents/agent-*.jsonl` で確認できる |
| 許可済みの作業を、計画や下書きの段階で止めない | execute / task の終了条件 |

**置き換えるもの**

| 思想（codex の出典） | cc での形 |
|---|---|
| `execution-profile.json` と resolver、capability JSON | agent frontmatter の `effort` と、固定 effort の allowlist（validator で検査） |
| implementation presets | effort を固定した agent ファイル（3.2）と、Workflow の `agent({effort})` |
| 親モデルの不一致の処理 | 開始時に実効 effort を記録する（`${CLAUDE_EFFORT}`、要確認）。xhigh 以上なら一度だけ `/effort medium` を案内する |

**移さないもの**

| 思想（codex の出典） | 理由 |
|---|---|
| `fork_turns`、TOML のロール、`openai.yaml`、フックパス問題への対処、8,000字の予算 | Codex ホスト固有 |
| 具体的なモデルの値（Astra high、Sol medium、Luna max） | ベンダーごとに較正が違い、どれも未測定 |

---

## 4. 推奨構成: dev-core

### 4.1 実行トポロジーの規則（execute / tdd / refactor / debug で共通）

1. **親が既定の実装者です。** skill の frontmatter には effort も model も置きません。
2. **委譲は次の3つの場合だけです。**
   - 書き込み範囲・依存・共有リソースが重ならない独立トラック
   - 大量の出力（ビルドログ、E2E）を親の文脈から隔離したいとき
   - リスクゲートでの独立評価

   委譲したら、Decision Log に1行記録します（利得、書き込み範囲、agent、戻る条件）。「ロール名がある」「テストがある」だけでは利得になりません。
3. **決定的な検証は親がツールで実行します。** build / type / lint / test / `gh` が対象です。
4. **レビューはリスクゲートで判定します。**
   - ゲートの対象
     - セキュリティ・権限・秘密情報の境界
     - 永続データ・migration
     - 並行処理・冪等性
     - 重要な公開契約
     - 明示的な要件
   - 進め方
     - 安定した候補に対して、新しい文脈で1回レビューします。修正後は影響する範囲だけを見直します。
     - 行数や計画の大きさだけではゲートにしません。
   - 必須レビューが起動できないとき
     - Codex レビュー（`codex-collab`）で代替します。
     - それもできなければ「独立性は未充足」と明記し、criterion は pending のままにします。
5. **無人実行の規律（F5）**
   - テキストだけの end_turn は完了とみなしません。
   - Completion Contract に pending が残っていて、ユーザーの判断待ちがなければ、次の action を実行します。
   - 実行中のバックグラウンド agent があるうちは完了にしません。
   - 同じ plan での自動継続は2回までにします。
6. **Workflow を組む場合**（ultracode など）も、逐次の実装は分割しません。独立した実装の段は `effort:'medium'` にします。

### 4.2 ロール × model × effort

| 役割 | agent | model | effort | 扱い |
|---|---|---|---|---|
| 要件・設計・統合・受け入れ・密結合な実装 | メインセッション | セッション | セッション | 推奨は「計画は high 以上、実行は medium」 |
| 委譲された実装（既定、bounded） | `tdd-practitioner` | 省略（親に追従） | **medium** | 維持。「必ず委譲」は撤廃 |
| 委譲されたビルド修復（大量のエラーログを隔離する） | `build-error-resolver` | 省略（`sonnet` をやめる） | **medium** | 維持。意味の判断を含むので、low は本文と返却条件を狭めて測定してから |
| E2E の実行とデバッグ（ログの隔離） | `e2e-runner` | 省略（`sonnet` をやめる） | **medium** | 維持 |
| 独立レビュー（リスクゲート） | `code-reviewer` | `inherit`（明示） | **high（暫定）** | 維持。語調とスコアを修正 |
| セキュリティの独立レビュー | `security-auditor` | `inherit`（明示） | **high（暫定）** | 維持（該当するときだけ） |
| 読み取り専用の調査 | 組み込みの Explore | — | — | agent は新設しない |
| 計画 | `task-planner` | — | — | 廃止。ユーザーとの対話の文脈を保つため、親が計画する |
| 決定的な品質チェック | `quality-checker` | — | — | 廃止。親が verify を直接実行する |
| Issue 作成 | `issue-creator` | — | — | 廃止。親が `gh issue create --body-file` を使う |
| ドキュメント更新・アーキテクチャ助言 | `doc-updater`、`architecture-guide` | — | — | 廃止（どの workflow からも参照されていない） |

**固定が効く条件**

- 既定の Opus 5.5 medium のセッションでは、medium の固定は何も変えません。レビュアーだけが high に上がります。
- 固定が効くのは、次の2つの場合です。
  - 親を high / xhigh / ultracode に上げたとき。このとき「親は高く、実装は medium」になり、ユーザーが想定する構成そのものになります。
  - 親が Fable 5.1 や Sonnet 5 のとき。どちらも既定が high なので、実装は medium に下がります。
- 逆に、親が xhigh 以上（ultracode を含む）のときは、レビュアーが xhigh から high に**下がります**。これは意図した上限です。公式は xhigh と max を「測定できた作業に限る」としているためです。レビューも xhigh で行いたい場合は、`CLAUDE_CODE_EFFORT_LEVEL` を使います（全体に効きます）。
- 実行系は model を省略するので、親が Fable 5.1 なら、実装も Fable 5.1 の medium で動きます。単価は Opus 5.5 の2.5倍です。安くしたいときは `CLAUDE_CODE_SUBAGENT_MODEL=opus` を使います。
- 判断系は `inherit` を明示しているので、この環境変数の影響を受けません。

**設計の理由**

- **固定するのは「下げても足りる」と公式が示している役割と、品質を落とせない役割だけです。**
  - 固定した値は、ユーザー側で上書きできません（F8）。
  - 逃げ道は `CLAUDE_CODE_EFFORT_LEVEL`（全体に効く）と `maxEffortLevel`（上限）だけです。README に書きます。
  - 固定には allowlist と理由を必須にします。
- **レビュアーを high にする理由**
  - 今回はバッチごとのレビューをやめて、ゲートに絞ります。レビューの頻度を減らすのと同時に、残るレビューの effort まで下げないためです。
  - codex でも reviewer は親と同じ上位の設定です。
  - ただし「high が medium より優れている」ことは実証されていません。Opus 5.5 は低い effort でもレビューの性能が高いという顧客報告があります [公式・顧客の声]。一方で、難しいケースでは高い effort のほうが検出が増えるという報告もあります [二次]。Phase C で medium と比べて判断します。
- **実行系の model を省略する理由**
  - プロバイダ上で親のモデルに追従するので、3P で `sonnet` が 4.5 系になる問題を避けられます。
  - `sonnet` の固定をやめると、Sonnet 5 の effort を高く設定しているユーザーでも、固定した effort で動きます。

**frontmatter の例**

```yaml
---
name: tdd-practitioner
description: 親が委譲を決めた、書き込み範囲と受け入れチェックが確定した実装単位を TDD（Red→Green→Refactor）で実装し、変更ファイル・実行コマンドと生の結果・残る懸念・状態（completed / needs-parent / blocked）を返す。
effort: medium
color: red
tools: Read, Write, Edit, Grep, Glob, Bash, TodoWrite
skills:
  - dev-core:best-practices
---
```

```yaml
---
name: code-reviewer
description: リスクゲート（セキュリティ・権限、永続データ・migration、並行処理、重要な公開契約、明示要件）に該当する変更を、元の要件・diff の識別子・生の検証出力だけを受け取り、新しい文脈で評価する。指摘は重大度・確度・file:line 付きで全件返す。
model: inherit
effort: high
color: cyan
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit, NotebookEdit, Agent
skills:
  - dev-core:best-practices
---
```

### 4.3 コマンドごとの変更

| コマンド | 現状 | 変更 |
|---|---|---|
| execute | 振る舞いを変えるたびに tdd-practitioner を呼ぶ。バッチごとに quality-checker を呼ぶ。非自明なバッチごとと最終段で code-reviewer を呼ぶ。spawn 数がバッチ数に比例して増える | 4.1 の規則を適用する。spawn は通常0〜1回（ゲートに該当したときのレビュー）。最終ゲートは親が verify を実行する |
| tdd | 「必ず Task で委譲する。直接実装しない」 | 単独で起動したときは親が実装する |
| refactor | 「必ず呼び出す」が3箇所ある。quality-checker に依存している | 同上。検証は verify で行う |
| task | task-planner に委譲し、issue-creator を使う | 親が計画を書く。広い調査は Explore に任せる。Issue は親が `gh` で作る |
| task-team | delegate mode（2.1.280 には見当たらない）を使う。1人あたり5〜6タスクに固定している。task-planner に二重に依頼している | 廃止を推奨する。計画を独立に批評させたいときは、`/task` の後に新しい文脈で1回レビューする |
| debug-team | delegate mode を使う。仮説を3つに固定している | 「競合する仮説を規模に応じて立てる」に改める。Phase D で Workflow スクリプト `debug-hypotheses` に置き換える候補 |
| code-review | A〜F のスコアと、不安を煽る語調がある | 規約レンズ（FSD / CA / DDD、セキュリティ規約）に寄せる。バグ探索は組み込みの `/code-review` と役割を分け、description で区別する |
| e2e | e2e-runner（sonnet）を使う | model を省略し、effort は medium に固定する |
| grill | — | `disallowed-tools` の旧名 `Task` を `Agent` に置き換える（要確認） |

### 4.4 知識層（skills/、Codex と共有）

**新設・改訂**
- `best-practices/references/delegation-and-review.md` を新設します。4.1 の原則をツール非依存で書き、best-practices の索引表に1行追加します。
- `verify` の改訂
  - 証拠の再利用条件を入れます。
  - `BLOCKED` や未実行を成功と区別する契約を入れます。
  - 「同一ターン内の実行だけが証拠」は改めます。
- `debug`: Three Strikes を「同じ修正経路」に限定します。
- `codex-collab` の改訂
  - Zero Trust Review の原則を知識層に移します。今は Claude 専用の `agents/code-reviewer.md` が正本になっています。
  - stop-time review gate と dev-core のリスクゲートを併用するときの優先順位を書きます。

**b07bbad の知識層改訂を取り込む**

固定ルールや一律の承認を、既存の規約と具体的なリスクを優先する書き方に改めます。

| 対象 | 現状 | 改訂の方向 |
|---|---|---|
| `best-practices/SKILL.md:37-41` | 「重複は即座に排除」「関数は50行以下」 | 既存の規約とリスクを優先する |
| `references/coding-standards.md:33` | 型の逃げ道を使うには一律で人間の承認が要る | 同上 |
| `test-design/SKILL.md:30-33` | E2E はハッピーパスだけ、5〜15本 | 必要な権限・失敗・復旧の経路も E2E で検証する |

**ai-engineering / ai-system-design**

顧客向けの設計知識として、次を追加します。
- effort を設計軸として扱う
- カスケードを組む前に effort を sweep する
- サブエージェントはキャッシュを共有しない
- 無人のループでは、テキストだけの end_turn を完了とみなさない

### 4.5 hooks

- **SessionStart**: codex 5.4.0 の規律5行に合わせます。
  - リスクに応じたチェック
  - 証拠の再利用条件
  - 子の主張を検証する
  - 状態を永続化する
  - Three Strikes は同じ経路に限る
- **Stop**: 品質ゲートは維持します。4.4.0 で追加した Go の `fmt.Println` の検出は、`main` パッケージの正当な出力にも当たるので、範囲を見直します。
- **無人実行の継続ガード**（Stop hook の block か `/goal`）は Phase C の候補です。
  - まず execute の規律（4.1-5）だけで挙動を測ります。
  - 入れる場合は次の点を設計に含めます。
    - `stop_hook_active` と組み込みの block 上限
    - 進捗シグナルでのリセット（satisfied の数が増えたら、など）
    - 既存の Stop hook や codex review gate との相互作用

### 4.6 Opus 5.5 向けのプロンプト近代化

- agent の description から「proactive に使用」を削除します（F13）。
- `ultrathink`（task-planner）と `whenToUse`（issue-creator）を削除します。
- code-reviewer の不安を煽る語調を削除します（「信用するな」「疑わしいほど速い」など）。前段の agent を名指ししている箇所（`:15`）も直します。
- code-reviewer の A〜F スコアと「良い点も書く」を削除します。
  - 指摘は全件を確度付きで報告させ、絞り込みは後段で行います。
  - 「重大なものだけ」とは指示しません。
- tdd-practitioner と quality-checker の合理化テーブルは、理由付きの短い方針にまとめます。Iron Law の核（テストを先に書く、証拠なしに完了を主張しない）は残します。
- 「必ず」「⚠️重要」で委譲を強制している箇所は、条件文に置き換えます。
- 矛盾を解消します。
  - config を変えたときにテストが要るか（tdd-practitioner と execute で食い違っている）
  - 検証の範囲（quality-checker は6段階すべて、execute は追加ゲートとしている）
- allowed-tools の `Task(subagent_type:…)` は `Agent(…)` の表記へ移します。事前許可として効くかは要確認です。

### 4.7 validator と CI

- **`scripts/check-plugin-agents.mjs` を新設します。**
  - 対象は marketplace に載る全プラグインの `agents/*.md` です。
  - 検査する項目
    - name とファイル名が一致している
    - `effort` の値が許容範囲にある
    - 固定 effort が allowlist と一致している
    - プラグイン agent で無視されるフィールドがない
    - `whenToUse` がない
    - description に `proactive` がない
  - 最初は警告として入れ、本文を直す PR でエラーに上げます。
- **呼び出し先の存在を検査します。**
  - 対象は、skill の allowed-tools と本文にある `dev-core:<agent>` への参照です。
  - 現役の指示と一覧だけを対象にします。移行ノートと調査文書は除外します。
- **drift の deny-list を層ごとに分けます。**
  - Codex と共有する `dev-core/skills/`: `effort`・`context`・`agent` も禁止します。
  - `workflows/`: `model` は禁止のまま、`effort` は allowlist で扱います。
- **CI の対象を marketplace.json から導出します。**
  - 対象は `on.push.paths` と validate ループです。
  - 現状、delivery-core・ai-engineering・compliance-core・design-core が CI の対象から漏れています。
- **`validate-skill-evals.mjs` に `--plugin` 引数を追加します。** dev-core 固有の必須ケースと件数の下限は、dev-core を検査するときだけ適用します。
- **evals に追加する行動ケース**
  - 密結合な計画では spawn しない
  - 独立トラックだけを委譲する
  - lint のために agent を立てない
  - migration では安定した候補に1回レビューし、レビュアーがいなければ pending にする
  - docs だけの変更ではレビューしない
  - テキストだけの end_turn を完了とみなさない
  - 証拠を再利用するときはラベルを付ける
  - 同じ経路での Three Strikes
  - 単独の `/dev-core:tdd` では親が実装する
  - delegate mode を案内しない

---

## 5. 推奨構成: indie-product-marketing（新規）

| 論点 | 方針 |
|---|---|
| 範囲 | codex-plugins の `indie-product-marketing` にある3スキル（`indie-idea-discovery`、`indie-product-marketing`、`global-landing-design`）を、同じ名前のプラグインとして移植する |
| 正本と同期の向き | **ドメイン知識の正本は codex に一本化し、cc へは一方向に翻案する。**<br>SKILL.md・references・assets の判断規則は、ファイルの境界をまたいでいる（例: handoff の条件が SKILL・reference・asset の3箇所にある）。そのため、ファイルの種類ごとに正本を分けると、往復の同期が発生する<br>・`SKILL.md`: codex 版の日本語翻案（一方向）<br>・`references/**` と `assets/**`: 英語原文のコピー（一方向。同期元の commit と hash を README に記録）<br>・`references/claude-code-runtime.md`: **cc が所有**。Claude 固有の実行指示（下の M1〜M5）を置く<br>改善は codex で先に行い、cc に反映する。handoff・権限・証拠区分についての共通の行動ケースで、意味が一致しているかも確認する |
| 前提作業（codex 側） | ① 自社のプロダクト名・暫定価格・private パスを汎用化する（公開リポジトリの規約）<br>② assets と references に残る `$skill` 記法を、中立的な表現にする<br>codex 0.3.1 でこの2点を済ませてから取り込む |
| frontmatter | `name` と `description`（日本語のトリガー語付き）だけにする。model・effort・`disable-model-invocation` は付けない。対話型のスキルで、自動で発火することに価値があるため |
| Claude 固有（`claude-code-runtime.md`） | **M1** 相互参照を `indie-product-marketing:<skill>` に書き換える<br>**M2** Web の証拠。WebFetch は小型モデルの要約を返すので、数値・引用・価格・規約は生のソースで照合し、できなければ台帳に「要約経由・未照合」と書く。WebSearch は US-only なので、日本市場は既知の一次 URL を直接取得する<br>**M3** 外部アクションの境界。出稿、投稿や DM、掲載、メール、課金、デプロイや DNS、Artifact の公開は、明示の指示があるときだけ行う。一括や自動の操作は、指示があっても行わない<br>**M4** 文脈の隔離。独立した発散パスは別々のサブエージェントで走らせ、互いの候補を見せない。採点は、正規化したカードと台帳だけを渡した新しい文脈で行う。同じモデルによる採点は順位付けの補助であり、市場の事実の認定ではない<br>**M5** LP の検証。`dev-core:verify` とブラウザ MCP で、複数の画面幅、キーボード操作、言語切り替えを確かめる。確かめられなければ「未検証」と書く |
| dev-core への接続 | 検証済みのコンセプト（validation-handoff）を `/dev-core:task` に渡し、MVP の計画を作る経路を明記する |
| design-core との境界 | ・主担当は global-landing-design。ui-ux-pro-max と frontend-design はスタイル参照の補助、design-core は審査とトークンの確定を担う<br>・**design-review の本文の修正が必要**。WCAG の最低ラインで `lang="ja"` を必須にしている（`design-review/SKILL.md:115`）。これだと英語の LP の正しい `lang="en"` が Must 違反になる。「ページの実際の言語と一致する `lang`」に改め、言語切り替え・部分的な言語指定・RTL を扱う。英語と日本語の LP を design-review に渡す統合ケースを追加する<br>・法規の深い論点は compliance-core に任せる |
| evals | 汎用化した validator で、次を入れる<br>・landing の9ケース<br>・3スキル × トリガーの正例と負例（ui-ux-pro-max、pm 系、design-core との競合を含む） |
| 後続（v0.2） | 読み取り専用の証拠収集 agent を追加する（effort は測定後に決める）。発散と採点の Workflow スクリプトは、創業者との対話入力が必要なので見送る |
| リリース条件 | 1. validator 一式が通る<br>2. コピーが同期元と一致する<br>3. インストール後の新しいセッションで、スキル一覧に表示される<br>4. 追加した契約（証拠の照合、外部アクションの境界、文脈の隔離）を代表する行動ケースを実際に実行し、観測した行動と判定を記録する。スキーマが通ることで代替しない |

---

## 6. 他のプラグイン

| プラグイン | 変更 |
|---|---|
| **hotl-engineering（最優先、2.0.0）** | **導入手順の本文**<br>cc の Step 4 は、次のように既存の保護を弱める指示になっている（`hotl-engineering/SKILL.md:67-72`）。<br>・security 層は `continue-on-error: true`<br>・branch protection は「PR 必須 ＋ force push 禁止」のみ<br>・2週間後に強制化<br>codex 06afa51 の方針に揃える。既存の blocking check・branch protection・must-pass は維持し、観測期間を設けるのは新しい advisory / AI check だけにする。昇格の条件も、経過日数ではなく「代表的な実行結果・責任者・無効化の手段」にする<br><br>**テンプレートの欠陥**（06afa51 で修正済み。一体で翻案して移植する）<br>・`ai-review.yml`: verdict の欠落や不正な JSON を「0件」と解釈し、レビュー対象の SHA を確認しない<br>・`eval-gate.yml`: 共有 staging で評価し、候補のリビジョンを照合しない。baseline の取得失敗を許容する。候補側の thresholds を使う。候補の checkout 内のレポートを公開する<br>・`run_evals.py`: target の失敗が集計から抜け落ちる。temperature と max_tokens は、モデルが受け付けるときだけ送る<br>・`deploy.yml`: rollback が traffic routing を復元しない<br>・`agent-implement.yml`: `author_association` だけで特権 job を起動する<br>併せて、trusted base に置く `check_review_verdicts.py`、ADJUST.md の適用要件、回帰テスト（verdict が不正・欠落・別 SHA のとき、権限の判定、復旧アダプタが無いとき、候補から隔離した成果物）も移植する<br><br>**2449cee の適用範囲の改訂**（必要なテンプレートだけを適用する、既存の必須チェックを維持する、限定的な変更には承認点を増やさない）も取り込む<br><br>**受け入れ条件**: 既存の required checks を持つプロジェクトに導入しても、保護が弱まらないこと。trusted base への checker の設置は enforcement より先に行う。クラウドで実際に復旧できるかどうかは、別の受け入れ条件にする |
| **github-tools（2.1.0、dev-core 5.0.0 より先に出す）** | pr の quality-checker への依存を外す。dev-core があれば verify を使い、なければコマンドを直接実行する<br>codex 06afa51 の PR 改訂を翻案する<br>・本文は body file で渡す<br>・draft を元に戻せる既定にする<br>・レビュー済みの diff と最終 diff が一致するか確認する<br>・未コミットの作業を保全する<br>・本文だけを頼まれたときは PR を作成しない<br>・未確認の Issue に `Closes` を付けない<br>README の quality-checker の記述（`README.md:48`）も直す |
| design-core（0.2.x） | design-review の `lang` 規定を直す（5 節）。global-landing-design との分担を description に書く |
| ai-engineering | 4.4 のとおり |
| ui-ux-pro-max | サードパーティ由来。codex 側は整理済み（1.3.0）。上流に合わせるかどうかは別件とし、優先度は低い |
| marketplace.json | トップレベルの version（4.3.0）が古い。ルートの README と AGENTS.md の構成表に、未掲載の4プラグインと indie を追加する |

---

## 7. codex-plugins との同期

**移植台帳を作ります。** 前回の同期点（multi-stack-support、08-20）以降に codex に入ったコミットを、挙動・対象ファイル・検証条件の単位に分けて、移す／置き換える／移さない／保留のいずれかに分類します。

| コミット | 主な内容 | cc での扱い |
|---|---|---|
| 06afa51 | HOTL・PR の修復、比例的な検証と完了判定（verification-loop の決定的ランナーを含む） | 6 節（hotl 2.0.0、github-tools 2.1.0）、4.4 の verify |
| 4839077 / 18f1283 / 7b18944 | ロール別の実行とモデル値の変遷 | 考え方だけを移す（3 節）。値は移さない |
| b07bbad | 知識層の固定ルール・不要な承認・過剰な手順の見直し、スキル説明の短縮 | 4.4 と知識層の streamline |
| 2449cee | HOTL と indie の適用範囲、既存権限の再利用 | 6 節、5 節 |
| ae15ebc | 所有者とレビューの分離、証拠の再利用、同じ経路での Three Strikes | 4.1、4.4、4.5 |
| 321e032 | preset の適用条件、前提が崩れたときの返却、明示設定の保持 | 3.2、4.1 |
| d17d0ab / 9240d5b | indie の追加と LP スキル | 5 節 |

**正本の向き**
- dev-core の知識スキルと hotl は、現行ルールどおり cc（日本語）を正本とします。今回は「codex で先に育った思想を、一度 cc に取り込み直す」作業として扱い、以後は cc で改善してから codex に翻案します。
- indie だけは 5 節の分担（codex が正本、一方向）とし、両方の AGENTS.md の兄弟リポジトリ節に明記します。

**Codex 側の後続作業**
- indie 0.3.1（汎用化と `$skill` の中立化）
- AGENTS.md に分担を追記する
- 再インストールし、新しいスレッドで確かめる

---

## 8. ロールアウト

| Phase | 内容 | 完了条件 |
|---|---|---|
| **A-0** | hotl-engineering 2.0.0（6 節） | 既存の必須チェックを弱めない導入ケースと、失敗系の回帰テストが通る |
| **A-1** | 1. validator と CI（最初は警告で入れる）<br>2. プロンプトの衛生（proactive・ultrathink・whenToUse・語調）<br>3. effort の固定（実行系は medium、レビュアーは high）<br>4. github-tools 2.1.0（quality-checker への依存を外す） | 検証コマンド一式が通る。固定した effort が transcript の実効値と一致する。変更した契約を代表する行動ケースを実行し、記録する |
| **A-2** | dev-core 5.0.0<br>1. トポロジーの変更（4.1〜4.4）<br>2. agent 5体（quality-checker・issue-creator・doc-updater・architecture-guide・task-planner）と task-team の廃止<br>3. Agent 表記への移行<br>4. 移行ノート（github-tools 2.1.0 以上が前提であることを明記） | 廃止した agent と workflow への現役の参照が0件（validator で検査）。代表的な行動ケースで spawn 数が減り、合格率が下がらない |
| **B** | codex の indie 0.3.1 → cc の indie 0.1.0、design-core の `lang` 修正 | 5 節のリリース条件 |
| **C** | 測定（9 節）。レビュアーの effort、low の段、継続ガードを判断する | 固定するすべての effort に eval ケースと計測日が紐づいている |
| **D（任意）** | Workflow スクリプト（`debug-hypotheses` など）、indie v0.2 | 親のみ・既存構成と比べて、品質が同等以上でコストが下がる |

**A-2 で同時に直す参照元**（現役の指示と一覧）

| ファイル | 行 | 参照しているもの |
|---|---|---|
| `dev-core/workflows/execute/SKILL.md` | 6, 38, 64 | quality-checker |
| `dev-core/workflows/refactor/SKILL.md` | 6, 69, 76, 197, 199, 277 | quality-checker |
| `dev-core/workflows/task/SKILL.md` | 6, 46, 70 | task-planner、issue-creator |
| `dev-core/agents/code-reviewer.md` | 15 | quality-checker |
| `dev-core/skills/issue-driven-dev/SKILL.md` と `AGENTS.md` | 3, 12 と 43 | 「task-planner / issue-creator の知識正本」。知識層なので codex にも反映する |
| `dev-core/skills/codex-collab/SKILL.md` | 67 | Zero Trust Review の正本の移動 |
| `hotl-engineering/docs/trigger-boundaries.md` | 11, 14, 22, 28 | task-team、code-review の発火境界 |
| `dev-core/README.md` | 55, 69, 71, 75, 76, 78, 115 | workflow と agent の一覧、設定の説明 |
| `github-tools/README.md` | 48 | quality-checker |

- task-team の workflow 自体（121〜148行の参照）は、廃止とともに消えます。
- `scripts/validate-skill-evals.mjs` の必須ケースは task / execute / tdd / refactor / debug-team で、task-team は含まれていません。そのため、廃止しても validator は落ちません。

**実装時に確かめること**
- allowed-tools の `Agent(…)` / `Task(…)` の表記が、事前許可として効くか
- skill 本文の `${CLAUDE_EFFORT}` が置換されるか
- ultracode で `/effort medium` にしたとき、dynamic workflows がどうなるか
- バックグラウンドで起動した agent に frontmatter の effort が効くか
- Workflow の `agent({agentType, effort})` と agent の frontmatter のどちらが優先されるか
- `isolation: worktree` の base ref（feature branch の状態が見えるか）
- 1M context に関する起動失敗が現行でも再現するか

---

## 9. 測定計画

- **比較の単位**: 一度に変える変数は1つだけにします。
  - 基準: 現行の 4.4.0
  - 構成: 「親のみ」「親 ＋ ゲートでのレビュー」「委譲」
  - effort の比較
    - 委譲した実装: medium と high
    - build-error-resolver: medium と low（本文を狭めた版）
    - レビュアー: high と medium
  - 必須レビューの対象になる fixture（migration など）では、「親のみ」の構成は採用候補にしません。
- **fixture**（公開できる汎用のもの）
  - docs の変更
  - 1ファイルのバグ修正
  - 密結合な3段階の機能
  - 独立した2つのモジュール
  - migration
  - 機械的な一括改名
  - 依存を更新した後のビルド破損
  - 仮説が複数ある flaky バグ

  このうち一部には、仕込んだバグを入れます（権限、migration、並行性、契約の破壊）。
- **指標**
  - 品質
    - 隠しテストの合格率（grader は作業者と分ける）
    - 偽完了率（satisfied と主張したのに、再実行すると失敗するもの）
    - 仕込んだバグの検出と誤検知
    - 手戻りの回数
  - コスト
    - タスク完了あたりの費用（子の分も含める）
    - キャッシュ読み込みの比率
    - 経過時間
    - spawn の数
  - 挙動
    - 要求した effort と実効 effort が一致しているか
    - テキストだけの end_turn の件数
- **判定**
  - 試行数が少ないので、事前に離散的な条件で宣言します。例: 「仕込んだ P0 の見逃しが増えない」「偽完了が増えない」。
  - 記録するもの: revision、fixture、実効設定、観測した行動、成果物、判定。
- **予算**
  - 総予算の上限と、方向がはっきりしたら打ち切るルールを先に決めます。
  - 最小のセット（2つの fixture × 3つの構成）から始めます。
- **実行環境**: 個人設定の影響を避けるため、分離した設定ディレクトリで実行します。

---

## 10. リスクと判断事項

| リスク | 緩和策 |
|---|---|
| 親が実装すると、長い計画では文脈が膨らむ | plan を永続化して、再開できるようにする。文脈を隔離する利得が具体的にあるときだけ委譲する |
| バッチごとのレビューをやめると、見逃しが増える | リスクゲートのレビューを high に固定する。最終ゲートで実行証拠を確認する。偽完了率と仕込んだバグで監視し、悪化したらゲートを広げる |
| 固定した effort は、ユーザーが上書きできない。上げる方向にも下げる方向にも効き、ultracode ではレビュアーが high に抑えられる | 固定は5体に限る。allowlist と理由を必須にする。逃げ道（`CLAUDE_CODE_EFFORT_LEVEL`、`maxEffortLevel`）を README に書く |
| medium が既定だと「賢くない」と感じられるおそれ（F15 の前例） | 親の effort は固定しない。README で「計画は high 以上」と案内する。レビューは high |
| プラグインのバージョンが混在する（dev-core 5.0.0 ＋ github-tools 2.0.0） | github-tools 2.1.0 を先に出す。対応するバージョンと更新順を移行ノートに書く |
| Opus 5.5 は出たばかりで、推奨が更新される可能性がある | changelog と公式ガイドの更新を再評価のきっかけにする。固定した値には計測日を持たせる |
| バイナリから読んだ挙動が、バージョンによって変わる | 最小バージョン（2.1.280）を明記する。実装時に再確認する |

**既定のまま進める点**
- dev-core 5.0.0 での agent と workflow の廃止は、移行ノートを付けて行います（git で戻せます）。

**ユーザーの判断が必要な点**
- indie の公開データ: 自社のプロダクト名と暫定価格を、codex 側でも汎用化して push してよいか（既定は汎用化）。汎用化しても、git の履歴には残ります。

---

## 付録: 主な出典

- Anthropic, Claude Opus 5.5 発表: https://www.anthropic.com/claude-opus-5-5
- What's new in Claude Opus 5.5: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5
- Effort: https://platform.claude.com/docs/en/build-with-claude/effort
- Prompting Claude Opus 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- Prompting Claude Opus 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- Optimizing for cost and intelligence: https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- Harness design for long-running apps: https://www.anthropic.com/engineering/harness-design-long-running-apps
- April 23 postmortem: https://www.anthropic.com/engineering/april-23-postmortem
- Claude Code docs（sub-agents / skills / model-config / workflows / plugins-reference / prompt-caching / advisor / changelog）: https://code.claude.com/docs/en/
- GitHub issues: anthropics/claude-code #72596, #79866, #85416, #82259, #83920
- 二次情報: CodeRabbit「Opus 5.5 model review」（2026-09-22）、obra/superpowers の subagent-driven-development
- codex-plugins:
  - `docs/plans/task-*.md`
  - `docs/research/gpt-6-sol-luna-model-routing.md`
  - `plugins/dev-core/skills/codex-collab/references/planned-execution.md`
  - `plugins/dev-core/skills/dev-workflow/references/orchestration.md`
  - `plugins/hotl-engineering/skills/hotl-engineering/SKILL.md`
  - `scripts/tests/test_hotl_gates.py`
