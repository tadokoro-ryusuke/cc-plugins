# スキル・プラグイン鮮度監査（2026-10）

- 調査日: 2026-10-25（対象 commit `e174251`、Claude Code 2.1.310）
- 状態: 改善候補を洗い出し、優先順位を付けた。
  - 2026-10-25 追記: ui-ux-pro-max を cc-plugins から削除した（公式プラグインを使う方針）。
  - B0（P0）は feature/freshness-b0 ブランチで実装した（未コミット）。それ以外は未着手。
- 範囲: マーケットプレイスの全プラグイン（スキル、agent、hook、検証器、CI、配布テンプレート）。
- 候補ごとの詳細（現状、検証後の提案、一次ソース、ミラーへの影響）は作者のローカルにだけ置き、git では管理しない。
  - `.claude/audit/skill-freshness-audit-2026-10-ledger.md`
  - `.claude/audit/skill-freshness-audit-2026-10.json`
  - 優先度は本書と台帳が正本。JSON は検証エージェントの生の出力で、§3 の上書き（C03、C24、C18、C56、C85）を反映していない。

## 1. 要約

内部の棚卸しと外部調査を突き合わせて、改善候補を 91 件に整理した。

- 内部の棚卸しは、全プラグインのスキル、agent、hook、検証器、CI が対象。
- 外部調査は 8 観点で、参照したソースは約 290 件（一次と二次の両方を含む）。
- 各候補について、次の 3 方向から反証を試みた。
  - 内部のファイル
  - 一次ソース
  - 過去の設計判断

結果は次のとおり。

- **採用 88 件**
- **棄却・不要 3 件**: 検証で棄却した 2 件（C31、C89）と、ui-ux-pro-max の削除で不要になった C36。
- **優先度別**: P0 が 3 件、P1 が 29 件、P2 が 47 件、P3 が 9 件。Codex の独立レビューと、ui-ux-pro-max の削除を反映した後の値。
- **束**: 同じファイルや同じ論点に触れる候補を、PR の単位で 16 の束にまとめた（§7）。
- **追加の論点**: 網羅性の批評、Codex のレビュー、スキルのカルテから 8 つ足した（§5）。
- **取り入れない実践**: 人気スキルや GitHub の動向から、68 件を「取り入れない」と判断した（§8）。

### 最優先の 3 件（P0）

どれも、配布しているものが壊れているか、宣言と実装が食い違っているもの。

1. **C03 hotl の eval-gate テンプレートが壊れている。**
   - 原因: anthropic SDK の版を固定せずに install している。さらに、SDK 1.0.0（2026-08-20）で消えた sampling 引数を送っている。
   - 影響: judge の呼び出しが `TypeError` で落ち、fail-closed のゲートが常にブロックする。ランナーが毎回最新の SDK を入れるので、テンプレートのまま使っている適用先では、2026-08-20 以降のすべての実行がこの状態。
   - 本統合で再現した（§3、§4）。
2. **C04 hotl の incident-triage テンプレートは「Read-Only」と宣言しているのに、書き込みができる。**
   - 外部 webhook から来た payload を、そのまま prompt に展開している。
3. **C02 ui-ux-pro-max に、上流の MIT LICENSE の原文を同梱していない。**
   - cc-plugins では、プラグインごと削除して解消した。codex-plugins 側に残すなら、まだ必要。

### テスト（依頼の中心）で効果の大きい順

1. **テストの完全性（B2）**
   - テストを弱めて通すこと（テストの削除、skip/only、期待値の緩和）を禁止する。
   - 仕様とテストが矛盾したら、止めて返す。この出口を正本に書く。
   - テストを弱めたことを、verify と Stop フックで決定的に検出する。
   - 単独の `/dev-core:tdd` でも、完了の前に全体のテストを 1 回実行する（C16）。
   - flaky テストの隔離に、承認・期限・重要経路の代替カバレッジの規則を付ける（C56）。現状の cc 版は「即隔離して CI から外す」だけで、無許可の skip と区別できない。codex 版には規則がある。
2. **テスト知識の正本化（B3）**
   - 現状: test-design:153 は「テストコードの書き方」を best-practices に委ねている。しかし best-practices にあるのは TDD の手順で、具体的な書き方（AAA、期待値を実装から独立に導くこと、テストダブルなど）は、Claude 専用の agent 定義にしか無い。
   - 対応: `best-practices/references/testing.md` を新設し、次の 3 点を置く。
     - テストダブルの優先順位
     - 実際の依存を使う integration テストの既定
     - unit の定義
3. **E2E（B5）**
   - e2e-runner は data-testid を無条件で最優先にしている。Playwright 公式は、role や label などユーザーに見える属性を既定にするよう勧めており、test id は明示的に合意したテスト契約として使う位置づけ。避けるべきは CSS や XPath。
4. **技法（B4）**
   - ミューテーションテストを運用手順にする。
   - PBT を加える。
   - flaky テストの扱いを決める。
   - E2E の新しい手法を取り込む。

ただし、これらには前提がある。作者の環境ではスキル一覧の予算が足りず、test-design を含む設計系スキルの description が落ちて、名前だけが表示されている。テストの中身を厚くする前に、実際のインストール構成で発火を測る（C18、§5-1）。

## 2. 方法と限界

### 方法

1. **内部の棚卸し**: 7 クラスタに分けた。
   - テスト軸 1: 利用者に勧めるテスト
   - テスト軸 2: このリポジトリ自身の検証
   - dev-core の実行ワークフロー、agent、hook
   - dev-core の設計知識（アプリ寄り）
   - dev-core の設計知識（運用、セキュリティ、インフラ寄り）
   - デザイン・UI 系
   - その他のプラグイン
2. **外部調査**: 8 観点。
   - ponytail v5.3.2 の精読
   - impeccable skill-v4.7.1 と、2026 年のデザイン系スキル
   - GitHub の動向
   - 2026-07-14 の前回調査で使ったソースのその後の差分
   - 公式仕様と Claude Code の新機能
   - テストのベストプラクティス
   - テスト以外の開発のベストプラクティス
   - 同居しているプラグインとの衝突
3. **ギャップ分析**: 6 テーマで行い、重複をまとめて 91 候補にした。
4. **反証検証**: 候補ごとに、次の 3 レンズで検証した。そのうえで、網羅性の批評を 1 回行った。
   - 内部ファイル
   - 一次ソース
   - 過去判断（`docs/research/autonomous-development-workflows.md` の「導入しないもの」と、`opus-5-5-plugin-strategy.md`）
5. **裏取り**: 本統合で、主張の一部を自分で確かめた（§3）。

### 限界

- **外部の数値**: 外部プロジェクトの効果の数値（ベンチマーク、star 数）は自己申告なので、採否の根拠にしていない。
- **発火と利用の観測**: 作者の 1 台で、直近 30 日分だけを見た。数えたのは Skill ツール経由の起動だけで、スラッシュ起動は数えていない。
- **未実行の検査**: shellcheck、actionlint、zizmor はローカルに導入されておらず、実行していない（§5-4）。
- **未監査のファイル**: どの候補の対象にもならなかったファイルがある（§9）。
- **カットオフ後の事実**: 法令や規格の版は、検証エージェントが 2026-10-25 に大半を一次ソースで確かめた。ただし一部は二次ソースでしか確かめていない（例: EU AI Act の高リスク義務の延期日付。C53 の台帳に明記）。反映するときは、本文に出典 URL、確認日、確認の状態を書く（§7 の表の注記を参照）。P0・P1 の主な一次ソースは §11 に載せた。
- **バイナリ依存の事実**: Claude Code の挙動の一部（圧縮後にスキルを再添付するときの上限など）は、2.1.310 のバイナリから読み取った。版が変わったら再評価が必要。

## 3. 本統合での裏取りと優先度の変更

| ID | 変更 | 根拠 |
|---|---|---|
| C03 | P1 → P0 | 使い捨ての venv に `anthropic[bedrock]==2.3.0` を入れ、既定構成と同じ引数で `messages.create` を呼んだ。ネットワークに出る前に `TypeError: Messages.create() got an unexpected keyword argument 'temperature'` で落ちた。<br>既定構成とは次の 3 点。<br>・judge の既定が Sonnet 4.5（`run_evals.py:37-38`）<br>・`thresholds.json:19` が `"temperature": 0`<br>・`run_evals.py` の許可リストが Sonnet 4.5 に一致する<br>2.3.0 の `messages.py` には `temperature` も `**kwargs` も無い。`eval-gate.yml:99` は版を固定していないので、新しくテンプレートを適用した利用者は全員この状態になる。codex-plugins 側の `eval-gate.yml:102` も同じく固定していない。批評の「失敗は再現されていない」という指摘は退ける。 |
| C04 | P0 のまま、根拠を追加 | `incident-triage.yml:75` は `${{ toJSON(github.event.client_payload \|\| inputs) }}` を `with: prompt:` の中で直接展開している。`run:` の中ではないので、Actions のスクリプト注入ではなくプロンプト注入にあたる。<br>同じステップの `--allowedTools` には `Bash(gh api:*)` がある。さらに `github_token` を渡していないので、書き込みできる Claude App トークン（Contents、Issues、PR が R&W）がそのまま使われる。 |
| C24 | P0 → P1。C01 と統合 | 「100%強制」などの文言を正す変更で、実害は無い。 |
| C18 | P2 → P1 | 発火の実測を、テスト内容の改善の前提条件にするため（§5-1）。 |
| C56 | P2 → P1。B4 から B2 へ移動 | Codex レビューの指摘を確かめた。cc の `test-design/SKILL.md:130` は「即隔離し、直すまで CI から外す」とだけ書き、承認・期限・代替カバレッジの規則が無い。codex 版の test-design（:69 付近）には owner、expiry、追跡、重要経路の代替カバレッジがある。C07 で skip を検出するなら、承認済みの quarantine と無許可の弱体化を先に区別しておく必要がある。 |
| C85 | P3 → P2 | Codex レビューの指摘を確かめた。`dev-core/evals/skill-behavior-cases.json` の 23 件に、test-design、best-practices、e2e のケースは無い。規則と同じ PR で行動ケースを足すことを、B2・B3・B5 の受入条件に前倒しする（live 実行は任意。未実行なら未実行と書く）。 |
| C03 | 原因を訂正 | B0 の実装中に、ネットワークなしの契約テストで分かった。sampling 引数は SDK 2.0.0 ではなく 1.0.0（2026-08-20）で消えていて、1.17.0 でも `temperature` を渡すと TypeError になる（PyPI の各版で確認: 0.125.0 にはあり、1.0.0 以降には無い）。「`<2` に固定する」だけでは直らない。sampling を送らないことと、版の固定の両方が必要。 |
| C36 | 不要 | ui-ux-pro-max を cc-plugins から削除したため（ユーザーの判断。公式プラグインを使う）。 |
| 新規 | P1 を追加（§5-7） | hotl の ci.yml にあるカバレッジゲートの誤記。検証エージェントが「別候補 P1」と書いていたのに、本文から漏れていた（Codex レビューで発見）。 |
| C31 | 棄却を維持 | 圧縮後の再添付の上限は「5,000 tokens」とされているが、2.1.310 の実装は文字数を 4 で割って数え、約 2 万字で切る。日本語で 7〜8k 字の SKILL.md は全文が残る。残るリスクは SKILL.md が 2 万字に近づくことだけで、文字数のガード（P3、任意）で足りる。 |
| — | 対応済み | 批評は作者の auto-memory の古さも指摘していた（Agent ツールの effort 引数、PR のマージ状態）。これはこのセッションで更新済み（リポジトリの外）。 |

## 4. 最優先（P0）の詳細

### C03 hotl の eval-gate テンプレートが SDK 1.0.0 以降で壊れている

- **現状**:
  - `eval-gate.yml:99` は `pip install "anthropic[bedrock]" boto3` で、版を固定していない。
  - judge は既定で旧世代の Sonnet 4.5 を使い、temperature を送る。
  - SDK 1.0.0（2026-08-20）以降、`messages.create` は sampling 引数を受け付けない。ランナーは毎回最新の SDK を入れるので、テンプレートのまま使っている適用先では、それ以降のすべての実行が失敗している。
  - codex-plugins の hotl も同じ状態。codex の main は 2.0.1 で、temperature を送る方式の PR #8 は未マージ。ミラーは #8 を置き換える codex 2.0.2 として出す。
- **即時の修正**（hotl 2.0.2。feature/freshness-b0 で実装済み、未コミット）:
  - judge には sampling 引数を送らない。thresholds.json に残っていても無視し、実行ログに出す。
  - SDK を `anthropic[bedrock]>=1.17,<2` に固定する。1.x は API 版 `bedrock-2023-05-31` を送り、旧世代の judge でも動く。Bedrock の legacy ページにある「pin that version」に従う。
  - judge で例外が起きたら、型名だけでなくメッセージの先頭も出す。
- **恒久対応**（次の minor 版、BREAKING）:
  - SDK を 2.x にし、Claude in Amazon Bedrock（4.7 以降、bedrock-mantle、sampling なし）へ移る。
  - JUDGE_MODEL は既定値を持たない必須の変数にする。
  - sampling を送る処理と、それを検証するテストを撤去する。
- **回帰テスト**（同じ PR）:
  - 現状の `scripts/tests/test_hotl_gates.py:21` は SDK 全体をスタブにしていて、`create` も `Mock` なので、実際の SDK の引数の契約を検査できない。今回の破損も、このテストでは検出できなかった。
  - 対策: workflow が導入するのと同じ版の SDK を使い、ネットワークに出ずに `messages.create` の引数とシリアライズを検証する契約テストを足す。
  - 実装した契約テスト（`scripts/tests/test_hotl_sdk_contract.py`）は、SDK の HTTP 層を MockTransport に差し替え、judge の呼び出し経路をスタブなしで通す。API 版も検査する。
  - 3 通りの組み合わせで効き目を確かめた。
    - 固定した版の SDK と修正後の runner: 通る。
    - SDK 2.3.0: API 版の検査で落ちる。
    - 修正前の runner と SDK 1.17: TypeError で落ちる。
- **ミラー**: codex-plugins の hotl も同じ状態なので、同時に直す。
- **優先度の表し方**: これはセキュリティ事故ではなく、可用性の破損（ゲートが常に閉じる）である。P0 としたのは、修正が小さいわりに、テンプレートを新しく適用した利用者全員が影響を受けるため。

### C04 incident-triage の「Read-Only」宣言と実装の食い違い

- **現状**: §3 の表のとおり。
- **状況**: feature/freshness-b0 で次を実装済み（未コミット）。
  - 1〜5 と、6 のうち `--tools` による利用可能ツールの絞り込み、`--disallowedTools` による編集系ツールの禁止。
- **B0 の Codex レビュー（NO-GO）で見つかり、同じブランチで直したもの**:
  - Issue 本文に execution file（ツール出力を含む実行ログ全体）を投稿していた（2.0.1 以前からの問題）。最終回答だけを取り出して投稿するようにした。
  - 要約が無いときに、フォールバックの手前で終了していた。
  - `az monitor:*` と `az webapp log:*` は変更系サブコマンドも通す。具体的な読み取り系コマンドに絞った。
- **未確認**: 6 の実際の挙動（action の中で編集や書き込みが拒否されること）は、Bedrock の認証情報を持つサンドボックスのリポジトリでしか確かめられない。
- **修正**:
  1. `--allowedTools` から `Bash(gh api:*)` を外す。調査手順 4 は `gh pr list` と `gh run list` で足りる。
  2. triage job の permissions を read に絞り、claude-code-action に `github_token: ${{ github.token }}` を明示する。Issue の作成と通知は、`needs: triage` の別 job（`issues: write` だけ）に分ける。
  3. payload は、非信頼データと分かる区切りを付けて渡す。ただしこれは多層防御の 1 層にすぎない。安全性の根拠は、1 と 2 で状態を変える経路を断つことにある。
  4. ヘッダに書いたガードレールの説明を、実装に合わせる。
  5. `scripts/tests/test_workflows.py` に、次の 2 点を確かめるテストを足す。
     - 書き込み系のツールが無いこと
     - write 権限が id-token だけであること
  6. 「GitHub に書き込めない」ことと「ローカルを含めて Read-Only である」ことを区別して書く（Codex レビューの指摘）。
     - claude-code-action はファイルの編集機能を持っており、allowedTools の許可リストを見るだけでは、編集ができないことの証明にならない。
     - 実効ツール、permission mode、明示的な deny（disallowedTools）を確かめ、宣言をどちらの意味にするかを決める。
     - 受入条件に、注入した payload からファイルの変更や書き込み API の呼び出しを試みても拒否されることを入れる。
     - この挙動は本監査では追試していない。
- **ミラー**: codex-plugins の incident-triage.yml にも翻案して反映する。

### C02 ui-ux-pro-max の LICENSE 同梱と来歴

- **現状**: 上流（MIT、Copyright (c) 2024 Next Level Builder）の LICENSE 原文が、プラグインのディレクトリに無い。
- **修正**:
  - 上流の 93a4b061 にある LICENSE を、プラグインのディレクトリに置く。
  - plugin.json に `license` を書く。
  - README に来歴を書く。内容は次の 3 点。
    - 取り込んだ上流のコミット
    - 上流が CC BY-NC 4.0 から MIT に変わった後に取り込んだこと
    - ローカルでの改変
  - codex-plugins 側も同じように直す。

## 5. 批評を受けて追加した論点

### 5-1. スキルが届いているかを先に測る（P1。C18 と同じ束）

- **事実**: 作者の環境は多数のプラグインを同時に有効にしていて、スキル一覧の文字予算を超えている。その結果、次のスキルは名前だけで表示されている（2026-10-25 のセッションで確認）。
  - dev-core の test-design、cicd-release-design などの設計系スキル
  - design-core、delivery-core、ai-engineering、compliance-core の全スキル
  - hotl-engineering
- **起動の観測**: 直近 30 日・1 台の Skill ツール経由の起動は、best-practices が大半だった。test-design や debug の自動起動は観測されなかった（スラッシュ起動は数えていない）。
- **意味**: description が落ちたスキルは、自動では選ばれにくい。B3 や B4 でテストの中身を厚くしても、スキルが届かなければ効かない。
- **進め方**:
  1. 実際のインストール構成で、near-miss を含むトリガーケースを plugin eval で流し、どのスキルが発火したかを記録する（C18）。ケースの例は「テスト観点表を作って」「このバグを調べて」「TDD で実装して」。
  2. 発火しないと分かったら、B3・B4 より先に、description の短縮（C30）と best-practices からの索引（C73）を入れる。
  3. 利用者側の対処（使わないプラグインを無効にする）は、ルート README の常時コストのガイド（C35）に書く。

### 5-2. 統合・縮退・廃止を判定する（P2）

候補はほぼすべて追加か修正で、減らす方向の判断が無い。

- **やること**: 次の 3 つを 1 表にまとめ、スキルごとに「維持・統合・縮退・廃止」を判定する。
  - 利用回数
  - `/skill-doctor` の結果
  - `claude plugin details` で見る常時コスト
- **個別に判定を記録するもの**（最低限）:
  - ui-ux-pro-max: **判定済み（2026-10-25）**。cc-plugins から削除し、上流の公式プラグインを使う。ただし公式版は複数の生成系スキルを同梱し、design-core と発火が重なりうる。codex-plugins 側の扱いは未定。
  - github-tools:docs: 26 行で、未監査
  - 設計系 13 スキル: 統合できるか
  - 組み込みと重なる 3 件: /verify、/security-review、/code-review
- **見送りとの関係**: §8 には「/skill-doctor の利用統計を作者側の品質指標にする」という見送りがある。ただし主な利用者は作者自身なので、統廃合の判断材料としては使う。見送るのは、品質指標として常用することだけ。

### 5-3. テストの種類の空白（P2）

リポジトリ全体（`docs/research` を除く）を grep すると、fuzz、Testcontainers、DAST、Pact（consumer-driven contract）、terraform test はどれも 0 件だった。契約テストだけは interface-contract-design に記述がある。

候補にするときは、設計判断を test-design に、手順を該当するスキルに置く。

| 種類 | 置き場所 | 書く内容 |
|---|---|---|
| fuzz | test-design（PBT の C55 と同じ節） | パーサ、デシリアライザ、金額計算に限った条件付きの指針 |
| DB マイグレーションのテスト | data-design-ops | expand-contract 期間中の旧コードと新スキーマの互換、up/down、本番相当データでの適用リハーサル |
| IaC のテスト | cloud-infra-network-design | terraform test と、plan 差分のポリシー検査 |
| DAST | security-by-design の検証段 | ステージング環境での動的検査（条件付き） |
| 性能 | test-design の観点表 | 「性能」列から、ops-design-handover の負荷試験（k6）へのポインタ |
| 実依存の integration | best-practices（C10） | 具体的な手段の例（Testcontainers など） |

### 5-4. このリポジトリ自身の静的検査（P2）

- **dev-core/scripts**: 4 本のうち CI でテストしているのは、session-start のスモークテストだけ。block と stop-quality-gate のテストは C01 で足す。
- **hotl の Actions テンプレート**: 配布しているのに、YAML の構文解析と、埋め込みコードのオフライン実行（`test_workflows.py`）でしか検査していない。
  - actionlint と zizmor（Actions のセキュリティ lint）で既存の指摘を棚卸しし、hotl-gates に入れるかを決める。
  - shell スクリプトには shellcheck を使う。
- **実行結果**（2026-10-25。インストールせず、zizmor 1.31.1 は uvx、actionlint 1.7.12 と shellcheck 0.10.0 は docker で実行）:
  - zizmor（hotl のテンプレート 6 本とリポジトリの CI 2 本、変更前）: 120 件。
    - error: unpinned-uses 54 件、template-injection 1 件（`eval-gate.yml:114` の `inputs.suite`）、excessive-permissions 1 件（`deploy.yml:32`）
    - warning: artipacked 16 件、excessive-permissions 3 件（`skills-drift-check.yml`）
    - info: template-injection 10 件（`vars.*` や `steps.*` の展開）
  - B0 で template-injection の error と incident-triage の問題は解消した。残りは C47（SHA 固定ほか）で扱う。
  - actionlint: 構文エラーは無い。1.7.7 で出た YAML アンカーのエラーは、1.7.12 では出ない（旧版の誤検知）。shellcheck の指摘が `deploy.yml` に 12 件（SC2086 と SC2034）、`ci.yml` に 1 件ある。
  - shellcheck（`dev-core/scripts/*.sh`、`scripts/*.sh`）: `test-session-start-context.sh:5` の SC1007 の 1 件だけ。
- **CI への組み込み**: 3 つとも版を固定して CI に入れる。最初は警告として扱い、既存の指摘を片付けてから失敗扱いにする（C47 と同じ PR 単位）。

### 5-5. codex-plugins との双方向の同期（P2）

- **規模**: 批評の機械集計では、英語の翻案が必要な知識スキル本文に触れる候補は約 40 件。
- **順序**:
  - cc が正本の dev-core と hotl は、cc を先に直す。
  - indie（C79、C91）は、codex を先に直す。
- **逆輸入**: codex 側で先行している改善がある（2026-07 以降の codex のコミット）。
  - 2449cee: ui-ux-pro-max の縮小 → C36
  - b07bbad: frontend-patterns の条件付き原則 → C45
  - 06afa51: flaky の運用ほか → C56。best-practices、cicd-release-design、continuous-learning も更新している。
  - ae15ebc、7b18944: リスクとコストに応じた委譲と検証
  - モデル固有のルーティング（GPT-6 Sol/Luna、Astra）は対象外。
- **照合**: codex の `docs/research/development-practices-2026-09-05.md` の採否表と本監査の候補を照合し、重複・矛盾・先行済みを判定する。
- **台帳**: C72 のミラー台帳に、「ミラー影響: なし／翻案／逆同期」の列を持たせる。

### 5-6. 2026-01 の取り込みの来歴（P3）

- 2026-01 に追加した agent・command・skills の来歴を、外部の公開コレクションと比べた。比べた範囲では、本文は日本語で独自に書かれていて、翻訳による派生とは判定していない。
- 比較の詳細は、作者のローカル（`.claude/audit/`）に置いた。LICENSE の表示や着想元の記載が要るかは、作者が判断する。

### 5-7. hotl の ci.yml にあるカバレッジゲートの誤記（P1）

- **現状**: `hotl-engineering/skills/hotl-engineering/assets/workflows/ci.yml:128-134` のステップは、名前が「Coverage on changed files (>= 70%)」で、変更ファイルの差分カバレッジを判定するように読める。
  - 実際に使う `ArtiomTr/jest-coverage-report-action@v2` の `threshold` は、全体カバレッジの閾値である。
  - 入力には Jest の report.json を想定する action に、istanbul の `coverage-final.json` を渡している。
  - 「vitest の json-summary 互換」というコメントも誤り。
  - 根拠は、検証エージェントが action の一次ソースで確かめた内容（台帳の C58）と、Codex のレビュー。
- **意味**: 配布しているテンプレートが、テストの品質ゲートについて誤った安心感を与える。テスト知識を足すより先に直す価値がある。
- **修正**: 次のどちらかにする。
  - 差分を実際に判定するツールに置き換え、入力形式との互換を fixture で検証する。
  - ステップ名とコメントを「全体閾値」に直し、vitest の `coverage.thresholds` を使う構成に改める。
- **ミラー**: codex-plugins の同じファイル（:132-140）も直す。
- **状況**: 後者の方法（全体閾値の明示）で、feature/freshness-b0 に実装済み（未コミット）。

### 5-8. スキルのカルテで新たに見つかった問題（P1、実ファイルで確認済み）

監査の後、全71件（スキル、agent、hook、配布テンプレート）を使う側の視点で読み直し、カルテ（`.claude/audit/skill-report-cards-2026-10.md`）を作った。そこで、監査の候補に無かった問題が2件見つかった。

1. **data-design-ops: 本番で `EXPLAIN (ANALYZE)` を使わせうる**
   - `dev-core/skills/data-design-ops/SKILL.md:52` は、インデックス設計の手順の1番目で `EXPLAIN (ANALYZE)` を実行させ、実行環境を限定していない。
   - 同じスキルの `:149` は、本番で AI に許す範囲に「リードオンリー調査（EXPLAIN・統計ビューの参照）」を挙げている。
   - `EXPLAIN ANALYZE` は文を実際に実行するので、UPDATE や DELETE に付けると本番のデータが書き換わる。本番への書き込みを防ぐはずのスキルが、書き込みにつながる手順を示している。
2. **hotl の agent-implement / ai-review: ツールを許可していない**
   - `agent-implement.yml:103` と `ai-review.yml:115,183` の `claude_args` には `--allowedTools` が無い。
   - claude-code-action の configuration.md は「既定では任意の Bash コマンドを実行できない」としている。
   - 自律実装は、プロンプトで指示している「lint / typecheck / test をローカル実行」ができない。AI レビューは、判定ファイル（`$RUNNER_TEMP` 配下）を書けないおそれがあり、強制モードにすると全 PR が通らなくなる。
   - ツールを与えること自体がセキュリティに関わるので、action の agent mode の既定を読んだうえで、最小の付与を設計して Codex のレビューを通す（hotl 2.1.0）。

## 6. 人気スキル・GitHub の動向から取り入れるもの

### ponytail（v5.3.2）

取り入れるもの:

| 実践 | 候補 |
|---|---|
| 「最小の完全な変更」のラダーと、「削らないもの」（検証、セキュリティ、a11y）の線引き | C28（OCP と YAGNI を、新しく足す抽象に限る） |
| エージェントが書いたテストの強さを、変異の注入で測る | C12 |
| diff の外を読む（呼び出し元、呼び出し先、テスト、README） | C27 |
| 返信の最後に「省いたこと、確認していないこと、リスク」を書く | C68 |
| shortcut コメントと台帳 | C88 |
| ルールの文言を変えるときは変更前後を比べる（規模はこのリポジトリに合わせる） | C64 |
| 不変句の canary | C86 |

取り入れないもの:

- 自明な変更にはテストが要らないとするテスト最小主義。dev-core の Iron Law と衝突する。
- SessionStart で codebase map を常に注入すること。
- band（端末に表示する mod）。
- 3 アーム × 多数 run のベンチマークを必須にすること。
- rule-id の埋め込み。

ponytail の数値は、すべて作者の自己申告である。

### impeccable（skill-v4.7.1）

取り入れるもの:

| 実践 | 候補 |
|---|---|
| 根拠付きの AI slop カタログ。ban と default を分け、画面のモード（Persuade / Operate / Read / Experience）で適用範囲を切り替える | C39 |
| 決定的な検出と LLM の判断を分け、検出はテスト付きの scripts にする | C40 |
| レンダリングを取得し、表示条件ごとに審査する | C41 |
| 審査記録を残し、再審査は取り直した証拠で判定する | C75 |
| 確定したトークンの所在を、リポジトリの固定ファイルに残す。DESIGN.md は alpha 仕様なので、任意の形式の 1 つにとどめる | C77 |

取り入れないもの:

- GitHub Releases から取得した静的バイナリをフックで実行すること。
- overused-font の一律禁止。業務画面で Inter + Noto Sans JP を既定にする方針と衝突する。
- 乱数で方向性を配る仕組み。
- 英語の文体についての slop ルール。
- すべての指示行への rule-id。
- DESIGN.md の必須化。

### GitHub の動向（superpowers、mattpocock/skills、Anthropic 公式ほか）

取り入れるもの:

| 実践 | 候補 |
|---|---|
| デバッグでは、赤くなる再現ループを先に作る | C15 |
| green は全体のテストスイートで判定する | C16 |
| テストの改ざんを決定的に検出する | C06、C07 |
| レビューに Spec の軸を持たせ、判断を見送った観点を列挙する | C27 |
| 裁定に「間違っていた場合のコスト」を添える | C68 |
| near-miss の負例でトリガーを測る | C18 |
| plugin eval で with/without を比べる | C17、C61、C64 |
| 自動起動のスキルから明示起動のスキルへの引き継ぎを、ユーザーへの提案に直す | C15、C32 |

取り入れないもの:

- Refactor を TDD のループから外すこと。
- seam をユーザーに確認するまでテストを書かないこと。ユーザーの全体指示（既定値を推奨して進める）と衝突する。
- Common Rationalizations 表を復活させること。
- star 数やベンチマークの数値を採否の根拠にすること。

### Claude Code 本体の変化（2.1.210〜2.1.310）

| 変化 | 候補 |
|---|---|
| `claude plugin eval`（2.1.269〜） | C17 |
| `claude plugin details` で常時コストを測る | C19、C35 |
| Agent ツールの呼び出しごとの effort（2.1.292）と、ultracode の分離（2.1.284） | C21 |
| `onFailure: "block"`（2.1.295）と、PreToolUse の `ask` | C01（このフックには onFailure を使わない） |
| 組み込みの /verify、/simplify、/security-review、/run との分担 | C59 |
| 圧縮後のスキル再添付の仕様 | C31（棄却。§3） |

## 7. 全候補（PR 単位の束）

1 つの束は、同じファイルや同じ論点に触れる候補のまとまりで、1〜数本の PR で扱う想定。推奨する順序は次のとおり。

1. B0（P0）は、すぐに直す。§5-7（ci.yml のカバレッジゲート）も同じ hotl の patch 版で直す。
2. B1（フックの文言とテスト）と、B9 の C18（発火の実測）。
3. B2 → B3 → B5（テストの完全性と正本化）。各 PR では、変えた規則を判定する行動ケースを同じ PR で足す（C85 を受入条件として前倒し）。
4. 残りの P1。
   - B13・B14: 知識の鮮度（C05、C46、C47、C52、C51、C53）
   - B7・B8: ワークフローとレビュー（C13、C15、C25、C26）
   - B6: LLM 評価（C14）
   - B11・B12: デザインとフロントエンド（C38、C40、C41、C45）
   - B9 の C35、B10 の C17、B15 の C21・C29
5. 残りの P2・P3。
   - eval 基盤（B10）は、C17 のローカル試行の結果を見てから、C61 → C62 → C64・C65・C78 の順に進める。
   - C65 の JSON 削除は、live の実行で同等に観測できると確かめてからにする。

test-design（現在 168 行）には、B3・B4・B9 から 8 件以上が追記する。追記後の行数を見積もり、500 行の制限を超えるなら references/ に振り分ける。

### B0. 配布物の破損・権限・ライセンス（即時）（最高 P0）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C02 | P0 | ui-ux-pro-max（cc と codex の両方）に上流 MIT の LICENSE 原文（Copyright (c) 2024 Next Level Builder）を同梱し、来歴を記録する（上流 93a4b061、CC BY-NC から MIT への変更後に取り込んだこと、ローカルでの改変） | `ui-ux-pro-max/README.md:53-59,5-12`, `ui-ux-pro-max/.claude-plugin/plugin.json:1-11`, `README.md:20,71` ほか1件 | cc は ui-ux-pro-max の削除で解消。codex-plugins 側に残すなら LICENSE の同梱が必要 |
| C03 | P0（検証時 P1） | hotl の eval-gate テンプレートが anthropic Python SDK 2.x（API 2026-10-21、2026-10-21 リリース）で judge を全件失敗し、fail-closed でゲートが常時ブロックされる。暫定対応として SDK を <2 に固定し、次版で judge を Claude in Amazon Bedrock（4.7 以降・sampling なし）へ移行する | `hotl-engineering/skills/hotl-engineering/assets/workflows/eval-gate.yml:69,99`, `hotl-engineering/skills/hotl-engineering/assets/evals/run_evals.py:36-49`, `hotl-engineering/skills/hotl-engineering/references/eval-design.md:16` ほか5件 | SDK 2.3.0 で TypeError を再現（本統合で実行）。feature/freshness-b0 で実装済み（未コミット）。原因は SDK 1.0.0 での sampling 引数の削除（§4） |
| C04 | P0 | hotl incident-triage テンプレは「Read-Only・書き込みツールなし」と宣言しているが、実装では書き込みできる。`Bash(gh api:*)` が、claude-code-action が OIDC で取得する Claude GitHub App トークン（Contents / Issues / PR が R&W）をそのまま使うため。 | `hotl-engineering/skills/hotl-engineering/assets/workflows/incident-triage.yml:13-18,34-37,69-76,98` | feature/freshness-b0 で実装済み（未コミット） |

### B1. フックの強制力を実態に合わせる（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C01 | P1 | 危険コマンド hook の誤遮断を減らし、本体保護と重複しない狭い tripwire に絞る。must-block / must-pass の回帰表と「100%強制」の文言訂正を付ける（fail-closed と rm の照合拡張は採らない） | `dev-core/scripts/block-dangerous-commands.sh:7-18,7-25`, `dev-core/hooks/hooks.json:15-25`, `dev-core/README.md:82` ほか5件 |  |
| C24 | P1（検証時 P0） | フックの強制力と実装の記述を実態に合わせる（continuous-learning の「100%強制」と Stop の発火タイミング・検出対象、README のフック表と存在しない fixture の記述を直し、conventions-as-guardrails:10/110 の同種表現も揃える） | `dev-core/skills/continuous-learning/SKILL.md:31-38,42-45,57-63`, `dev-core/README.md:83-84,88` | 文言の訂正で実害なし。C01 と統合 |

### B2. テストの完全性（改ざんの禁止と検出、全体 green）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C06 | P1 | 仕様の変更を根拠にしないテストの改変（削除・skip/only・期待値の緩和・テスト入力の特別扱い）で通すことを禁じ、仕様とテストが矛盾したら止めて返す出口を、知識層の正本（Iron Law と Zero Trust Review）と自律実装テンプレートに明文化する | `dev-core/skills/best-practices/SKILL.md:26-30`, `dev-core/agents/tdd-practitioner.md:66-78,84-88,94-108`, `dev-core/agents/code-reviewer.md:29` ほか2件 |  |
| C07 | P1 | verify にテスト弱体化（focus/skip マーカー・テスト削除・assert 純減・スナップショット一括更新）の点検を加え、Stop フックは未追跡ファイルの見落としを直したうえで、高精度な skip/only/テスト削除の検出だけに絞って拡張する | `dev-core/skills/verify/SKILL.md:36,38`, `dev-core/scripts/stop-quality-gate.sh:2-4,24,33-34,54,16-17,34`, `dev-core/skills/conventions-as-guardrails/SKILL.md:106-107` ほか3件 |  |
| C16 | P1 | 単独の /dev-core:tdd で、完了報告と --commit の前にプロジェクトの全体テストを1回実行させる（--red/--green は除外、eval 更新込み） | `dev-core/workflows/tdd/SKILL.md:44-46,5`, `dev-core/skills/best-practices/SKILL.md:19-30`, `hotl-engineering/docs/trigger-boundaries.md:26` |  |
| C56 | P1（検証時 P2） | cc test-design の flaky 運用を codex 06afa51 の規則に揃え（移植漏れの補完）、retry で通ったテストを verify と verification-loop で証拠から外す | `dev-core/skills/test-design/SKILL.md:130-131`, `dev-core/skills/verify/SKILL.md:36`, `dev-core/skills/debug/SKILL.md:19-24` | 承認・期限付きの quarantine を skip 検出（C07）の前提として B2 へ移動（Codex レビュー）。逆輸入（codex 06afa51） |

### B3. テスト知識の正本化（best-practices/references/testing.md 新設）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C09 | P1 | best-practices/references/testing.md を新設し、test-design:153 の空の参照先を埋める。Claude 専用エージェントにしかない「テストの書き方」の知識を知識層へ移す（Iron Law の核はエージェントに残す） | `dev-core/skills/test-design/SKILL.md:153,92-104`, `dev-core/skills/best-practices/SKILL.md:12-17,19-30`, `dev-core/agents/tdd-practitioner.md:32-34,68,73-78` ほか2件 |  |
| C10 | P1 | テストダブルの優先順位と、自前の DB・ブローカーを実依存で動かす integration の既定を、best-practices の知識層に明文化する（テストデータは分離規則だけ足し、本番データ禁止は既存の正本へのポインタにする） | `dev-core/agents/tdd-practitioner.md:76`, `dev-core/skills/test-design/SKILL.md:30,94`, `hotl-engineering/skills/hotl-engineering/assets/templates/CLAUDE.md.template:22` ほか2件 |  |
| C58 | P2 | test-design に unit の定義（sociable / solitary）、決定的なテストと非決定的なテストの扱い、既存と提案の区別、強制箇所のテストを足す（カバレッジの既定値の追加は撤回する） | `dev-core/skills/test-design/SKILL.md:25-44,101-103`, `hotl-engineering/skills/hotl-engineering/assets/workflows/ci.yml:128-135`, `hotl-engineering/skills/hotl-engineering/references/principles.md:46-48` |  |
| C60 | P2 | test-design の出典を正す（:23 に実在の出典を付ける、Vocke と Marick への帰属訂正、JSTQB v4.0 の版と2値/3値BVAの明記）、llm-evals の誇張表現を弱める | `dev-core/skills/test-design/SKILL.md:23,79,84,163-166`, `ai-engineering/skills/llm-evals/SKILL.md:9` |  |

### B4. テスト技法の拡充（test-design）（最高 P2）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C11 | P2 | test-design に境界テストの設計（実装とスペックの適合・同時実行・権限/RLS）を references で補い、空振りしている参照4本と誤った参照1本を直す | `dev-core/skills/interface-contract-design/SKILL.md:15`, `dev-core/skills/resilience-design/SKILL.md:180`, `dev-core/skills/data-auth-boundary-design/SKILL.md:166,216` ほか3件 |  |
| C12 | P2 | ミューテーションテストを「発想」から運用手順へ引き上げる（差分スコープ・全体実行スコアのラチェット・手動の変異注入） | `dev-core/skills/test-design/SKILL.md:101-104,147` |  |
| C55 | P2 | test-design の Step 4 にプロパティベーステスト（PBT）を加え、反例は原因を切り分けて本物のバグだけを固定 example にする | `dev-core/skills/test-design/SKILL.md:77-90,3` |  |
| C57 | P2 | E2E の現代的な手法（Test Agents の人間ゲート、axe の範囲、ARIA 構造スナップショットとピクセル比較の使い分け）を test-design の references に設計判断として入れ、Playwright の実行設定は e2e ワークフローと e2e-runner に置く | `dev-core/skills/test-design/SKILL.md:132-133`, `dev-core/workflows/e2e/SKILL.md:9-58,43-45`, `dev-core/agents/e2e-runner.md:9-48,31` ほか2件 |  |
| C85 | P2（検証時 P3） | テスト指針の改訂と同じ PR で、その規則を判定する behavior eval ケースを追加する（test-design・best-practices・e2e。live 実行は plugin eval 形式に別途起こした任意ジョブ） | `dev-core/evals/skill-behavior-cases.json`, `scripts/validate-skill-evals.mjs` | 規則と同じ PR で eval ケースを足すことを B2/B3/B5 の受入条件に前倒し（Codex レビュー） |

### B5. E2E（Playwright）の方針修正（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C08 | P1 | E2E のロケータ方針（data-testid の無条件最優先）、POM 例の Discouraged API、npx の自動取得ガードの不整合を直し、e2e-runner に状態契約を入れる | `dev-core/agents/e2e-runner.md:29-31,22-27,39-48`, `dev-core/workflows/e2e/SKILL.md:37-48,17,30` |  |

### B6. LLM 評価の方法論の一本化（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C14 | P1 | llm-evals と hotl の採点方式・較正基準の矛盾を、方法論の正本（llm-evals）とゲート統合（hotl）の分担で解消し、judge_rubric の参照切れと ai-system-design の参照先誤りを直す | `ai-engineering/skills/llm-evals/SKILL.md:33-43,59-70`, `hotl-engineering/skills/hotl-engineering/references/eval-design.md:10-18`, `hotl-engineering/skills/hotl-engineering/assets/evals/judge_rubric.md:4,10` ほか2件 |  |

### B7. debug・refactor・ハンドオフの整理（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C13 | P1 | refactor ワークフローの矛盾と手順のバグを直す（Critical から振る舞い変更を外す、テストの薄い対象は特性テストで先に固定する、frontend-design 系のロードを外す、PR モードのブランチ確認と対象ファイル抽出の不具合を直す） | `dev-core/workflows/refactor/SKILL.md:57,108-117,127-131,148-152,206,13-17,66-105,170-176`, `dev-core/agents/tdd-practitioner.md:56` |  |
| C15 | P1 | debug スキル: 知識層から user-invoked ワークフローへのハンドオフを外し（修正は親が Red から行う）、赤くなる再現ループを Phase 1 の完了条件にする（再現不能時の出口付き） | `dev-core/skills/debug/SKILL.md:13,15-24,26-42,72,79,93` |  |
| C28 | P2 | OCP と YAGNI を「新しく足す抽象」に限り、意図された継ぎ目と削らないものを明記する。debug の修正フェーズに「呼び出し元を grep して共有箇所で1回直す」を足す（ponytail の翻案は最小限、ペルソナは持ち込まない） | `dev-core/skills/best-practices/SKILL.md:19-48,35`, `dev-core/workflows/task/SKILL.md:35-42`, `dev-core/workflows/execute/SKILL.md:31-41` ほか1件 |  |
| C32 | P2 | debug の user-only workflow へのハンドオフを「ユーザーに提案」に直し、共有層の Claude 固有の記述（プラグイン固有のフック・設定パス・Codex の defaultPrompt）を整理する | `dev-core/skills/debug/SKILL.md:13,72,79,93`, `dev-core/skills/backend-patterns/SKILL.md:8`, `dev-core/skills/frontend-patterns/SKILL.md:8,48,72` ほか7件 |  |
| C44 | P2 | refactor ワークフローと tdd-practitioner で、フロントエンドを扱うだけで生成系デザインスキル（frontend-design / ui-ux-pro-max）がロードされる指示を、見た目の設計を任されたときに限る条件付きに改め、frontend-patterns を正本として据える | `dev-core/workflows/refactor/SKILL.md:3,12-17`, `dev-core/agents/tdd-practitioner.md:13-15` | 公式版は複数の生成系スキルを同梱するので、重要度はむしろ上がる |
| C59 | P2 | 組み込みの /simplify・/security-review・/run・/verify・/debug を踏まえて code-review の分担表を補い、verify に「実行中のアプリでの観測」を中立な文言で足し、Codex 共有の debug 本文から Claude 専用ワークフローへのハンドオフを外す | `dev-core/skills/verify/SKILL.md:3,105-109,9`, `dev-core/README.md`, `dev-core/workflows/code-review/SKILL.md:14-19,44,12-19` ほか4件 |  |

### B8. レビューの契約と最終報告（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C25 | P1 | codex-collab の Three Strikes 節（:80-84, :90）を正本 debug（止めて報告し、判断を委ねる）に揃える。書き込み可能な /codex:rescue は同意か事前許可があるときだけの選択肢にする | `dev-core/skills/codex-collab/SKILL.md:80-84,90`, `dev-core/skills/debug/SKILL.md:56-72`, `dev-core/evals/skill-behavior-cases.json` |  |
| C26 | P1 | security-auditor の出力を正本の契約（重大度 P0〜P3・確度・file:line・未確認）に揃え、diff 範囲・読み取り専用・反証段を加えて execute の P0/P1 ゲートで読めるようにする | `dev-core/agents/security-auditor.md:1-10,14,45-50,52-67`, `dev-core/agents/code-reviewer.md:55-92`, `dev-core/workflows/execute/SKILL.md:99` ほか2件 |  |
| C27 | P2 | リスクゲートの独立レビューの入力を正本（§5）に揃え、「diff の外を読む範囲」と Spec の不足観点を知識層に足す（code-review の規約レンズは維持する） | `dev-core/agents/code-reviewer.md:17-23,35-53`, `dev-core/workflows/code-review/SKILL.md:23-33`, `dev-core/workflows/execute/SKILL.md:70` ほか1件 |  |
| C69 | P2 | security-auditor と e2e-runner の返却形式を委譲の契約に揃え、検査器の無視キーに initialPrompt を加える。omitClaudeMd と maxTurns は Phase C 以降の測定候補にとどめる | `scripts/check-plugin-agents.mjs:83`, `dev-core/agents/code-reviewer.md:1-11`, `dev-core/agents/security-auditor.md:1-10` ほか3件 |  |
| C67 | P3 | レビューゲートの文言差と、issue-driven-dev の過大な正本宣言・Status 値 planned を揃える（計画書式の移設と Codex 翻案はしない） | `dev-core/workflows/execute/SKILL.md:58-73`, `dev-core/skills/best-practices/references/delegation-and-review.md:53-98`, `dev-core/skills/issue-driven-dev/SKILL.md:3,12` ほか3件 |  |
| C68 | P3 | 子 agent が返す「未確認」「残る懸念」を親の報告で落とさない。あわせて、計画からの逸脱と、修正しないと決めた指摘に「間違っていた場合のコスト」を付けて最終報告に載せる | `dev-core/skills/best-practices/SKILL.md:24-30`, `dev-core/workflows/tdd/SKILL.md:48-50`, `dev-core/workflows/refactor/SKILL.md:166-168` ほか3件 |  |
| C88 | P3 | 意図した簡略化を opt-in の `shortcut: <限界>, <引き上げ条件>` コメントと読み取り専用の台帳で可視化する（レビュアーの全件報告は維持） | `dev-core/skills/best-practices/references/coding-standards.md`, `dev-core/agents/code-reviewer.md:55-59`, `dev-core/skills/issue-driven-dev/SKILL.md` |  |

### B9. スキルの到達性（発火の実測・description・listing 予算・frontmatter）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C18 | P1（検証時 P2） | トリガー評価を作り直す。明示起動と自動発火を分け、自動起動できるスキルには near-miss の負例を置き、grill の負例は行動ガードとして残す。共存環境での発火は手動で記録し、新しい検査は警告から始める | `dev-core/evals/skill-behavior-cases.json:27-38`, `scripts/validate-skill-evals.mjs:109-120`, `indie-product-marketing/evals/skill-behavior-cases.json` ほか6件 | 発火の実測をテスト内容の改善の前提条件にする |
| C35 | P1 | ルートの README に、常時コスト（実測・補正済み・版付き）と、スキル一覧の予算超過への対処ガイドを置く。dev-core の README からはリンクだけ張る | `README.md:6-26`, `dev-core/README.md:150-158` |  |
| C19 | P2 | トークン予算（always-on と on-invoke）を、認証ありのスナップショットと Node 標準の文字数プロキシで追跡し、増加と 5k tok 超えを警告で知らせる | `AGENTS.md:79-84`, `.github/workflows/skills-drift-check.yml:91-111`, `scripts/check-skills-drift.mjs:110-114` |  |
| C30 | P2 | description を listing 予算前提で書き直す（総量の削減、Codex 向けの先頭集中、強調語は eval で確かめて平叙化、境界は1句、block scalar の字数検査を修正） | `AGENTS.md:82`, `scripts/check-skills-drift.mjs:113-114,343-349`, `hotl-engineering/skills/hotl-engineering/SKILL.md:3` ほか6件 |  |
| C33 | P2 | SKILL.md frontmatter を層別の allow-list で検査し、共有層の argument-hint と README の「標準準拠」の矛盾を解消する（block scalar の対応、version の重複、initialPrompt の漏れを含む） | `scripts/check-skills-drift.mjs:135,142,182-202,343-349,160-202`, `dev-core/skills/debug/SKILL.md:4`, `dev-core/skills/verify/SKILL.md:4` ほか3件 |  |
| C34 | P2 | hotl-engineering と cicd-release-design の CI/CD 境界、issue-driven-dev と system-architecture-selection の ADR 正本の重複・矛盾を、本文の相互ポインタと単一正本で解消する | `hotl-engineering/skills/hotl-engineering/SKILL.md:3`, `dev-core/skills/cicd-release-design/SKILL.md:3`, `hotl-engineering/docs/trigger-boundaries.md:23-24` ほか2件 |  |
| C63 | P2 | SKILL.md の構造規約（本文500行・全 reference が SKILL.md から直接参照されること・100行超の reference に目次・ブロックスカラーの description の長さ・トップレベル version）を drift チェッカで機械化し、AGENTS.md:25 の誤った記述を直す | `AGENTS.md:83,25`, `scripts/check-skills-drift.mjs:182-202,766-813`, `ui-ux-pro-max/skills/ui-ux-pro-max/SKILL.md:3-4` ほか4件 |  |
| C71 | P2 | hotl の trigger-boundaries.md を、8月に追加された model-invocable な隣接スキル（cicd-release-design ほか）との境界に合わせて更新し、スラッシュ専用スキルの行を正す | `hotl-engineering/docs/trigger-boundaries.md:9-17,26,32,44-47` |  |
| C73 | P2 | description が落ちても設計系スキルへ辿れるよう、best-practices に関連スキルの短い索引を置く（掲載集合を drift チェッカで検査する） | `dev-core/skills/best-practices/SKILL.md:12-17`, `AGENTS.md:22-48`, `scripts/check-skills-drift.mjs:766-813` |  |

### B10. eval 基盤（plugin eval への段階移行）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C17 | P1 | `claude plugin eval` で行動ケースのローカル試行を始める（CI には入れない。最初は hotl の相談ケース、次に dev-core の自動発火4件と indie。dev-core の slash 起動ケースは、実行できるかを確かめてから扱う） | `hotl-engineering/evals/cases.json:1-55`, `hotl-engineering/evals/report-2026-07-04.md:1-11`, `dev-core/evals/skill-behavior-cases.json:4-10` ほか4件 |  |
| C61 | P2 | Phase C の live 評価のために calibrated の基準を既存の llm-evals 基準に揃えて定義し、行動ケースから最小の plugin-eval スイートを作ってから、PR を止めない任意の定期ジョブを足す | `docs/research/autonomous-development-workflows.md:32,58`, `.github/workflows/skills-drift-check.yml:14-34`, `dev-core/README.md:90` |  |
| C64 | P2 | description や load-bearing なルール文言を変える PR に、plugin eval による変更前後（main とブランチ）の比較と、却下だけを残す台帳を求める（スイートができてから適用し、required CI にはしない） | `AGENTS.md:79-84`, `dev-core/skills/continuous-learning/SKILL.md`, `hotl-engineering/docs/trigger-boundaries.md:34-44` |  |
| C78 | P2 | design-core に behavior eval（`evals/skill-behavior-cases.json`）を新設する。近傍スキルとの陰性ケースと、用途の文脈別（業務画面 / LP / スライド）の挙動を入れる。required CI は静的なスキーマ検証だけにし、代表ケースは live で1回実行して記録する | `scripts/validate-skill-evals.mjs:2-4,54-65`, `dev-core/evals/skill-behavior-cases.json`, `design-core/.claude-plugin/plugin.json:1-28` |  |
| C62 | P3 | eval の拡充は Phase C の初回 live 実行の後に回す。先に validator の全プラグイン巡回、失敗にしないカバレッジ表、model-invocable スキルの near-miss 負例の不足（現状0件）を可視化する | `dev-core/evals/skill-behavior-cases.json:11-331`, `.github/workflows/skills-drift-check.yml:77-80`, `scripts/validate-skill-evals.mjs:63-65,109-120` |  |
| C65 | P3 | plugin eval で同等に観測できるケースだけをケースディレクトリへ移し、移した分の JSON は削除する。dmi のスキルと副作用を見るケースは JSON を正本に残し、validator は2形式の lint にする | `dev-core/evals/skill-behavior-cases.json`, `indie-product-marketing/evals/skill-behavior-cases.json`, `hotl-engineering/evals/cases.json` ほか2件 |  |

### B11. デザイン系（design-core・ui-ux-pro-max・LP）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C38 | P1 | ui-visual-defaults の基盤記述を更新する: shadcn/ui の既定は Base UI、色生成は OKLCH(:84 の Tailwind=HSL という誤りを削除し、検証スクリプトに OKLCH→sRGB 変換を追加)、トークン出力は v4 の :root/.dark + @theme inline を既定とする | `design-core/skills/ui-visual-defaults/SKILL.md:28-32,84,11,171` | 本文に出典 URL・確認日を付けて反映 |
| C40 | P1 | design-core のコントラスト検証を既定スタックの色形式（oklch/hsl/alpha）に対応したテスト付き scripts/ に置き換え、第2段で SKILL.md に根拠のある和文組版ルールだけを静的 lint 化する | `design-core/skills/ui-visual-defaults/SKILL.md:95-116`, `design-core/skills/design-review/SKILL.md:30,44-56,155-156`, `design-core/skills/business-doc-design/SKILL.md:57-70` |  |
| C41 | P1 | design-review に、レンダリング取得の手順と表示条件ごとの審査（reflow・拡大・文字間隔・フォーカスの被り・モーション・ダークモード）を WCAG レベルの対応付き（Must/Should）で足す。ui-visual-defaults はモーショントークンだけを足し、ブレークポイントは Tailwind 既定に固定する | `design-core/skills/design-review/SKILL.md:14-22,104-125`, `design-core/skills/ui-visual-defaults/SKILL.md:61-71,120-124,167-174`, `indie-product-marketing/skills/global-landing-design/references/claude-code-runtime.md:13-14` |  |
| C37 | P2 | business-doc-design の Marp 例で、frontmatter の `theme: company` が解決されない不整合を直す（CSS に `/* @theme company */` を入れ、コマンドを `--theme-set` 方式にそろえる）。あわせて出力を画像で確かめる手順を1行足す | `design-core/skills/business-doc-design/SKILL.md:89-102,106-110,119-120` |  |
| C39 | P2 | design-review の AI 生成 UI 欠陥スキャンを、根拠・代替・検出方法・面のモード・ブリーフ免除付きのカタログ（references/）に拡充する。絶対指摘は既存の計測可能な下限に結び付き、Step 7 の Must / Should / Consider に写像する | `design-core/skills/design-review/SKILL.md:90-102,14-22`, `design-core/skills/ui-visual-defaults/SKILL.md:34-51,153` |  |
| C42 | P2 | design-review Step 6 に WCAG 2.2 で追加された基準と ISO/IEC 40500:2025・JIS 改正動向を加え、2.2 AA を正本とする優先順位を1行書く | `design-core/skills/design-review/SKILL.md:104-125`, `design-core/skills/ui-visual-defaults/SKILL.md:126-144`, `ui-ux-pro-max/skills/ui-ux-pro-max/data/styles.csv` ほか2件 |  |
| C43 | P2 | デザイン系スキルの発火の重なりを解く（ui-ux-pro-max の description を「具体的な見た目の判断のための候補検索」に絞り、design-core の生成系への振り先を直す。refactor の生成系スキルのロードを外し、hotl の trigger-boundaries は突合対象の列挙だけ更新する） | `ui-ux-pro-max/skills/ui-ux-pro-max/SKILL.md:4-18,54,3-15`, `design-core/skills/design-review/SKILL.md:3,10,177`, `hotl-engineering/docs/trigger-boundaries.md:3,32` ほか2件 | ui-ux-pro-max の description の部分は削除で不要。refactor のロードと design-core の振り先は残る |
| C74 | P2 | design-core / delivery-core の細かな事実誤りと出典の欠落を一括で直す（大きい文字の閾値、相対輝度の定数、自動検出の割合、7±2 のナビへの誤用、LATCH の断定、5人85%の前提、カードソートの人数） | `design-core/skills/design-review/SKILL.md:63,81,120`, `design-core/skills/ui-visual-defaults/SKILL.md:100,108`, `design-core/skills/business-doc-design/SKILL.md:51` ほか1件 |  |
| C75 | P2 | design-review の Step 7 に審査記録（方法ヘッダ）、Must を AI 側で免除しない規則、再審査は取り直した証拠で判定する規則、主張の出所が未確認な箇所を列挙して回す1行を加える（クライアント向け4項目テンプレートは変えない） | `design-core/skills/design-review/SKILL.md:127-148,150-169` |  |
| C77 | P2 | 確定したトークンの所在・決定理由・禁止ルールを、リポジトリ内の固定ファイルに残し、常時読まれる指示ファイルから1行で指す（DESIGN.md は alpha 仕様なので、その任意フォーマットの1つにとどめ、値は重複させない） | `design-core/skills/ui-visual-defaults/SKILL.md:167-176,190-198`, `design-core/skills/design-review/SKILL.md:14-22` |  |
| C79 | P2 | global-landing-design: デザインシステムの無い LP に WCAG 2.2 AA の数値下限を codex の正本で入れる。cc の runtime ノートでは design-review の Step 5 と Step 6 を参照する（EAA は扱わない） | `indie-product-marketing/skills/global-landing-design/references/claude-code-runtime.md:49-53`, `indie-product-marketing/skills/global-landing-design/references/design-playbook.md:52`, `indie-product-marketing/skills/global-landing-design/SKILL.md:72-79` ほか1件 |  |
| C76 | P3 | 和文組版ルールの数値の正本を design-review Step 2 と明示し、生成系2スキルには本文を残したまま同期注記を付ける（重複行は削除しない） | `design-core/skills/design-review/SKILL.md:44-56`, `design-core/skills/ui-visual-defaults/SKILL.md:53-57,146-165`, `design-core/skills/business-doc-design/SKILL.md:57-70` | 検証で降格 |
| C36 | drop（検証時 P2） | ui-ux-pro-max（cc）の SKILL.md を「英語キーワードで引くスタイル参照の検索」に絞り、description の誤った件数と広すぎるトリガーを直し、既知のデータ欠陥を注意節で無害化する（上流への一括追随はしない） | `ui-ux-pro-max/skills/ui-ux-pro-max/SKILL.md:4-18,52-54,127,197`, `ui-ux-pro-max/skills/ui-ux-pro-max/scripts/core.py:95-98`, `ui-ux-pro-max/skills/ui-ux-pro-max/data/colors.csv` ほか4件 | ui-ux-pro-max を cc-plugins から削除したため不要（2026-10-25）。逆輸入（codex 2449cee） |

### B12. フロントエンド（frontend-patterns）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C45 | P1 | frontend-patterns に codex b07bbad の条件付き原則を取り込み、SPA/Tauri で誤誘導する記述と古い API を直し、a11y 実装・CWV・React 19・テスト配分を足す | `dev-core/skills/frontend-patterns/SKILL.md:3,8,30-34,44-48,58-72,78-85,112-117`, `AGENTS.md:41` | 逆輸入（codex b07bbad） |

### B13. セキュリティ・サプライチェーンの鮮度（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C05 | P1 | best-practices/references/security.md のチェックリストを OWASP Top 10:2025（版付き）に更新し、A10 例外条件（fail-open）の欠落を埋める。codex 側の security-auditor.toml も同期する | `dev-core/skills/best-practices/references/security.md:1-14`, `dev-core/agents/security-auditor.md:12-18`, `dev-core/agents/code-reviewer.md:13` ほか3件 |  |
| C46 | P1 | AI セキュリティの語彙を 2026 版に更新し（LLM Top 10 2026・Agentic Top 10 for 2026・AISVS 1.01）、security-by-design に MCP の脅威と AISVS のレベル明記を加える。Rule of Two は ai-system-design に正本を置く | `dev-core/skills/security-by-design/SKILL.md:3,50-64,107-115`, `ai-engineering/skills/ai-system-design/SKILL.md:135-140,213`, `ai-engineering/skills/human-in-the-loop-design/SKILL.md:57-71,213` | 本文に出典 URL・確認日を付けて反映 |
| C47 | P1 | cicd-release-design に依存取り込みと Actions のサプライチェーン対策（クールダウン・install script・lockfile・Trusted Publishing・SHA ピン強制・pull_request_target）を追加する。ツールが既定で守るものと明示設定が要るものを分けて書く。hotl テンプレは actions のメジャー版を上げる | `dev-core/skills/cicd-release-design/SKILL.md:53-60,165-167,132-142`, `dev-core/skills/security-by-design/SKILL.md:96-105`, `hotl-engineering/skills/hotl-engineering/assets/ADJUST.md:12-14` ほか1件 |  |
| C52 | P1 | 「外部 ID は推測不能（ULID / UUIDv7）」を訂正する。RFC 9562 §8 のとおり推測困難さに頼らず、非連番 ID は多層防御、IDOR の本体はサーバ側認可とする。capability トークンの指針は data-auth に1箇所だけ置く。 | `dev-core/skills/interface-contract-design/SKILL.md:64`, `dev-core/skills/data-auth-boundary-design/SKILL.md:67-72`, `dev-core/skills/data-design-ops/SKILL.md:44-69` |  |
| C48 | P2 | 依存監査ゲートの閾値がファイル間でずれている（moderate / high / 無指定の「クリーン」）。CI ゲート基準の正本を security-by-design Step 5 に置き、KEV/EPSS は対応順と例外の根拠に使う | `dev-core/skills/cicd-release-design/SKILL.md:38,60,190`, `dev-core/skills/security-by-design/SKILL.md:96-104`, `dev-core/skills/verify/SKILL.md:37` ほか1件 |  |
| C49 | P2 | SBOM 記述を CISA 2026 最小要素（METI・NCO 共著、ガイダンス）と経産省手引 ver2.0 に合わせ、EU 市場向け製品案件に限って CRA の報告義務（2026-09-11〜）を保守契約の論点として1箇所に加える | `dev-core/skills/security-by-design/SKILL.md:105`, `compliance-core/skills/oss-license-audit/SKILL.md:102-118`, `dev-core/skills/ops-design-handover/SKILL.md:88-100` ほか1件 | 本文に出典 URL・確認日を付けて反映 |
| C80 | P2 | API・認証の規格の根拠と既定値を最新にする（MFA の既定は SP 800-63B-4 の AAL2 要件を根拠にフィッシング耐性へ・ROPC/Implicit は RFC 9700 を根拠に・DPoP/mTLS を追記・OAS 3.2 は条件付きの選択肢・確定済み規格の行単位の但し書きを整理） | `dev-core/skills/interface-contract-design/SKILL.md:35,112,185-192`, `dev-core/skills/data-auth-boundary-design/SKILL.md:90-97,113-121,196-200` |  |

### B14. 運用・API・AI・法務の鮮度（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C51 | P1 | ai-system-design で MCP を「対象リビジョン」付きで扱う（2026-07-28 current: ステートレス化、Roots/Sampling/Logging/DCR の非推奨、CIMD・iss 検証）。HITL の OTel GenAI semconv 記述は「別リポジトリへ移動・Development・リリース未発行」に直す | `ai-engineering/skills/ai-system-design/SKILL.md:71,214`, `dev-core/skills/interface-contract-design/SKILL.md:162-171`, `ai-engineering/skills/human-in-the-loop-design/SKILL.md:129` ほか1件 | 本文に出典 URL・確認日を付けて反映 |
| C53 | P1 | 改正個情法（2026-07-17 公布、施行は原則2年以内）の受託開発に効く中身と、日本の AI 法・AI事業者ガイドライン1.2・EU AI Act 高リスク義務の延期（Reg. 2026/1744）を各スキルに反映する | `compliance-core/skills/privacy-data-compliance/SKILL.md:176-180`, `ai-engineering/skills/human-in-the-loop-design/SKILL.md:132-140,211`, `compliance-core/skills/genai-ip-clearance/SKILL.md:155-160` | 本文に出典 URL・確認日を付けて反映 |
| C50 | P2 | cicd-release-design の「DORA Four Keys（MTTR）」を DORA の現行5指標（スループット / 不安定性）に更新し、出典 URL と確認日を本文に添える | `dev-core/skills/cicd-release-design/SKILL.md:13-14,188`, `hotl-engineering/skills/hotl-engineering/SKILL.md:134` |  |
| C54 | P2 | 版を書いた事実に確認日付きの出典表を持たせ、日付条件付きの一括免責と確定済み規格の「要確認」を外す（法務ガードレールは残す）。古い OpenAPI/AsyncAPI の表記を先に直す | `dev-core/skills/security-by-design/SKILL.md:157`, `dev-core/skills/interface-contract-design/SKILL.md:185-195`, `dev-core/skills/data-auth-boundary-design/SKILL.md:196-204` ほか5件 |  |
| C81 | P2 | 出典の無い数値と断定を、出典付き・定性化・自組織方針のいずれかに直す（顧客向けテンプレの「約10倍」、tj-actions の利用数と実害の混同を優先する） | `dev-core/skills/cicd-release-design/SKILL.md:56,59,161`, `dev-core/skills/reliability-sla-design/SKILL.md:73,77`, `dev-core/skills/system-architecture-selection/SKILL.md:46` ほか2件 |  |
| C82 | P2 | ops/reliability の重複した「なぜ」を1行ポインタに置き換え、cloud:136 の閉域代替の文言を security Step 3 と揃える(TLS は cloud を参照にし、IPA 版は migration から参照するだけ) | `dev-core/skills/reliability-sla-design/SKILL.md:8,57,111,134,141-142,85`, `dev-core/skills/ops-design-handover/SKILL.md:46-48,68-69,149`, `dev-core/skills/security-by-design/SKILL.md:72-73,84` ほか2件 |  |
| C83 | P2 | 誤った内部参照を正しい正本へ直す（ICD の「将来提供予定」、用語集とドメインモデル、ADR とレビュー工程の design-review への誤送、golden set の評価、security-auditor の指示、hotl の存在しない README と CODEOWNERS.sample）。再発防止チェッカは既存なので外す | `dev-core/skills/external-design-deliverables/SKILL.md:3,21`, `delivery-core/skills/requirements-definition/SKILL.md:168,179`, `delivery-core/skills/client-alignment/SKILL.md:95,158` ほか5件 |  |
| C84 | P2 | dev-core 5スキルの版・名称・出典の誤りを直す（Zod 4、React Compiler/useOptimistic、ISO/IEC 25010:2023、デジタル庁 DS-463-1、Cloud Run functions、OpenTofu の CNCF Sandbox、S3 ネイティブロック、TLS 証明書の有効期間短縮） | `dev-core/skills/frontend-patterns/SKILL.md:59-66,79,114`, `dev-core/skills/system-architecture-selection/SKILL.md:30`, `dev-core/skills/conventions-as-guardrails/SKILL.md:145` ほか2件 | 本文に出典 URL・確認日を付けて反映 |
| C91 | P2 | indie-product-marketing の ethics-and-compliance に日本の特商法（法11条の広告表示、法12条の6の最終確認画面とサブスクの表示事項）を加える。あわせて、references の固定引用に確認日を付け、スマホ新法と EAA の範囲を正しく補う（codex で英語で先に直し、cc へは同一コピー） | `indie-product-marketing/skills/indie-product-marketing/references/evidence-base.md:98-129,149-159`, `indie-product-marketing/skills/indie-product-marketing/references/ethics-and-compliance.md:19-30`, `indie-product-marketing/README.md:114-118` | 本文に出典 URL・確認日を付けて反映 |

### B15. リポジトリ自身の保守（CI・検証器・文書）（最高 P1）

| ID | 優先度 | 改善内容 | 主な対象 | 注記 |
|---|---|---|---|---|
| C21 | P1 | effort の上書き経路（2.1.292 の呼び出しごとの effort）と ultracode の分離（2.1.284）を反映して、dev-core README・pins・設計書の古い前提を直し、設計書と計画の状態を merge 済みに合わせる | `docs/research/opus-5-5-plugin-strategy.md:5,425-432,462-503,513`, `scripts/agent-effort-pins.json:3,19,23`, `dev-core/README.md:116-119,94,104-106,114-120` ほか2件 |  |
| C29 | P1 | github-tools:pr の allowed-tools から広い Bash パターン（git:* / gh:* / npm:* / pnpm:* / yarn:*）を外し、push と PR 作成など本文が実際に使う完全一致コマンドだけを事前承認する（dev-core で 2026-07 に済ませた方針の適用漏れ） | `github-tools/skills/pr/SKILL.md:6,54`, `github-tools/.claude-plugin/plugin.json:4` |  |
| C20 | P2 | 検証器の負例回帰テストを node:test にまとめる。check-plugin-agents の未カバー3 code と initialPrompt を埋め、drift チェッカは root 注入と code 付与を前提に変異テストを足す | `scripts/check-skills-drift.mjs:1058-1070`, `.github/workflows/skills-drift-check.yml:52-87`, `scripts/check-plugin-agents.mjs:21-50,83` ほか3件 |  |
| C22 | P2 | 検証コマンドを未実行を成功と区別する1本のランナーにまとめ、AGENTS.md・README・dev-core/README・CI のずれを無くす | `AGENTS.md:63-77`, `README.md:52,55-67`, `.github/workflows/skills-drift-check.yml:50-89` ほか2件 |  |
| C23 | P2 | CI の action を Node 24 対応の major に上げ(setup-python を含む)、node-version を 24 にする。skills-drift-check に permissions を明示し、Claude CLI の版をログに残したうえで、手動実行で Ubuntu 26 上の成否を確かめる | `.github/workflows/skills-drift-check.yml:14-48,91-111`, `.github/workflows/hotl-gates.yml:32-40`, `hotl-engineering/skills/hotl-engineering/assets/ADJUST.md:12-14` |  |
| C66 | P2 | allowed-tools / disallowed-tools が呼び出したターンだけ効く仕様に合わせて grill の保証範囲を書き直し、no-op になっている task・debug-team の Write(*.md) を直す | `dev-core/workflows/grill/SKILL.md:6-7,21-30`, `docs/research/autonomous-development-workflows.md:38`, `dev-core/workflows/task/SKILL.md:6` ほか4件 |  |
| C70 | P2 | 小さな誤記と出典の欠落を直す（issue-driven-dev の tasklist 混同、codex-collab の曖昧な一文・出典のない人名・引用 URL、dev-core README の scripts パスの曖昧さ） | `dev-core/skills/issue-driven-dev/SKILL.md:51`, `dev-core/skills/codex-collab/SKILL.md:20,31,91,95`, `dev-core/.codex-plugin/plugin.json:24` ほか2件 |  |
| C72 | P2 | ミラー台帳（mirror-map.json）を作り、codex-plugins に無い10本を Codex 利用者向けに明示する | `AGENTS.md:86-92`, `dev-core/README.md:150-155`, `dev-core/.codex-plugin/plugin.json` ほか1件 |  |
| C86 | P3 | SessionStart の規律テストに正本側の canary を足す（debug・verify と、日本語の写しの agent）。英語の写しには、同じ句の組を cc と codex の両方に置く | `dev-core/scripts/session-start-context.sh:45-53`, `dev-core/skills/debug/SKILL.md:56`, `dev-core/skills/verify/SKILL.md` ほか1件 |  |
| C87 | P3 | AGENTS.md と README に「workflows/ の SKILL.md（Claude 専用スキル）は公式の動的 Workflow（.js）とは別物で、同じディレクトリに共存できる」と1行注記する | `dev-core/.claude-plugin/plugin.json`, `hotl-engineering/.claude-plugin/plugin.json`, `AGENTS.md` ほか2件 |  |
| C90 | P3 | dependencies を宣言しない方針の明文化と、validator が指摘する2つの README（dev-core・ui-ux-pro-max）へのインストール行追加（タグ付けはユーザーが依頼したときだけ） | `dev-core/README.md`, `delivery-core/README.md`, `ai-engineering/README.md` ほか5件 | ui-ux-pro-max の README の部分は削除で不要 |
### 棄却

| ID | 内容 | 理由 |
|---|---|---|
| C31 | 圧縮後に残る先頭 5,000 tok に収まるよう、人間ゲートを本文の冒頭へ並べ替え、トークン目安を機械的に検査する | 前提が誤っていた（§3）。日本語の SKILL.md は全文が再添付される。 |
| C89 | dev-core をプラグインに分割する | 分割しても得るものが小さい。ただし検証時の理由「使用頻度の低い description を自動で落とす」は、批評によれば changelog で裏付けられない。分割すれば、利用者が要らない部分だけを無効にして予算を空けられる利点がある。この点は §5-2 の統廃合の判定でもう一度扱う。 |

## 8. 取り入れない外部の実践（68 件）

外部調査で見つかったが、根拠が弱い、過去の設計判断と衝突する、またはこのリポジトリの方針に合わないものをまとめた。いくつかは、一部だけを候補に取り込んでいる（理由の欄を参照）。

| 領域 | 取り入れないもの | 理由 |
|---|---|---|
| テスト（手法・中身） | workflow（tdd / e2e / refactor）の allowed-tools に Bash を足して「整合」させる | allowed-tools は事前許可で、使えるツールを制限するものではない。Bash がなくても動き、確認が出るだけ。autonomous-development-workflows.md は、git / gh / パッケージマネージャを広く許すパターンを外部副作用の無確認化を避けるために意図して外している。直すべき不整合ではない。 |
| テスト（手法・中身） | Böckeler の実験を根拠に Iron Law（テストファースト）を撤回する、またはエージェントへの TDD 指示をやめる | 小標本で、LLM が判定し、題材はグリーンフィールドの小課題だけ。著者自身が限界を明記している。t-wada（流量制御と監査可能性）や Beck とも結論が違う。取り込むのは「TDD の目的の言い直し」と「結果を測るセンサー（ミューテーション・承認テスト）の追加」までにする。 |
| テスト（手法・中身） | ponytail の「自明でないロジックには小さなテストを1本だけ、自明な変更には不要」という最小主義 | dev-core の Iron Law（小さな変更でもテストを書く）と正面から衝突する。根拠のベンチは Bash を無効にしていて、エージェントは自分のテストが落ちるところを見ていない。テストがあるセルに限った捕捉率は素の状態より低い（69% 対 77%）。取り込むなら「テストが欠けている変更を見つける基準（分岐・ループ・パーサ・お金・セキュリティ）」としてレビュー観点に使う程度。 |
| テスト（手法・中身） | mattpocock:tdd に倣い、Refactor を TDD ループから外してレビュー段に移す | 根拠は「エージェントがほぼ実行しなかった」という観察だけで、比較評価がない。dev-core は t-wada 式の Red→Green→Refactor→Evidence を正本にしている。検討するなら、まず dev-core の Refactor 段が実際に実行されているかをトランスクリプトで測る。 |
| テスト（手法・中身） | テストを置く seam をユーザーに確認するまでテストを書かない（mattpocock:tdd の規則） | ユーザーの全体指示 C1（手続き的な選択は既定を推奨して進め、質問で止めない）と衝突する。seam は推奨案として計画に記録して進める形で取り込む。 |
| テスト（手法・中身） | Playwright Test Agents の定義や Hypothesis の /hypothesis コマンドを、プラグインに複製して同梱する | どちらもベンダーがバージョン更新に合わせて改訂し、再生成を前提にしている。複製するとすぐ古くなる。プラグインは採用条件とガード（人間の承認、healer の skip を点検する）だけを書き、本体は参照にする。 |
| テスト（手法・中身） | ミューテーションスコアに一律の閾値（例: 80%）を置き、required ゲートにする | 80% は慣習で標準ではない。実行コストが高く、等価ミュータントの問題もある。ベースラインからのラチェットにし、最初は advisory で観測する（hotl 原則6 の comment-only → 較正 → 強制）。 |
| テスト（手法・中身） | cc-plugins 自身の scripts/ に Stryker などのミューテーションツールを導入する | このリポジトリの scripts は Node 標準のみで追加依存なしが方針。ミューテーションの指針は利用者のプロジェクト向けの知識として書き、効果の確認は利用先か使い捨てのサンプルで行う。 |
| テスト（手法・中身） | 「よくある言い訳」表（Common Rationalizations）や Red Flags 表を TDD スキルに再び入れる | opus-5-5-plugin-strategy.md §4.6 で、tdd-practitioner などの合理化テーブルは理由付きの短い方針にまとめると決めている。Opus 5.5 世代では強い語調の列挙より条件文が効く、という判断を覆す新しい根拠はない。 |
| テスト（手法・中身） | Stop フックで毎ターン lint / test / build を回すことを dev-core の既定にする | opus-5-5 §4.5 は Stop の既存ゲートを維持し、無人実行の継続ガードは Phase C で計測してから決めるとしている。毎ターンのフルテストはコストとレイテンシが大きく、stop_hook_active と組み込みのブロック上限の設計も要る。任意の設定例として示すにとどめる。 |
| テスト（手法・中身） | テストの改ざんの検出を LLM の監視（judge）だけに任せる | ImpossibleBench は、仕様に反する近道が単純なテストの改変から演算子のオーバーロードまで多様だと示しており、監視ツールの開発用テストベッドとして位置づけている。決定的な diff 検査を主にし、LLM のレビューは補助にする。 |
| テスト（手法・中身） | 契約ハーネスの効果として Naresh Jain の数値（受入率 3/10 → 10/10）を根拠に使う | 1サービス、モデルごとに10試行、低い effort での自己申告。著者は Specmatic の創業者で利害関係がある。契約やハーネスの作成・保守コストは測られていない。「独立した受入チェックを残す」という原則だけを取り込む。 |
| テスト（手法・中身） | Playwright 1.64 の WebMCP テストや testProject.default を E2E 指針に入れる | WebMCP は実験的なブラウザ API で、受託の一般的な E2E 方針に入れる段階ではない。testProject.default は設定の細部で、知識スキルに書くほどの一般性がない。 |
| テスト（手法・中身） | ponytail の band（Claude Code の mod でテスト状態やコストをプロンプト上に表示する） | 端末とデスクトップでしか表示されず、claude -p やクラウドでは動かない。テストの中身の改善ではなく可視化で、効果を示すデータもない。 |
| テスト（評価基盤・自己検証） | 未較正の live eval を required CI にする | 過去の判断（autonomous-development-workflows.md:58）を維持する。plugin eval は確率的に揺れ、既定の --threshold 1.0 では1回でも満点を外すと exit 1 になる。公開リポジトリの PR でシークレットと --trust-plugin を使うことにもなる。任意の定期ジョブにとどめる。 |
| テスト（評価基盤・自己検証） | ルール変更ごとに ponytail 規模のベンチマーク（3アーム × 6 runs 以上、585 セッション級）を必須にする | 個人運用のマーケットプレイスでは費用と手間が見合わない。結果の数値も作者の自己申告。規模を合わせた回帰確認（変更前後のトリガーケースと、壊しうる既存ケース1件）で代える。 |
| テスト（評価基盤・自己検証） | SKILL.md の指示行に `<!-- rule:id -->` を埋め込む（impeccable 方式） | cc-plugins にはマーカーを取り除くビルド工程が無く、常に文脈へ入るトークンが増える。codex 翻案で ID を同期する手間も増える。少数の不変句 canary で代える。 |
| テスト（評価基盤・自己検証） | superpowers の SKILL.md 20,000 bytes サイズゲートをそのまま流用する | 英語で較正した代理指標。cc-plugins の SKILL.md は最大 19,385 bytes なので全件通るが、推定トークン数では約25件が 5k tok を超える。plugin details の推定で測る。 |
| テスト（評価基盤・自己検証） | TF-IDF による description の衝突・順位検査（addyosmani の Tier 2） | 日本語の description では語の分割（形態素解析や文字 n-gram）を設計し直す必要がある。精度も未検証。near-miss の負例を実際の発火で測る方が直接的。 |
| テスト（評価基盤・自己検証） | SkillOpt 型のスキル文書の自動最適化 | 改善幅は著者の論文とベンチによる自己申告で、独立した追試が無い。個人のリポジトリには過剰。取り入れるのは「改善した編集だけを採用し、却下も記録する」という受け入れ基準だけ。 |
| テスト（評価基盤・自己検証） | 日本語の rubric で plugin eval の既定 judge（haiku）を使う | 小さい judge は書式の違いで正答を落とすと docs 自身が注意している。日本語の rubric ではさらに揺れやすい。sonnet 級に固定し、無料の grader を優先する。 |
| テスト（評価基盤・自己検証） | /skill-doctor の利用統計を作者側の品質指標にする | 統計は利用者のマシンにしか残らず、作者には返ってこない。作者側では plugin details の推定と eval で測る。 |
| テスト（評価基盤・自己検証） | プラグイン monitor や Claude Mods を検証の手段にする | monitor は -p で起動しないので plugin eval で測れない。サンドボックスの外でユーザーの権限のまま動き、manifest のキーも experimental。 |
| テスト（評価基盤・自己検証） | star 数や自己申告のベンチ数値（addyosmani の発火率 7/27→21/27、impeccable の recall、superpowers の 8/10→5/10 など）を採否の根拠にする | n が小さく、どれも単発の自己申告。採否は、手法を再現できるかと、このリポジトリのリスクと方針に合うかで判断する（autonomous-development-workflows.md:61 と同じ立場）。 |
| テスト（評価基盤・自己検証） | pull_request / pull_request_target で API キーを使って eval を動かす | 公開リポジトリなので、フォークからの PR でシークレットが漏れる経路を作る。--trust-plugin によってプラグインの hook が runner 上で動く。eval は main の schedule と workflow_dispatch だけで動かす。 |
| 開発ワークフロー | ponytail の SessionStart codebase map hook（シンボル一覧を毎セッション注入する） | map の有無を比べた評価（ablation）がなく、効果が v5 全体の数値に混ざっている。毎セッションのコンテキストを常に消費する。正規表現なので、入れ子や動的な定義を取りこぼす。さらに、session-start-context.sh は「allowlist 済みのメタデータだけを出し、リポジトリ内のテキストを文脈に流さない」という注入対策で作られており、ファイルから抜き出した名前を流す設計とぶつかる。再利用優先は、C28の grep 指示で代替する |
| 開発ワークフロー | GateGuard 型の fact-forcing hook（最初の Edit/Write を拒否して事実の列挙を要求する） | SKILL.md にある +2.25 は、2タスク・各1回の自己申告。同じリポジトリの効果測定 README は「one-shot pilot では全アームに差なし」としていて矛盾する。全編集に摩擦を足すうえ、公式ディレクトリの審査観点（適用範囲の広い hook）にも当たる |
| 開発ワークフロー | ponytail のテスト最小主義（自明でない処理だけに小さなテスト1本、自明な変更にはテスト不要） | dev-core の Iron Law（振る舞いを変えるなら先に失敗するテスト）と真っ向から衝突する。根拠は自己申告のベンチマークだけ。取り入れるのはラダーと「削らないもの」（C28）に限る |
| 開発ワークフロー | Refactor を TDD ループから外してレビュー段に移す（mattpocock） | 根拠は作者の観察（エージェントがほとんど Refactor をしなかった）だけ。t-wada 式の Red→Green→Refactor を正本とする方針と衝突し、transcript での実測もない |
| 開発ワークフロー | grill の質問をフロンティア単位のラウンドにまとめる（複数の質問を一度に出す） | 2026-07-14 の調査で「一度に1問」を採用した判断と、eval の grill-explicit-command（「1回に複数の質問をまとめる」を禁止）を覆すことになる。効果の主張（13問が約3ラウンド）も測定値ではない。取り入れるのは「はい、で推奨案を受け入れられる問い方」だけにする（C66）。まとめて質問する方式は、live eval で往復回数と決定漏れを比べてから再検討する |
| 開発ワークフロー | execute の最後に、毎回ブランチ全体の新文脈レビューを必須にする（superpowers の executing-plans） | 5.0.0 で決めた「リスクゲートに当たるときだけ1回レビューする」設計を覆し、コストを増やす。strategy §9 の測定（偽完了率、仕込んだバグの見逃し）が悪化を示すまでは採らない。取り入れるのは、判断にコストの欄を足すことと、修正しなかった軽微な指摘を開示することだけ（C68） |
| 開発ワークフロー | 未較正の live plugin eval を、required な CI ジョブにする | 過去の判断（autonomous-development-workflows.md の「導入しないもの」）をそのまま維持する。claude plugin eval は実モデルを呼んでトークンを消費し、既定の threshold 1.0 は確率的な発火には厳しすぎる。入れるとしても、較正の後に任意のジョブとして入れる |
| 開発ワークフロー | debug-team や多観点レビューを、いますぐ .js の動的 workflow に移す | 動的 workflow は実行の途中でユーザーの入力を受け取れない（仮説をユーザーに確認する Phase 2 と合わない）。usage を消費し、品質とコストは未測定 |
| 開発ワークフロー | 計画ファイルを毎ターン再注入する skill frontmatter hooks（planning-with-files 型） | Web 取得系のツールと組み合わさると、プロンプトインジェクションを増幅する経路になる（同リポジトリの自己監査の所見）。session-start の「計画本文を流さない」設計と、過去の「planning-with-files の全面導入はしない」判断に反する |
| 開発ワークフロー | code-reviewer に memory: project を付ける | continuous-learning と役割が重なる。レビュアーが過去の判断を持ち越すと、新しい文脈で評価するという独立性の設計を損なう |
| 開発ワークフロー | レビュー指摘を JSON Schema と validator で機械可読にする（cloudflare security-audit 型）を、いますぐ全面導入する | 現状、指摘を機械的に取り込む下流（CI や集計）が無い。まずは Markdown の契約を一本化する（C26）。CI で指摘を集計する需要が出たら再検討する |
| 開発ワークフロー | ponytail・superpowers・ECC などのベンチマークの数値や star 数を、採否の根拠にする | どれも自己申告で、標本が小さいか、スキル自身の形式への準拠を測る循環的な指標になっている。採否は、手法を再現できるかと、このリポジトリの方針・リスクに合うかで判断した |
| スキル設計 | 20を超えるハーネスへのアダプタ配布（ponytail・wshobson 型） | cc-plugins の対象は Claude Code と Codex だけで、Codex 向けには英語の翻案ミラーがある。ハーネスごとの写しとバージョン検証を増やすと、保守と drift 検査の負担が大きく増えるのに、利用者の便益ははっきりしない。 |
| スキル設計 | plugin.json の dependencies で dev-core を必須にする | 依存先は強制的に有効になるため、delivery-core などの利用者にも dev-core の常時コスト（約6k tok）が乗る。今の『導入されていれば』と書く任意参照の設計のほうが、listing 予算の面で有利。 |
| スキル設計 | 知識の本文を SessionStart で常駐させる（resident ruleset） | 毎回の API 呼び出しで再読されるので、コストが継続的に増える（第三者の実測で +6.9%）。progressive disclosure の方針とも逆。SessionStart の注入は、今の規律数行（約250tok）にとどめる。 |
| スキル設計 | あまり使われない知識スキルを disable-model-invocation にする、または `paths` で自動起動を絞る | disable-model-invocation にすると名前すら一覧から消え、発見する手段が無くなる。`paths` は Codex と共有する層では使えず、設計の相談はファイルができる前に起きることが多い。予算は description の短縮で稼ぐ。 |
| スキル設計 | skill-creator の推奨どおり description を一律に『pushy』に書く | 公式の prompting ガイドは強い言い回しを和らげるよう勧めており、指針が対立している。混み合った一覧では字数の割に近傍スキルとの弁別に役立たない。書き換えは計測してから個別に行う。 |
| スキル設計 | トークン節約のため description を英語で書く | 日本語の発話とトリガー語を照合するには日本語が必要で、日本語を正本とする方針にも反する。英語版は codex-plugins の翻案が担っている。 |
| スキル設計 | 日本語 description の TF-IDF や類似度による決定的なルーティングテスト（addyosmani の Tier 2） | 日本語では語の分割（形態素解析か文字 n-gram）を設計し直す必要があり、近似の精度が分からない。実際のトリガー eval（near-miss 込み・任意実行）を優先する。 |
| スキル設計 | トリガー eval を required CI にする | モデル呼び出しの費用と揺れがあり、calibration 前に必須ゲートにはしない。docs/research/autonomous-development-workflows.md の『未calibratedな live model eval の required CI 化』を導入しないという判断を維持し、手動・任意の実行にとどめる。 |
| スキル設計 | when_to_use フィールドの追加 | description と合わせて同じ1,536字の枠と listing 予算を使うので、予算の削減にはならない。Codex と共有する層では仕様外のキーで、hard error の原因になる。 |
| スキル設計 | 既存スキルを自己説明的な名前に改名する（hotl-engineering など） | スラッシュ名、プラグインをまたぐ参照、codex のミラー、利用者の習慣が壊れる。名前だけ表示への対策は、description の短縮と導線の追加で行う。新しいスキルを命名するときの基準にとどめる。 |
| スキル設計 | 公式ディレクトリ向けの icon 追加と、hook へのプロジェクト関連性ゲート | cc-plugins は自前のマーケットプレイスで、提出の予定は無い。ICON_MISSING は提出時にだけ関係する。 |
| デザイン | impeccable のプラグインフック（GitHub Releases から取得した静的バイナリを SessionStart / PostToolUse / Stop で実行）の同梱や推奨 | 外部バイナリが毎回の編集時に実行され、v4.6.0 には concept roll のテレメトリもある（無効化は可能）。クライアント案件のリポジトリに持ち込むリスクが大きい。design-core にはまだ自前の決定的チェックが無いので、まず scripts/ 化（テスト付き）を先に行い、フック化はそのあとに別途判断する。 |
| デザイン | impeccable の overused-font（Inter / Roboto / Arial 等を一律に検出）を禁止リストとして輸入する | モードを見ずに一律で検出する。業務システムで Inter + Noto Sans JP を既定にする方針（デジタル庁の採用が根拠）と衝突する。LP で反射的に選んだ場合の指摘としてだけ、slop カタログに入れる。 |
| デザイン | 方向性をスクリプトで乱数配布する仕組み（impeccable の concept-seed、taste-skill の draw.mjs） | 効果の根拠はどれも自己申告のブラインド評価で、データは公開されていない（maturity: hype-or-unproven）。計画段階の自己テスト（カテゴリだけで見た目が当てられるなら作り直す）の1行で、主な効果は得られる。 |
| デザイン | impeccable の comp-led ビルドと finish-reviewer 一式の移植 | 本文自体が frontier-tier の仕事だと明記している。new-work.md は 64KB あり、cc-plugins の SKILL.md 500行制限と合わない。取り込むのは原則（証拠の有効性を先に確認する、修正の説明ではなく取り直した証拠で判定する、新しい文脈でレビューする）だけにし、審査の出力形式の候補に含めた。 |
| デザイン | 英語の文体についての slop ルール（em-dash-overuse、aphoristic-cadence、theater-slop-phrase）の直輸入 | 英語の文体に固有の規則で、日本語のコピーには当てはまらない。日本語コピーの slop は自前の観察で、advisory から始めるべきである。 |
| デザイン | ui-ux-pro-max 上流 2.15.0（7スキル）の丸ごと再ベンダリング | core 以外は未読。design スキルには外部の画像モデル API を呼ぶ --pro フラグがある。Google Fonts（OFL）や Phosphor アイコンなど第三者ライセンスのデータを含む。90日の鮮度 SLA を自前で回す保守負担もある。縮小と無害化の候補で代替する。 |
| デザイン | DESIGN.md を ui-visual-defaults の必須の成果物にする | 仕様自体が `version: alpha` で、CLI は 0.4.0 と変化が速い。impeccable の言い換えと仕様本文もすでに食い違っている。任意のエクスポートにとどめる。 |
| デザイン | スキル本文の全指示行に `<!-- rule:id -->` の安定 ID を付ける | ID を使う eval 本体が impeccable でも非公開で、cc-plugins には ID を消費する仕組みがない。翻案ミラーの手間だけが増える。ID は slop カタログの行 ID としてだけ使う。 |
| デザイン | 起動 eval（recall と誤起動のゲート）や hallmark の視覚 LLM 審査を required CI にする | 過去の判断「未calibratedな live model eval の required CI 化」は導入しない、と衝突する。hallmark の eval は API キーが必要で、提供元の宣伝も兼ねている。静的なスキーマ検証だけを required にし、live の実行は calibration 後の任意ジョブにする。 |
| デザイン | WCAG 3.0 / APCA を規範としてコントラスト基準に採用する | WCAG 3 は 2026-03 時点で Working Draft で、契約や納品の基準にできない。参考情報として触れるだけにとどめる。 |
| デザイン | star 数（impeccable 86.8k、ui-ux-pro-max-skill 140k、taste-skill 102k 等）を採否の根拠にすること | 注目度であって、品質の証拠ではない。どのプロジェクトも作成から1年未満で、品質改善の with/without 比較 eval は非公開か自己申告である。 |
| 知識の鮮度 | Spec Kit 等の spec-driven development の全面導入 | docs/research/autonomous-development-workflows.md の「導入しないもの」（docs/plans との二重管理）は今も妥当。採るのは、変更規模に応じて仕様の重さを変える、仕様は決定的なゲートに変換できる範囲でだけ効く、という線引きの明文化までにとどめる。 |
| 知識の鮮度 | 鮮度チェック（gh api によるリリース照合）や plugin eval を required CI にする | 外部 API のレート制限とネットワーク依存で、結果が揺れる。過去の判断「未calibratedな live model eval の required CI 化は不採用」と同じ理由で、週次の非ブロッキング・ジョブ（Issue 出力）にとどめる（C54）。 |
| 知識の鮮度 | MCP 2026-07-28 版だけを前提にスキルを書き直す | 2026-07-28 版は initialize を廃止する破壊的な改訂で、SDK とクライアントの対応には時間差がある。「対象リビジョンを明記し、非推奨機能を新規採用しない」という書き方にとどめる（C51）。 |
| 知識の鮮度 | OTel Profiles を「4本目の柱」として本番の監視設計に入れる | public alpha で、公式が重要な本番用途には非推奨としている。将来枠の注記にとどめる。 |
| 知識の鮮度 | GitHub の immutable actions / releases を出荷済みの対策として書く | ロードマップ上はまだ Future。出荷済みなのは SHA ピン強制ポリシーと workflow lockfile（プレビュー）だけ。 |
| 知識の鮮度 | Anthropic の社内計測値（サンドボックスでプロンプト 84% 削減、承認率 93%、auto mode の見逃し 17%）や DORA 調査の % を、スキルの根拠数値として載せる | 自己申告や自己選択サンプルの数値で、独立した検証がない。「環境層で封じ込め、モデル層で誘導する」という設計原則だけを採り、数値は載せない。 |
| 知識の鮮度 | OWASP Agentic Top 10 の ASI01〜ASI10 の項目名を二次ソースから転記する | genai.owasp.org の resource ページでは項目の一覧を確認できず、名称は二次ソースでの照合しかない。版名と公開日だけを書き、項目名は原典で確認できた分に限る。 |
| 知識の鮮度 | 取適法・フリーランス法の知識を cc-plugins に入れる、またはこのマーケットプレイス外の個人用スキルへ相互参照する | 参照先はこのマーケットプレイスに含まれないスキルで、公開リポジトリの利用者には参照切れになる。知識本体を複製すれば AGENTS.md の二重管理禁止にも反する。cc-plugins 内に古くなった記述もない（grep で 0 件）。 |
| 知識の鮮度 | WCAG 3.0 や改正 JIS X 8341-3 を規範として引用する | WCAG 3.0 は 2026-03 時点でワーキングドラフト。JIS の改正版は、確認した範囲ではまだ発行されていない。試験基準は「JIS X 8341-3:2016 + WCAG 2.2 の追加達成基準」（WCAG 2.2 = ISO/IEC 40500:2025）で合意するのが安全。 |

## 9. 未監査の範囲

次のファイルは、どの候補の対象にもならなかった。監査していないか、「確認済み・変更なし」と記録していない。

- `github-tools/skills/docs/SKILL.md`
- `hotl-engineering/workflows/{assess,apply}/SKILL.md`
- `delivery-core/skills/{domain-modeling-strategic,org-change-enablement,pm-delivery}/SKILL.md`
  - domain-modeling-strategic は、同居している mattpocock-skills:domain-modeling と発火が重なるおそれがある。
- `indie-product-marketing/skills/indie-idea-discovery/SKILL.md`
- `docs/codex-interop/{codex-permissions.md,shared-skills-setup.md}`
- `scripts/setup-shared-skills.sh`
  - テストが無い。--dry-run と冪等性のテストがあるかを確かめる。
- `scripts/tests/test_workflows.py`
  - C04 がテストの追加先として参照しているだけで、中身は監査していない。

## 10. 次の監査に向けて

- **前回調査との関係**: 前回は 2026-07-14（`autonomous-development-workflows.md`）、今回は 2026-10-25 で、どちらも約 3 か月で鮮度の差が目立った。
  - Claude Code の changelog
  - SDK と API の版
  - OWASP などの規格の版
  - 法令
- **反映の仕方**: 版を書いた事実には出典と確認日を付ける（C54）。そうしておけば、次の監査は「確認日が古い行」から始められる。
- **頻度**: 鮮度チェックは required CI にしない（§8）。四半期に 1 回、本書と同じ手順（内部棚卸し → 外部調査 → 反証検証 → 批評）で回す。

## 11. P0・P1 の主な一次ソース

検証エージェントが参照した一次ソースのうち、公開できる URL だけを候補ごとに最大 4 件載せる。確認日は検証時のもの。すべての出典と確認状態は、ローカルの台帳にある。

| ID | 一次ソース（検証時の確認日） |
|---|---|
| C02 | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/LICENSE（2026-10-25）<br>https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/commit/fbc96e7f（2025-12-06） |
| C03 | https://platform.claude.com/docs/en/api/migration-2026-10-21（2026-10-21）<br>https://pypi.org/project/anthropic/（2026-10-23） |
| C04 | https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/（2025-11-02）<br>https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/（2025-12-09） |
| C01 | https://code.claude.com/docs/en/hooks（2026-10-25 取得）<br>https://code.claude.com/docs/en/changelog（2026-10-08）<br>https://code.claude.com/docs/en/plugins/manifest-reference（2026-10-25 取得）<br>https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md（2026-10-08） |
| C05 | https://github.com/OWASP/Top10/blob/master/2025/docs/en/A03_2025-Software_Supply_Chain_Failures.md（2025-12-24）<br>https://github.com/OWASP/Top10/tree/master/2025/docs/en（2025-12-24）<br>https://github.com/OWASP/Top10/commit/ba953be4aab8bf4674ea697415787f5ac9a2996e（2025-12-24） |
| C06 | https://arxiv.org/abs/2510.20270（2025-10-23）<br>https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents（2025-11-26）<br>https://arxiv.org/abs/2602.00409（2026-01-30）<br>https://newsletter.kentbeck.com/p/augmented-coding-beyond-the-vibes（2025-06-25） |
| C07 | https://code.claude.com/docs/en/permissions（2026-10-25 アクセス）<br>https://playwright.dev/docs/test-agents（2026-10-25 アクセス）<br>https://code.claude.com/docs/en/best-practices（2026-10-25 アクセス）<br>https://arxiv.org/abs/2510.20270（2025-10-23） |
| C08 | https://playwright.dev/docs/locators（2026-10-25 アクセス）<br>https://playwright.dev/docs/best-practices（2026-10-25 アクセス） |
| C09 | https://github.com/obra/superpowers/blob/main/skills/test-driven-development/writing-good-tests.md（2026-07-05）<br>https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md（2026-10-07）<br>https://github.com/HypothesisWorks/hypothesis/blob/master/.claude/commands/hypothesis.md（2026-08-16）<br>https://arxiv.org/abs/2410.10628（2025-11） |
| C10 | https://arxiv.org/abs/2602.00409（2026-01-30）<br>https://abseil.io/resources/swe-book/html/ch13.html（2020）<br>https://testcontainers.com/guides/introducing-testcontainers/<br>https://code.claude.com/docs/en/best-practices（2026-10-25 アクセス） |
| C13 | https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html（2026-08-10）<br>https://martinfowler.com/articles/harness-engineering.html（2026-04-02）<br>https://github.com/obra/superpowers/blob/main/skills/test-driven-development/writing-good-tests.md（2026-07-05）<br>https://github.com/approvals/ApprovalTests.Python（2026-10-22） |
| C14 | https://github.com/anthropics/skills/blob/main/skills/claude-api/shared/evals/eval-audit.md（2026-09-29） |
| C15 | https://code.claude.com/docs/en/skills（2026-10-25 アクセス）<br>https://github.com/mattpocock/skills/commit/1dab98299c（2026-08-15）<br>https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md（2026-10-07） |
| C16 | https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md（2026-09-19）<br>https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md（2026-09-18）<br>https://speakerdeck.com/twada/tdd-in-ai-era-202604-edition（2026-04-20）<br>https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md（2026-10-07） |
| C17 | https://code.claude.com/docs/en/plugin-evals（2026-10-25 取得）<br>https://code.claude.com/docs/en/changelog（2026-09-11） |
| C18 | https://agentskills.io/skill-creation/optimizing-descriptions（2026-10-25 取得）<br>https://code.claude.com/docs/en/plugin-evals（2026-10-25 取得）<br>https://code.claude.com/docs/en/commands（2026-10-25 取得）<br>https://github.com/Nutlope/hallmark/blob/7ec868225c6caa040558c321ee0fefa0e73f83a8/eval/README.md（2026-10-22） |
| C21 | https://code.claude.com/docs/en/sub-agents（2026-10-25 取得）<br>https://code.claude.com/docs/en/changelog（2026-10-06）<br>https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md（2026-10-06） |
| C24 | https://eslint.org/blog/2024/04/eslint-v9.0.0-released/（2024-04-05）<br>https://github.com/mattpocock/skills/commit/0243b6ec4ca02f5a188506d0c0342e3617a7dee1（2026-09-15） |
| C26 | https://github.com/DietrichGebert/ponytail/blob/09c434ab73ca43761c5d8b0c5d341926c2fba710/skills/ponytail-review/SKILL.md（2026-10-08）<br>https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-security/agents/scan-verifier.md（2026-07-22）<br>https://github.com/cloudflare/security-audit-skill/blob/main/skills/security-audit/SKILL.md（2026-09-10） |
| C29 | https://code.claude.com/docs/en/skills（2026-10-25） |
| C35 | https://code.claude.com/docs/en/skills（2026-10-25 取得）<br>https://code.claude.com/docs/en/plugins/measure（2026-10-25 取得） |
| C38 | https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default（2026-07）<br>https://tailwindcss.com/blog/tailwindcss-v4（2025-01-22） |
| C40 | https://github.com/pbakaus/impeccable/blob/936867543ac2576920d663cc9803597f6044f3ac/crates/detect/tests/regex_only_note.rs（2026-10-23）<br>https://github.com/pbakaus/impeccable/blob/936867543ac2576920d663cc9803597f6044f3ac/AGENTS.md（2026-10-23）<br>https://github.com/pbakaus/impeccable/blob/936867543ac2576920d663cc9803597f6044f3ac/crates/foundation/src/registry.rs（2026-10-23） |
| C41 | https://www.w3.org/TR/WCAG22/#reflow（2023-10-05）<br>https://github.com/pbakaus/impeccable/blob/936867543ac2576920d663cc9803597f6044f3ac/skill/reference/audit.md（2026-10-23）<br>https://github.com/anthropics/claude-plugins-official/blob/44490cccaf6d9f82fdeec9416fbf7c9bd72575dc/plugins/frontend-design/skills/frontend-design/SKILL.md（2026-09-01） |
| C45 | https://zod.dev/v4（2025-07）<br>https://react.dev/blog/2024/12/05/react-19（2024-12-05）<br>https://react.dev/blog/2025/10/07/react-compiler-1（2025-10-07）<br>https://playwright.dev/docs/locators（2026-10-25） |
| C46 | https://github.com/OWASP/www-project-top-10-for-large-language-model-applications（2026-08-04）<br>https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/tree/main/2026/final（2026-08-04）<br>https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/（2025-12-09）<br>https://github.com/OWASP/AISVS/releases/tag/v1.0（2026-10-16） |
| C47 | https://github.blog/changelog/2026-07-14-dependabot-version-updates-introduce-default-package-cooldown/（2026-07-14）<br>https://github.com/npm/cli/releases/tag/v12.0.0（2026-07-08）<br>https://github.com/pnpm/pnpm/releases/tag/v11.0.0（2026-04-28）<br>https://docs.astral.sh/uv/reference/settings/#exclude-newer（2026-10-25 取得） |
| C51 | https://modelcontextprotocol.io/specification/2026-07-28/changelog（2026-07-28）<br>https://modelcontextprotocol.io/specification/2025-11-25/changelog（2025-11-25）<br>https://github.com/open-telemetry/semantic-conventions-genai（2026-05-05）<br>https://opentelemetry.io/blog/2026/profiles-alpha/（2026-03-26） |
| C52 | https://www.rfc-editor.org/rfc/rfc9562.html#name-security-considerations（2024-05）<br>https://www.postgresql.org/about/news/postgresql-18-released-3142/（2025-09-25） |
| C53 | https://www.ppc.go.jp/personalinfo/legal/r8kaiseihogohou/（2026-10-14）<br>https://www.ppc.go.jp/files/pdf/260717_kaiseihounitsuite.pdf（2026-07）<br>https://www.cao.go.jp/press/new_wave/20251003.html（2025-10-03）<br>https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_1.pdf（2026-03-31） |
| C56 | https://github.com/microsoft/playwright/releases/tag/v1.62.0（2026-07-24）<br>https://github.com/microsoft/playwright/releases/tag/v1.63.0（2026-09-04）<br>https://arxiv.org/abs/2504.16777（2025-04） |
