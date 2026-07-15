---
name: task-team
description: "Agent Teamで複数の視点（要件分析・設計・批評）から設計を議論し、証拠付きTDD計画を立案する。選択肢が複数ある・要件が曖昧・影響範囲が大きいタスクで /dev-core:task-team を使う。Issueは --issue 指定時だけ作成する。"
argument-hint: "[タスクの概要] [--issue]"
disable-model-invocation: true
allowed-tools: Read, Write(*.md), Task(subagent_type:dev-core:task-planner)
---

# チーム設計 → 証拠付き TDD 計画

**重要**: 開始前に `dev-core:best-practices` スキルをロードすること。

**前提**: Agent Teams が利用可能であること（環境によっては設定での有効化が必要）。利用できない場合は代わりに `/dev-core:task` の使用を提案する。

## 概要

最初に `$ARGUMENTS` から `--issue` を delivery flag として分離し、残りを `TASK_INPUT` とする。`TASK_INPUT` に基づいて Agent Team を作成し、3 つの専門的な視点（要件分析・設計・批評）で議論・検証した上で TDD 計画を立案する。

以下の場合に `/dev-core:task` より推奨:

- 複数のアーキテクチャアプローチが考えられる
- 要件が曖昧で深掘りが必要
- セキュリティ・パフォーマンスの考慮が重要
- 影響範囲が大きい変更

## 実行フロー

### Phase 1: 調査と要件整理（Lead とユーザー）

チーム作成の前にリポジトリ、既存テスト、実行コマンドを調査する。環境から確認できる事実は質問せず、可逆な仮定は推奨デフォルトで進め、重要判断だけをユーザーと整理する:

- タスクタイトル: 簡潔で明確なタイトル
- 概要: 何を実現したいか（1-2文）
- 背景: なぜこの機能が必要か
- ユーザーストーリー: 「[ペルソナ]として、[機能]したい、なぜなら[理由]だから」

### Phase 2: Agent Team 作成と作業開始

**delegate mode を推奨**: ユーザーに Shift+Tab での delegate mode 有効化を案内する。delegate mode では Lead がファイル編集等の直接作業を行えなくなり、チームメイトへの委譲が強制される。Lead は自ら実装や設計作業を行わず、チームメイトへの指示・調整・統合に専念する。

#### タスクリストの作成

チームメイトを spawn する前に、共有タスクリストを作成する。チームメイト 1 人あたり 5-6 個のタスクを作成し、依存関係を設定する。タスクは自己完結的で明確な成果物を持つこと。

タスク設計の指針:
- Analyst のタスク: コードベース調査、ユーザーストーリー作成、BDD シナリオ作成（正常系・異常系・境界値・エッジケース）、受け入れ条件定義、非機能要件洗い出し、指摘反映後の最終版作成
- Architect のタスク: 既存パターン調査、FSD レイヤー設計、ドメインモデリング、技術アプローチ提案（トレードオフ明示）、インターフェース定義、指摘反映後の最終版作成
- Critic のタスク: 技術的負債調査、要件レビュー、設計レビュー、YAGNI/KISS 検証、修正版検証、残リスクまとめ

依存関係の設定: Critic のレビュータスクは Analyst と Architect のドラフト完了後にアンブロックされるよう設定する。

#### ファイル競合の回避

全チームメイトはコードの読み取りのみ。ファイル編集は行わない。

#### チームメイトの spawn

3 人のチームメイトを spawn する。プロジェクトコンテキスト（CLAUDE.md、MCP サーバー、スキル等）は自動で読み込まれるため、spawn プロンプトにはタスク固有の情報だけを簡潔に渡す。

**Analyst（要件分析担当）** — spawn プロンプト:

```
「$TASK_INPUT」の要件分析を担当してください。

コードベースを調査し、関連する既存機能を把握した上で以下を作成:
- ユーザーストーリー
- BDD シナリオ（Gherkin 形式、正常系・異常系・境界値・エッジケース）
- 受け入れ条件
- 非機能要件（パフォーマンス、アクセシビリティ、国際化等）

完了したら architect と critic に共有してください。critic の指摘を受けて改善し、最終版を Lead に報告してください。
ファイルは編集せず、読み取り調査と報告だけを行ってください。
```

**Architect（設計担当）** — plan approval を要求して spawn:

```
「$TASK_INPUT」の技術設計を担当してください。

FSD・Clean Architecture・DDD に基づき、コードベースの既存パターンを調査した上で以下を設計:
- FSD レイヤー配置（app/widgets/features/entities/shared）
- ドメインモデル（エンティティ、バリューオブジェクト、集約境界）
- 依存関係と責務分離
- 技術アプローチ（複数案がある場合はトレードオフを明示）

analyst の要件と critic の指摘を踏まえて設計を改善し、最終版を Lead に報告してください。
ファイルの編集は行わず、設計の提案のみ行ってください。
```

**Critic（批評担当）** — spawn プロンプト:

```
シニアエンジニアとして「$TASK_INPUT」の要件と設計を批評してください。

analyst の BDD シナリオと architect の設計が出揃ったらレビューを開始。
チェック観点:
- 見落としたエッジケース、曖昧な要件
- スケーラビリティ、保守性、セキュリティの問題
- YAGNI 違反（過剰設計）、KISS 違反（不必要な複雑さ）
- テスタビリティ

批判だけでなく代替案も提示し、優先度を付けること（MUST FIX / SHOULD FIX / NICE TO HAVE）。
良い点も明示的に認めること。修正版を検証し、問題が解消されていれば承認してください。
最終的に残リスクと対策の要約を Lead に報告してください。
ファイルは編集せず、読み取り調査と報告だけを行ってください。
```

#### チームの運営

チームメイトは共有タスクリストから自律的にタスクをクレームして進める。Lead は以下に専念する:

- チームメイトの進捗を監視する
- 行き詰まっている場合は追加の指示やコンテキストを提供する
- チームメイト間の議論が停滞している場合は仲介する
- **チームメイトの作業完了を待つ**。Lead が自ら実装を始めない
- 全員の成果が揃ったら、最終成果を Lead に送信するよう依頼する:
  - Analyst → 最終 BDD シナリオ + 受け入れ条件
  - Architect → 最終設計 + ディレクトリ構造
  - Critic → 残リスクと対策の要約

### Phase 3: task-planner で TDD 計画立案

Lead がチームメイトの成果を統合し、Task ツールで `dev-core:task-planner` エージェントを呼び出して正式な TDD 実装計画を作成する。**Lead が手動で計画を書かないこと。**

task-planner に渡す情報:

- Analyst の最終 BDD シナリオ + 受け入れ条件
- Architect の最終設計 + ディレクトリ構造
- Critic の残リスクと対策の要約
- コードベース情報（調査で判明した構造・関連モジュール）

計画に含める内容:

- BDD シナリオの検証と補完
- Tidy First: 事前整理タスク
- TDD サイクル: Red→Green→Refactor→Evidence
- アーキテクチャ設計: FSD + Clean Architecture + DDD
- Critic の指摘への対策を各イテレーションに反映
- Completion Contract（全条件 pending、必要証拠を明記）
- Evidence Baseline、Progress Log、Decision Log、Blockers And Open Questions、Current Next Action
- 先頭metadataの正準行 `- Status: draft`（許容値 `draft | approved | in-progress | blocked | done`）と Risks And Stop Conditions
- Delivery Strategy（commit/push/Issue/PR は明示依頼がなければ not requested）

計画書を `docs/plans/task-[slug].md` に保存する。

### Phase 4: Optional GitHub Issue

`--issue` があるか、ユーザーが明示的に依頼した場合だけ `dev-core:issue-creator` を呼び出し、計画書から GitHub Issue を作成する。

### Phase 5: クリーンアップと次のステップ

以下の順序で確実にクリーンアップすること:

1. 全チームメイト（Analyst, Architect, Critic）に shutdown_request を送信する
2. 全員が停止したことを確認する（停止前にシャットダウンを承認/拒否する機会がある）
3. TeamDelete でチームリソースをクリーンアップする
4. ユーザーに結果を報告:

```
チーム設計が完了しました:
- 計画書: docs/plans/task-[slug].md
- Issue: #[番号] [タイトル]（作成を依頼された場合のみ）

次のアクション: `/dev-core:execute docs/plans/task-[slug].md`
```

## 注意事項

- **コンテキストの分離**: チームメイトは Lead の会話履歴を引き継がない。spawn プロンプトに必要な情報を含めること
- **読み取り専用**: 全チームメイトはコード読み取りのみ。ファイル編集は行わない
- **タスク状態の確認**: チームメイトがタスク完了をマークし忘れることがある。タスクが止まっているように見える場合は確認すること
- **セッション復元不可**: `/resume` でチームメイトは復元されない。再開が必要な場合は新しくチームを作成する
- **1 セッション 1 チーム**: 同時に複数のチームは管理できない
