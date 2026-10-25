# cc-plugins

Claude Code プラグインのマーケットプレイス・ソースリポジトリ。
t-wada 式 TDD、FSD（Feature-Sliced Design）、Clean Architecture、DDD に基づいた開発を、スキル・ワークフロー・エージェント・フックで支えます。

## インストールと更新

Claude Code では、マーケットプレイスを一度登録してから、使うプラグインを1つずつ入れます。

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install dev-core@cc-plugins
```

ほかのプラグインも `/plugin install <名前>@cc-plugins` で入れます。入れていないプラグインのコマンドは使えません。

用途ごとの組み合わせの例です。

- 開発: dev-core と github-tools
- CI・品質ゲートの導入や、引き継いだリポジトリの整備も扱う: hotl-engineering を足す
- 受託の上流も扱う: delivery-core と compliance-core を足す
- LLM や AI エージェントの機能を作る: ai-engineering を足す
- 画面や資料の見た目を整える: design-core を足す
- 個人開発のプロダクト: indie-product-marketing を足す

入れすぎると毎ターンのコストが増えます（「[常時コストと共存の設定](#常時コストと共存の設定)」）。

前提:

- dev-core には Claude Code 2.1.280 以上が要ります。フックには jq が要ります。
- github-tools には gh のインストールと `gh auth login` が要ります。

更新するときは、マーケットプレイスを更新してから、新しいセッションを始めます。

```
/plugin marketplace update cc-plugins
```

入れたプラグインの版が上がらないときは、ターミナルで `claude plugin update <名前>@cc-plugins` を実行し、再起動します。

Codex で使う場合は「[Codex で使う](#codex-で使う)」を見てください。

## 提供プラグイン

| プラグイン | 説明 |
|-----------|------|
| [dev-core](./dev-core/) | TDD 開発フレームワーク。開発原則のスキル、ワークフロー、専門エージェント、Hooks 自動化を提供 |
| [github-tools](./github-tools/) | GitHub 連携ワークフロー支援。PR 作成とドキュメント更新を効率化 |
| [hotl-engineering](./hotl-engineering/) | 人が監督しながらエージェントに開発を任せる（Human-on-the-Loop）ための、ワークフローの設計・適用と開発運営の判断支援。引き継いだリポジトリの整備・品質ゲートの段階導入・自律性の昇格判断・監査対応 |
| [delivery-core](./delivery-core/) | 受託開発のデリバリー上流。PM 運営、要件定義（RDRA・受入基準）、顧客との合意形成、業務設計・サービス設計・システム化範囲の線引き |
| [ai-engineering](./ai-engineering/) | LLM / AI エージェントを含むシステムの設計。エージェント構成、ツール・コンテキスト設計、RAG、LLM の評価、人間の介在点設計 |
| [compliance-core](./compliance-core/) | 受託開発の法規制コンプライアンス。個人情報保護法の実務、OSS ライセンス監査（SBOM）、生成 AI 利用の権利処理。法的助言ではなく実務の型 |
| [design-core](./design-core/) | ノンデザイナー向けのデザイン品質。デザイン4原則による UI / 資料の審査と、提案書・スライド・図解の作成 |
| [indie-product-marketing](./indie-product-marketing/) | 個人開発プロダクトの機会発見、需要検証、海外・多言語向け LP の設計、ローンチ、集客、定着、ユニットエコノミクス（codex-plugins が正本の日本語翻案） |

## 使い方ガイド

「やりたいこと」から入口（コマンド）を探すための索引です。手順の中身は、各プラグインの README と SKILL.md にあります。各表の見出しの括弧内が、そのコマンドを含むプラグインです。入れていないプラグインのコマンドは使えないので、先に `/plugin install <名前>@cc-plugins` で入れます。

### 最初に知っておくこと

1. **入口は2種類です。**
   - ワークフロー（`/dev-core:task` など）: 打ったときだけ動きます。頼んでも自動では始まりません（プラグインの README では「ユーザー起動専用」と書いています）。`/dev-core:code-review` だけは、頼むと自動で使われることもあります。
   - 知識スキル（`/dev-core:verify` など）: 相談の内容に応じて自動で読み込まれることがあります。`/プラグイン名:スキル名` で呼ぶこともでき、引数も渡せます。
2. **自動では使われないことが多いです。** 2026-10 の計測では、dev-core のスキルが使われるべき依頼 11 件のうち、実際に使われたのは 2〜3 件でした（[計測記録](docs/research/skill-reachability-2026-10.md)）。確実に使いたいときは、下の表のコマンドで呼びます。
3. **commit・push・PR・Issue・コメントは、頼んだときだけ行います。** dev-core のワークフローは、フラグ（`--commit`・`--pr`・`--push`・`--issue`・`--comment`）か明示の依頼があるときだけ行います。重要な判断は止まって聞きます。`/github-tools:pr` だけは、打つこと自体が PR 作成の依頼です（既定は draft）。

### 基本の流れ（新機能を1つ作る）

0. （必要なときだけ）方針そのものに迷いがあれば、先に `/dev-core:grill` で検討します。受託案件で要件が固まっていなければ、先に「[受託の上流](#受託の上流delivery-core)」を使います。
1. `/dev-core:task [タスクの概要]` で計画を作ります。計画は `docs/plans/task-<slug>.md` に保存されます。Issue も作るなら `--issue` を付けます。
2. `/dev-core:execute docs/plans/task-<slug>.md --commit` で、計画どおりに TDD で実装して commit します。最後に verify も実行します。PR まで一度に済ませるなら、`--commit` の代わりに `--pr` を付けます（commit・push・PR 作成まで行います）。
3. `--pr` を使わなかったときは、`/github-tools:pr [Issue番号]` で draft の PR を作ります。
4. PR 番号を渡して、2種類のレビューを別々に実行します。組み込みの `/code-review <PR番号>` はバグを広く探し、`/dev-core:code-review <PR番号>` は dev-core の規約（FSD・Clean Architecture・DDD・セキュリティ）に沿っているかを見ます。
5. 指摘を直したら、PR を ready にします。

途中で手を入れたら、`/dev-core:verify` で検証し直します。

分かれ道:

- 小さな修正（1つの振る舞いで済み、計画書が要らない変更）: `/dev-core:tdd [機能名/テスト名]` で、テストファーストで進めます。
- 原因が分からないバグ・落ちているテスト: `/dev-core:debug [症状/エラーメッセージ/Issue番号]` で原因を調べます。修正も頼めば、そのまま TDD で直します。調べても仮説が複数残るときは `/dev-core:debug-team` に切り替えます。E2E（Playwright）のテストなら `/dev-core:e2e [テストファイル] --debug` を使います。

### やりたいこと別の早見表

#### 開発を進める（dev-core）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 新機能の計画を立てたい | `/dev-core:task [タスクの概要] [--issue]` | Issue は `--issue` のときだけ作る |
| 計画を実装したい・再開したい | `/dev-core:execute <計画書のパス> [--commit] [--pr]` | `--pr` だけで commit・push・PR 作成まで行う |
| 1つの振る舞いをテストファーストで作りたい | `/dev-core:tdd [機能名/テスト名] [--red] [--green] [--commit]` | `--red` はテストだけ、`--green` は実装だけ |
| 振る舞いを変えずにコードを整理したい | `/dev-core:refactor [コミット/#PR番号/ブランチ/ファイル] [--commit] [--push]` | 引数なしは未コミットの変更が対象。見つけたバグは直さず報告する |
| 大事な方針を厳しく検討したい | `/dev-core:grill [計画・意思決定・アイデア]` | 1問ずつ聞く。実装も Issue 作成もしない |
| E2E を実行・デバッグしたい | `/dev-core:e2e [テストファイル/ディレクトリ] [--headed] [--debug]` | Playwright が無ければ勝手に取得せず確認する |

#### 検証・デバッグ・レビュー（dev-core と組み込み）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 終わる前に検証したい | `/dev-core:verify [--fix] [--skip-test]` | build・型・lint・テスト・セキュリティ・diff の6段階 |
| バグの原因を調べたい | `/dev-core:debug [症状/エラーメッセージ/Issue番号]` | 同じ経路で3回失敗したら止まって報告する |
| 仮説が複数ある難しいバグを調べたい | `/dev-core:debug-team [症状/Issue番号/エラーメッセージ] [--comment]` | Agent Teams が要る |
| PR や差分のバグを広く探したい | 組み込みの `/code-review [PR番号]` | Claude Code に組み込みのコマンド |
| dev-core の規約で見てほしい | `/dev-core:code-review [PR番号] [ファイルパス] [--strict]` | 引数なしは直近の1コミットと未コミットの変更。`--strict` は確度の低い指摘も個別に出す |
| Codex にも見てほしい | `/dev-core:codex-collab` | 別のプラグイン codex-plugin-cc が要る |
| 同じミスを繰り返さない仕組みを作りたい | `/dev-core:continuous-learning` | 今のセッションから学びを抜き出す |

#### PR とドキュメント（github-tools）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| PR を作りたい | `/github-tools:pr [Issue番号] [--ready] [--body-only]` | 既定は draft。`--body-only` は本文の下書きだけ |
| ドキュメントをコードに合わせたい | `/github-tools:docs` | 引数なし |

#### CI・品質ゲート・リポジトリの整備（hotl-engineering）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 引き継いだリポジトリの開発を回せるようにしたい | `/hotl-engineering:assess [対象リポジトリのパス]` | 現状を調べて計画を出し、そこで止まる |
| CI・品質ゲート・AI レビューを入れたい（まず計画） | `/hotl-engineering:assess [対象リポジトリのパス]` | 同梱のテンプレートから、入れるものと入れないものを決める |
| 合意した計画をリポジトリに適用したい | `/hotl-engineering:apply [対象リポジトリのパス]` | 合意済みの計画が要る（無ければ先に assess）。新しく入れる AI レビューなどの助言的なチェックは、CI を落とさない観測モードで入れる。リポジトリの設定（ruleset など）は、明示的に許可した範囲でだけ、差分を見せてから変える |
| 導入の是非や、エージェントにどこまで任せるかを相談したい | `/hotl-engineering:hotl-engineering` | 相談モードで答える。リポジトリへの適用は assess → apply で行う |

テンプレートを適用した後に設定すること（モデルを指定するリポジトリ変数など）は、[ADJUST.md](hotl-engineering/skills/hotl-engineering/assets/ADJUST.md) にあります。

#### 設計の相談（dev-core の知識スキル）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| TDD・SOLID・FSD/CA/DDD の原則を確かめたい | `/dev-core:best-practices` | セキュリティの原則も含む |
| API・Repository・サービス層を実装したい | `/dev-core:backend-patterns` | 実装のコード例を担当 |
| コンポーネント・状態管理・フォームを設計したい | `/dev-core:frontend-patterns` | フレームワーク非依存 |
| API の契約・バージョニング・エラー応答の形式を決めたい | `/dev-core:interface-contract-design` | 対外の契約と互換性を担当 |
| リトライ・ロック・キャッシュを決めたい | `/dev-core:resilience-design` | 設計判断を担当。コード例は backend-patterns |
| ER 図・マスタ・認証・認可を設計したい | `/dev-core:data-auth-boundary-design` | 物理設計は data-design-ops |
| インデックス・マイグレーションを設計したい | `/dev-core:data-design-ops` | 物理設計と運用を担当 |
| セキュリティ要件・脅威モデルを決めたい | `/dev-core:security-by-design` | 設計と方針を担当 |
| システムの構成を選びたい | `/dev-core:system-architecture-selection` | C4 と ADR も扱う |
| パイプライン・デプロイ戦略・ロールバックを決めたい | `/dev-core:cicd-release-design` | 知識を担当。リポジトリへの導入は hotl-engineering |
| 実行基盤・IaC・ネットワークを決めたい | `/dev-core:cloud-infra-network-design` | apply と DNS の切り替えは人が承認する |
| SLA・SLO・バックアップ・DR を決めたい | `/dev-core:reliability-sla-design` | 保守契約の条件まで扱う |
| 監視・障害報告・運用の引き継ぎを設計したい | `/dev-core:ops-design-handover` | 運用チームへ渡す側。リポジトリを受け取る側は hotl-engineering |
| 移行・カットオーバーを計画したい | `/dev-core:migration-cutover-planning` | Go/No-Go と切り戻しを含む |
| 基本設計（画面一覧・遷移図・バッチ）を作りたい | `/dev-core:external-design-deliverables` | 受託の外部設計の成果物一式 |
| Issue の分解・ラベル・ブランチ戦略・ADR を決めたい | `/dev-core:issue-driven-dev` | ADR と Design Doc の書き分けも扱う |
| 規約を AI に守らせたい | `/dev-core:conventions-as-guardrails` | CLAUDE.md・lint・フックの整備 |
| テストの範囲・観点・検収基準を決めたい | `/dev-core:test-design` | 設計だけ。実行は verify |

この表は入口だけです。dev-core の知識スキルの一覧と説明の正本は、[AGENTS.md のスキルインデックス](AGENTS.md#スキルインデックス)と各 SKILL.md です。

#### 受託の上流（delivery-core）

流れの目安: どこまでシステム化するかを決め（business-service-design）、要件と受入基準を整理します（requirements-definition）。顧客との打ち合わせは、その都度 client-alignment で準備と記録をします。

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| どこまでシステム化するか決めたい | `/delivery-core:business-service-design` | 提案前から要件定義の最初に使う |
| 要件を整理し、受入基準を決めたい | `/delivery-core:requirements-definition` | 要件の承認は人が行う |
| 顧客との打ち合わせを準備し、議事録と決裁者を整理したい | `/delivery-core:client-alignment` | 顧客への送信はしない |
| PM 計画・進捗報告・変更要求を回したい | `/delivery-core:pm-delivery` | 変更の値付けはしない |
| ドメインモデル・用語集・境界を決めたい | `/delivery-core:domain-modeling-strategic` | 業務の詳しい人の参加が要る |
| ペルソナ・カスタマージャーニー・ナビゲーションを設計したい | `/delivery-core:ux-information-design` | 実ユーザーでのテストは人が行う |
| 導入したのに使われない | `/delivery-core:org-change-enablement` | 研修・マニュアル・定着の測定 |

#### AI 機能（ai-engineering）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| AI エージェントや RAG の構成を決めたい | `/ai-engineering:ai-system-design` | 権限の割り当ての承認は人が行う |
| 人の承認をどこに置くか決めたい | `/ai-engineering:human-in-the-loop-design` | AI は自分への承認を代行しない |
| 自分たちの LLM 機能の品質の測り方を決めたい | `/ai-engineering:llm-evals` | 採点方式と、採点役の LLM の較正を担当 |

#### 法務（compliance-core）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 個人情報の区分・委託契約・漏えいの初動 | `/compliance-core:privacy-data-compliance` | 法的助言ではなく実務の型 |
| OSS ライセンスの確認・SBOM | `/compliance-core:oss-license-audit` | 判断の難しいものは人に上げる |
| AI に入力してよいか・AI 生成物の権利 | `/compliance-core:genai-ip-clearance` | 法的助言ではなく実務の型 |

#### デザイン（design-core）

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 画面や資料の見た目をレビューしたい | `/design-core:design-review` | 審査だけ。自分では作らない |
| 配色・フォント・デザイントークンを決めたい | `/design-core:ui-visual-defaults` | コントラストを同梱のスクリプトで確かめる |
| 提案書・スライド・図解を作りたい | `/design-core:business-doc-design` | 金額の判断は扱わない |

#### 個人開発（indie-product-marketing）

流れの目安: アイデアを出して絞り（indie-idea-discovery）、需要を確かめ（indie-product-marketing）、LP を作ります（global-landing-design）。

| やりたいこと | 使うもの | 補足 |
|---|---|---|
| 個人開発のアイデアを出して絞りたい | `/indie-product-marketing:indie-idea-discovery` | 投稿・DM・送信は明示の指示があるときだけ |
| 需要検証・ローンチ・集客・定着 | `/indie-product-marketing:indie-product-marketing` | 出稿・投稿・送信は明示の指示があるときだけ |
| プロダクトの LP を作りたい（海外・多言語向けが得意） | `/indie-product-marketing:global-landing-design` | デプロイ・公開は明示の指示があるときだけ |

### 自動で動くもの（dev-core のフック）

dev-core を入れると、次のものが自動で動きます。何を止め、何を確認に回すかの詳細は [dev-core の README のフック](dev-core/README.md#フックhooks--scripts--自動実行) にあります。

- **セッション開始時**: ブランチ・未コミットの変更・終わっていない計画を Claude に知らせます。
- **コマンドを実行する前**: ルートやホームの削除、main / master への強制 push、DB クライアントでの DROP / TRUNCATE などを止めて `BLOCKED:` と出します。作業ツリーを捨てる git 操作（`git reset --hard` など）は、許可の確認に回します。
- **ファイルを編集した後**: 編集したファイルを整形します（Prettier などの設定があるとき）。
- **Claude が作業を終えるとき**: デバッグの残骸、テストの focus / skip の追加、テストファイルの削除があると、一度だけ差し戻して `Stop quality gate:` と出します。2回目は終われます。

jq が無いと、コマンドの検査・ファイルの整形・作業を終えるときの検査は動きません（セッション開始時に一度知らせます）。どれも抜けのありうる簡易の仕掛けです。確実に止めたい操作は、自分の settings の `permissions.deny` と branch protection で止めます。

### 迷いやすい組み合わせ

| 迷う組 | こうなら | こうなら |
|---|---|---|
| 検証と品質ゲート | 今の作業を確かめる → `/dev-core:verify` | リポジトリの CI に入れる → `/hotl-engineering:assess` |
| レビュー | バグを広く探す → 組み込みの `/code-review` | dev-core の規約に沿っているか → `/dev-core:code-review` |
| AI によるレビュー | 手元で Codex に見てもらう → `/dev-core:codex-collab` | CI で PR ごとに動かす → `/hotl-engineering:assess`（同梱の AI レビュー） |
| CI | 落ちたのを直す → `/dev-core:debug` | 設計して整備する → `/hotl-engineering:assess`（デプロイ戦略の知識は `/dev-core:cicd-release-design`） |
| 改善・計画 | コードを整理する → `/dev-core:refactor`。1つの機能を計画する → `/dev-core:task` | 開発フローや体制を整える → 相談は `/hotl-engineering:hotl-engineering`、リポジトリに入れるなら `/hotl-engineering:assess` |
| 評価（eval） | 自分たちの LLM 機能の品質の測り方 → `/ai-engineering:llm-evals` | 評価を CI のゲートにする → `/hotl-engineering:assess` |
| セキュリティ | 要件・脅威モデル・方針を決める → `/dev-core:security-by-design` | 変更を規約で確かめる → `/dev-core:code-review`（権限や秘密情報に触れる変更は、execute が security-auditor エージェントにも監査させる） |
| 引き継ぎ | リポジトリを受け取って開発を回す → `/hotl-engineering:assess` | 運用を運用チームへ渡す設計 → `/dev-core:ops-design-handover` |
| 見た目 | 審査する → `/design-core:design-review`。トークンを決める → `/design-core:ui-visual-defaults` | UI を作る → 外部の ui-ux-pro-max（「[外部プラグインとの併用](#外部プラグインとの併用)」）。個人開発の LP → `/indie-product-marketing:global-landing-design` |
| 受託の要件 | どこまでシステム化するか → `/delivery-core:business-service-design` | 要件と受入基準 → `/delivery-core:requirements-definition` |

hotl-engineering と dev-core の振り分けの詳細は、[hotl-engineering/docs/trigger-boundaries.md](hotl-engineering/docs/trigger-boundaries.md) にあります。

### うまく動かないとき

- **スキルが使われない**: `/プラグイン名:スキル名` で呼びます。入れたスキルが多いと、一覧に載る説明が省かれて自動では選ばれにくくなります。`/skill-doctor` で確かめます（「[常時コストと共存の設定](#常時コストと共存の設定)」）。
- **「計画して」と頼んでも task が動かない**: ワークフローは打ったときだけ動きます。コマンドを打ちます。
- **`BLOCKED:` と出た**: フックが止めました。Claude に言い換えて再実行させないでください。本当に必要な操作なら、内容を確かめてから、ユーザー自身がターミナルで実行します。
- **許可の確認が出た**（`git reset --hard` など）: 消えてよい変更かを確かめてから答えます。
- **`Stop quality gate:` と出た**: デバッグの残骸やテストの skip などがあります。取り除くか、残す理由を報告させます。
- **commit や PR がされない**: 既定ではしません。`--commit`・`--pr`・`--push` を付けます。
- **execute が止まった**: 判断待ちか、先に進めない状態です。どちらなのかと次にすることは、計画書の Current Next Action にあります。判断待ちなら、聞かれたことに会話で答えます。先に進めない状態なら、その原因を先に取り除きます。新しいセッションで続けるときは、同じ計画書のパスと、最初に付けたフラグ（`--commit`・`--pr`）で `/dev-core:execute` を実行します。
- **debug-team が使えない**: Agent Teams が使えない環境です（環境によっては設定で有効にします）。`/dev-core:debug` を使います。
- **verify が検証コマンドを見つけられない**: `.claude/dev-core.local.md` にコマンドを書きます（[dev-core のプロジェクト設定](dev-core/README.md#プロジェクト設定)）。
- **`/codex:*` が無い**: codex-collab に必要な codex-plugin-cc（OpenAI 公式）が入っていません。入れ方は [codex-collab の SKILL.md](dev-core/skills/codex-collab/SKILL.md) にあります。

### Codex で使う

Codex では、英語に翻案した [codex-plugins](https://github.com/tadokoro-ryusuke/codex-plugins) を使うのが基本です。

```bash
codex plugin marketplace add tadokoro-ryusuke/codex-plugins
codex plugin add dev-core@codex-plugins
```

- 入れた後は、新しいスレッドを始めます。
- 更新するときは、`codex plugin marketplace upgrade codex-plugins` でマーケットプレイスを更新してから、`codex plugin add <名前>@codex-plugins` で入れ直し、新しいスレッドを始めます。
- スキルは `$名前` で呼びます（例: `Use $dev-task to ...`）。依頼の文は日本語でも構いません。
- codex-plugins にあるのは dev-core・github-tools・hotl-engineering・indie-product-marketing・ui-ux-pro-max です。delivery-core・ai-engineering・compliance-core・design-core には Codex 版がありません。

| Claude Code | Codex |
|---|---|
| `/dev-core:grill` | `$dev-grill` |
| `/dev-core:task` | `$dev-task` |
| `/dev-core:execute`（計画からの再開も） | `$dev-execute`（`--commit`・`--pr` のフラグは無い。依頼の文で頼む） |
| `/dev-core:tdd`・`/dev-core:refactor`・`/dev-core:e2e` | `$dev-tdd`・`$dev-refactor`・`$dev-e2e` |
| `/dev-core:code-review` | `$dev-review`（振る舞いや保守性まで見る） |
| `/dev-core:verify` | `$verification-loop` |
| `/dev-core:debug` | `$dev-debug` |
| `/dev-core:debug-team` | なし |
| なし | `$dev-checkpoint`（中断・引き継ぎのときに状態を記録して戻す） |
| なし | `$dev-workflow`（合う dev-* が無い、段階の多い開発をまとめて進める） |
| `/github-tools:pr`・`/github-tools:docs` | `$github-workflows` |
| `/hotl-engineering:assess`・`/hotl-engineering:apply` | `$hotl-engineering`（計画で止めたいときは、依頼の文でそう頼む） |

- Codex 版 dev-core には、次の設計の知識スキルがありません: cloud-infra-network-design、data-auth-boundary-design、data-design-ops、interface-contract-design、migration-cutover-planning、ops-design-handover、reliability-sla-design、resilience-design、security-by-design、system-architecture-selection。cc-plugins の日本語のスキルを Codex から使う方法は [docs/codex-interop/shared-skills-setup.md](docs/codex-interop/shared-skills-setup.md) にあります。
- Codex のフックは、セッション開始時とコマンドの実行前（拒否）だけです。`git reset --hard` と `git clean -f` は、確認ではなく拒否されます。`git restore .`・`git branch -D` などは検査しません。ファイルの整形と、作業を終えるときの検査はありません。

### 詳しく知りたいとき

- dev-core: [README](dev-core/README.md)。effort の決め方は「[Opus 5.5 での運用](dev-core/README.md#opus-55-での運用)」、`.claude/dev-core.local.md` は「[プロジェクト設定](dev-core/README.md#プロジェクト設定)」にあります。
- hotl-engineering: [README](hotl-engineering/README.md) と、テンプレートの置換ポイントの一覧 [ADJUST.md](hotl-engineering/skills/hotl-engineering/assets/ADJUST.md)
- github-tools: [README](github-tools/README.md)
- indie-product-marketing: [README](indie-product-marketing/README.md)
- README の無いプラグイン（delivery-core・ai-engineering・compliance-core・design-core）: 各 `skills/<skill>/SKILL.md`
- dev-core の知識スキルの全一覧: [AGENTS.md のスキルインデックス](AGENTS.md#スキルインデックス)

## 外部プラグインとの併用

ui-ux-pro-max は、マーケットプレイスの 6.0.0 でこのマーケットプレイスから外しました。使う場合は上流の公式プラグインを入れます。
旧版（`ui-ux-pro-max@cc-plugins`）を入れている場合は、同じ名前空間 `ui-ux-pro-max:*` が重ならないよう、先に外します。

```
/plugin uninstall ui-ux-pro-max@cc-plugins
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

スキル ID `ui-ux-pro-max:ui-ux-pro-max` は公式版でも同じなので、各スキルからの参照（「導入されていれば」）はそのまま使えます。
公式版はスキルを複数同梱します。design-core と発火が重なりうるので、使わないスキルは無効にすることを検討します。

## 常時コストと共存の設定

インストールしたプラグインのスキルは、呼び出さなくても、名前と説明が毎ターンのコンテキストに入ります。自前のマーケットプレイスでは `/plugin` にコストの欄が出ないので、目安をここに置きます。

| プラグイン | 常時コストの目安 |
|-----------|----------------|
| dev-core | 約 5.5k トークン（エージェントの説明 約 0.7k を含む） |
| github-tools | ほぼ 0（スキルはすべて手動起動専用） |
| hotl-engineering | 約 0.7k |
| delivery-core | 約 1.7k |
| ai-engineering | 約 0.7k |
| compliance-core | 約 0.9k |
| design-core | 約 1.1k |
| indie-product-marketing | 約 1.3k |

計測は 2026-10-26、Claude Code 2.1.310 です。方法と版ごとの内訳は [計測記録](docs/research/skill-reachability-2026-10.md) にあります。版を上げたら測り直します。

他のプラグインのスキルへの参照（`dev-core:*` など）はポインタです。参照先を入れていなくても、各スキルは単体で使えます。

スキルが増えて説明が落ちたときは、次の順で確かめて調整します。スキルの一覧には予算（既定はコンテキストの 1%）があり、超えると呼び出しの少ないスキルから説明が落ちます。

1. 確かめる: `/skill-doctor`（2.1.252 以上）で、スキルごとのコストと使われ方、使っていないスキルを見る。`/doctor` で一覧の推定と大きな寄与元を、`/context` の Skills 行で予算を適用した後の大きさを見る。
2. 減らす: 使っていないプラグインを `/plugin` で無効にする。プラグインのスキルは `skillOverrides` の対象外。
3. それでも要るスキルの説明が落ちるときだけ、予算を上げる: `skillListingBudgetFraction`（例: `0.02` で 2%）か、文字数で固定する `SLASH_COMMAND_TOOL_CHAR_BUDGET`。上げた分だけ毎ターンのコストが増える。

出典（2026-10-26 確認）: [Skills の Skill descriptions are cut short と Find unused skills](https://code.claude.com/docs/en/skills)

## リポジトリ構成

```
cc-plugins/
├── .claude-plugin/marketplace.json   # マーケットプレイス定義
├── AGENTS.md                         # ツール非依存の知識正本（スキルインデックス）
├── CLAUDE.md                         # Claude Code 固有の薄いラッパ（@AGENTS.md を import）
├── dev-core/                         # メインプラグイン
├── github-tools/
├── hotl-engineering/                 # HOTL 開発運営スキル（テンプレ・eval 雛形同梱）
├── delivery-core/                    # 受託開発のデリバリー上流（PM・要件定義・合意形成）
├── ai-engineering/                   # LLM / AI エージェントを含むシステムの設計
├── compliance-core/                  # 法規制コンプライアンスの実務
├── design-core/                      # デザイン品質の審査と資料作成
├── indie-product-marketing/          # 個人開発プロダクトの機会発見・需要検証・LP・グロース
├── docs/codex-interop/               # Codex との相互運用ガイド
├── docs/research/                    # 設計判断の調査記録
└── scripts/                          # drift 検証・eval の生成・発火の計測・共有スキルセットアップ
```

## 設計原則

- **Single Source of Truth**: 知識本体はスキル（`dev-core/skills/<skill>/SKILL.md`）に置き、二重管理しない。バージョン・メタデータの正本は各プラグインの `.claude-plugin/plugin.json`
- **Codex 互換**: dev-core の知識スキルは Agent Skills 標準準拠で、Claude Code と Codex の双方から同一実体を参照する（詳細: [docs/codex-interop/](./docs/codex-interop/)）
- **継続的検証**: 構成 drift、behavior eval schema、Claude hook event互換性、公式 plugin validation を CI で検証する
- **調査根拠**: 自律ワークフローへ採用した外部実践と採用しなかった設計は [docs/research/autonomous-development-workflows.md](./docs/research/autonomous-development-workflows.md) に、Opus 5.5 に合わせた実行トポロジーと effort の方針は [docs/research/opus-5-5-plugin-strategy.md](./docs/research/opus-5-5-plugin-strategy.md) に記録する

## 開発

プラグイン・スキル・マニフェストを変えたら、コミット前に [AGENTS.md の検証コマンド](AGENTS.md#検証コマンド) を実行します。CI で回しているものの一覧は [.github/workflows/skills-drift-check.yml](.github/workflows/skills-drift-check.yml) にあります。

スキルが実際に使われるかを測るときは、次を使います（費用がかかるので CI では回しません。方法と前回の結果は [計測記録](docs/research/skill-reachability-2026-10.md)）。

- `node scripts/gen-plugin-evals.mjs --plugin <名前> [--behavior]`: 行動ケース（`<名前>/evals/skill-behavior-cases.json`。今は dev-core と indie-product-marketing）から `claude plugin eval` のケースを作る。
- `node scripts/measure-skill-firing.mjs --plugin <名前> --model <固定> [--dry-run]`: 実際のインストール構成で、どのスキルが使われるかを測る。

## ライセンス

[MIT](./LICENSE)
