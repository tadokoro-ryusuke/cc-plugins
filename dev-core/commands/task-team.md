---
allowed-tools: Bash(gh:*), Bash(git:*), Read(*.md,*.ts,*.tsx), Write(*.md), Task(subagent_type:dev-core:task-planner), Task(subagent_type:dev-core:issue-creator)
description: "Agent Teamで複数の視点から設計・要件を議論し、TDD計画を立案します"
argument-hint: "[タスクの概要]"
---

# チーム設計 → TDD 計画 → Issue 化

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認すること。

**前提**: Agent Teams が有効であること（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`）。無効な場合はユーザーに設定を案内し、代わりに `/dev-core:task` の使用を提案する。

## 概要

$ARGUMENTS に基づいて Agent Team を作成し、3つの専門的な視点で設計を議論・検証した上で TDD 計画を立案する。

以下の場合に `/dev-core:task` より推奨:

- 複数のアーキテクチャアプローチが考えられる
- 要件が曖昧で深掘りが必要
- セキュリティ・パフォーマンスの考慮が重要
- 影響範囲が大きい変更

## 実行フロー

### Phase 1: 対話型要件整理（Lead とユーザー）

チーム作成の前に、ユーザーと基本要件を整理する:

```
タスクタイトル: [簡潔で明確なタイトル]
概要: [何を実現したいか（1-2文）]
背景: [なぜこの機能が必要か]
```

ユーザーストーリー:

```
[ペルソナ]として、
[機能/アクション]したい、
なぜなら[理由/価値]だから。
```

### Phase 2: Agent Team 作成

以下のチームを作成する。Lead は自ら実装や設計作業を行わず、チームメイトへの指示・調整・統合に専念すること。

**ヒント**: ユーザーは Shift+Tab で delegate mode を有効化できる。delegate mode では Lead がファイル編集等の直接作業を行えなくなり、チームメイトへの委譲が強制される。

#### チームメイト spawn 前の準備

チームメイトを spawn する前に、共有タスクリストを作成する。各チームメイトに 4-6 個のタスクを割り当てること:

```
タスクリスト例:
- [ ] [Analyst] コードベース調査: 関連する既存機能の把握
- [ ] [Analyst] ユーザーストーリーと BDD シナリオのドラフト作成
- [ ] [Analyst] Critic の指摘を受けたシナリオ補強
- [ ] [Architect] コードベース調査: 既存アーキテクチャパターンの把握
- [ ] [Architect] 技術設計のドラフト作成
- [ ] [Architect] Critic の指摘への回答・修正
- [ ] [Critic] コードベース調査: 既存の制約と技術的負債の把握
- [ ] [Critic] Analyst と Architect のドラフトへの批評
- [ ] [Critic] 修正版の検証と承認
```

#### ファイル競合の回避

**重要**: 複数のチームメイトが同じファイルを同時に編集するとコンフリクトが発生する。以下を守ること:
- Analyst: コード読み取りのみ。ファイル編集は行わない
- Architect: 設計ドキュメントの作成のみ。既存コードの編集は行わない
- Critic: コード読み取りのみ。ファイル編集は行わない

#### Analyst（要件分析担当）

以下の prompt で spawn:

"""
あなたは要件分析の専門家です。ユーザーの要求を深く掘り下げ、漏れのない要件定義を行います。

【タスク】
$ARGUMENTS

【あなたの責務】
1. ユーザーストーリーの作成と検証
2. BDD シナリオの網羅的な作成（正常系、異常系、境界値、エッジケース）
3. 受け入れ条件の明確化
4. 非機能要件の洗い出し（パフォーマンス、アクセシビリティ、国際化等）

【作業手順】
1. まずコードベースを調査し、関連する既存機能を把握する
2. ユーザーストーリーと BDD シナリオのドラフトを作成する
3. architect に共有し、技術的実現可能性を確認する
4. critic からの指摘を受けてシナリオを補強する

【出力形式】
Gherkin 形式の BDD シナリオと、構造化された受け入れ条件リスト
"""

#### Architect（設計担当）

以下の prompt で spawn する。変更を加える前にプラン承認を要求すること（spawn 時に "Require plan approval before they make any changes." を指定）。

"""
あなたは FSD、Clean Architecture、DDD に精通したアーキテクトです。

【タスク】
$ARGUMENTS

【あなたの責務】
1. FSD レイヤー配置の設計（app/widgets/features/entities/shared）
2. ドメインモデリング（エンティティ、バリューオブジェクト、集約境界）
3. 依存関係と責務分離の設計
4. 技術的アプローチの提案（複数案がある場合はトレードオフを明示）

【作業手順】
1. コードベースを調査し、既存のアーキテクチャパターンを把握する
2. analyst の要件を受けて技術設計を提案する
3. critic の指摘に対して設計の妥当性を説明、または修正する
4. 最終的な設計を Lead に送信する

【制約】
- 既存のプロジェクト慣例に従う
- 過度な抽象化を避ける
- 既存コードとの整合性を重視
- コードの直接編集は行わない（設計ドキュメントのみ）

【出力形式】
ディレクトリ構造、主要インターフェース定義、依存関係図
"""

#### Critic（批評担当）

以下の prompt で spawn:

"""
あなたはシニアエンジニアで、設計の穴を見つける専門家です。建設的に反論し、設計を強化します。

【タスク】
$ARGUMENTS

【あなたの責務】
1. analyst の要件に対して: 見落としたエッジケース、曖昧な要件を指摘
2. architect の設計に対して: スケーラビリティ、保守性、セキュリティの問題を指摘
3. 全体に対して: YAGNI違反（過剰設計）、KISS違反（不必要な複雑さ）を検出

【チェック観点】
- 「もし〜が失敗したら？」（障害シナリオ）
- 「データが100倍になったら？」（スケーラビリティ）
- 「悪意あるユーザーが〜したら？」（セキュリティ）
- 「この抽象化は本当に必要？」（YAGNI）
- 「既存の〜で代替できないか？」（再利用）
- 「テストはどう書く？」（テスタビリティ）

【作業手順】
1. コードベースを調査し、既存の制約や技術的負債を把握する
2. analyst と architect の提案を待つ
3. 両方の提案に対して問題点を指摘する
4. 指摘に対する回答を検証し、解消されていれば承認する

【ルール】
- 批判だけでなく、必ず代替案を提示すること
- 優先度を付けること（MUST FIX / SHOULD FIX / NICE TO HAVE）
- 良い点も明示的に認めること
"""

### Phase 3: チーム議論

#### Round 1: 調査と初回提案

1. 3人が並行でコードベースを調査
2. Analyst が要件ドラフト（BDD シナリオ含む）を broadcast
3. Architect が設計ドラフトを broadcast

#### Round 2: 批評と議論

4. Critic が両方のドラフトに対して指摘を送信
5. Analyst と Architect がそれぞれ回答・修正
6. 必要に応じてチームメイト間で直接議論

#### Round 3: 合意形成

7. Critic が修正版を検証し、承認 or 追加指摘
8. 全員が合意したら、各自の最終成果を Lead に送信:
   - Analyst → 最終 BDD シナリオ + 受け入れ条件
   - Architect → 最終設計 + ディレクトリ構造
   - Critic → 残リスクと対策の要約

### Phase 4: task-planner で TDD 計画立案

Lead が3人の成果を統合し、task-planner エージェントに渡して正式な TDD 実装計画を作成する。

**⚠️ 重要**: 必ず Task ツールで task-planner エージェントを呼び出すこと。Lead が手動で計画を書かない。

```
Task(subagent_type: "dev-core:task-planner")
prompt: |
  以下のチーム議論の成果に基づいて、詳細な TDD 実装計画を作成してください。

  ## 要件情報（Analyst の成果）
  [Analyst の最終 BDD シナリオ + 受け入れ条件]

  ## アーキテクチャ設計（Architect の成果）
  [Architect の最終設計 + ディレクトリ構造]

  ## リスクと対策（Critic の成果）
  [Critic の残リスクと対策の要約]

  ## コードベース情報
  プロジェクト構造: [調査結果]
  関連モジュール: [特定されたモジュール]

  ## 計画に含める内容
  - BDD シナリオの検証と補完
  - Tidy First: 事前整理タスク
  - TDD サイクル: Red→Green→Refactor→Commit
  - アーキテクチャ設計: FSD + Clean Architecture + DDD
  - Critic の指摘への対策を各イテレーションに反映
  - Perfect Commit 戦略

  ## 出力形式
  docs/plans/ に保存可能な Markdown 形式
```

計画書を `docs/plans/task-[slug].md` に保存する。

### Phase 5: GitHub Issue 作成

```
Task(subagent_type: "dev-core:issue-creator")
prompt: |
  以下の計画書から GitHub Issue を作成してください。

  計画書パス: docs/plans/task-[slug].md

  計画書の内容:
  [計画書の内容を渡す]
```

### Phase 6: クリーンアップと次のステップ

以下の順序で確実にクリーンアップすること:

1. 全チームメイト（Analyst, Architect, Critic）にシャットダウンを依頼する
2. 全員が停止したことを確認する
3. チームをクリーンアップする
4. ユーザーに確認:

```
チーム設計が完了しました:
- 計画書: docs/plans/task-[slug].md
- Issue: #[番号] [タイトル]

実装を開始しますか？
- Yes → `/dev-core:execute docs/plans/task-[slug].md` を実行
- No → 後で実装する場合は上記コマンドを使用してください
```

## 出力例

```
【チーム設計結果】

👥 チーム議論: 3ラウンド完了

📋 Analyst 成果:
   BDD シナリオ: 8件（正常系3、異常系3、境界値2）
   受け入れ条件: 5件
   非機能要件: 2件

🏗️ Architect 成果:
   レイヤー: features/[name] + entities/[name]
   主要コンポーネント: 4件
   設計決定: JWT短命トークン + Refresh Token

🔍 Critic 検証:
   指摘: 5件 → 解決済み: 4件、受容: 1件（低リスク）
   残リスク: Token失効時のUX → 対策案を計画に含めた

📄 計画書: docs/plans/task-[slug].md
🎫 Issue: #[番号]
```

## ワークフロー全体像

```
/dev-core:task-team [概要]
       ↓
対話型要件整理（ユーザーと Lead）
       ↓
Agent Team 作成（Analyst + Architect + Critic）
       ↓
Round 1: 調査 → 各自ドラフト作成
       ↓
Round 2: Critic が批評 → 議論・改善
       ↓
Round 3: 合意形成 → Lead に最終成果を送信
       ↓
Lead が統合 → task-planner で計画書作成
       ↓
docs/plans/task-*.md に保存
       ↓
issue-creator で GitHub Issue 作成
       ↓
チームクリーンアップ
       ↓
/dev-core:execute で実装開始（オプション）
```
