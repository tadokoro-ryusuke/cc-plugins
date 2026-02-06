---
allowed-tools: Bash(git:*), Bash(gh:*), Read(*.md,*.ts,*.tsx,*.js,*.jsx,*.py,*.log,*.json), Grep, Glob, Write(*.md)
description: "Agent Teamで複数の仮説を並行検証し、バグの根本原因を特定します"
argument-hint: "[バグの症状/Issue番号/エラーメッセージ]"
---

# デバッグ調査チーム

**前提**: Agent Teams が有効であること（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`）。無効な場合はユーザーに設定を案内する。

## 概要

$ARGUMENTS の問題について、複数の調査員が異なる仮説を並行で検証し、互いに反証し合うことで根本原因を特定する。

1人で調査すると最初に見つけた仮説にバイアスがかかる。独立した調査 + 相互反証で、より正確な原因特定ができる。

## 実行フロー

### Phase 1: 症状の整理（Lead とユーザー）

チーム作成の前に、問題の情報を整理する:

```
症状: [何が起きているか]
再現手順: [どうすれば再現するか]
影響範囲: [どこで発生するか]
発生頻度: [常に/時々/特定条件で]
最近の変更: [直近で変更したコード]
```

Issue 番号がある場合は `gh issue view` で詳細を取得する。
エラーログがある場合は関連箇所を抽出する。

### Phase 2: 仮説の立案（Lead）

症状から考えられる仮説を 3 つ立てる。仮説は互いに独立していること:

```
仮説A: [例: データベース接続プールの枯渇]
仮説B: [例: レースコンディション]
仮説C: [例: 外部APIタイムアウトの連鎖]
```

ユーザーに仮説を提示し、追加・修正を確認する。

### Phase 3: Agent Team 作成

以下のチームを作成する。Lead は自ら調査作業を行わず、チームメイトへの指示・調整・統合に専念すること。

**ヒント**: ユーザーは Shift+Tab で delegate mode を有効化できる。delegate mode では Lead がファイル編集等の直接作業を行えなくなり、チームメイトへの委譲が強制される。

#### チームメイト spawn 前の準備

チームメイトを spawn する前に、共有タスクリストを作成する。各 Investigator に 4-5 個のタスクを割り当てること:

```
タスクリスト例:
- [ ] [Investigator A] 仮説A に関連するコードの特定
- [ ] [Investigator A] 仮説A を支持/反証する証拠の収集
- [ ] [Investigator A] 他の Investigator の結果への反論/補強
- [ ] [Investigator B] 仮説B に関連するコードの特定
- [ ] [Investigator B] 仮説B を支持/反証する証拠の収集
- [ ] [Investigator B] 他の Investigator の結果への反論/補強
- [ ] [Investigator C] 仮説C に関連するコードの特定
- [ ] [Investigator C] 仮説C を支持/反証する証拠の収集
- [ ] [Investigator C] 他の Investigator の結果への反論/補強
```

#### ファイル競合の回避

**重要**: 全 Investigator は読み取り専用で調査を行うこと。コードの編集は一切行わない。修正は調査完了後に Lead が別途対応する。

#### Investigator の spawn

3人の Investigator を spawn する。各 Investigator には以下の**共通テンプレート**を使い、【あなたの仮説】だけを仮説A/B/C に差し替えること:

"""
あなたはバグ調査の専門家です。以下の仮説を検証してください。

【問題の症状】
$ARGUMENTS

【あなたの仮説】
[ここに担当する仮説を記載]

【調査手順】
1. コードベースで仮説に関連するコードを特定する
2. 関連するログ、設定、テストを調査する
3. 仮説を支持する証拠と反する証拠の両方を集める
4. 他の investigator の仮説に対して反論できる証拠があれば共有する

【出力形式】
INVESTIGATION_RESULT:
  hypothesis: [仮説の要約]
  evidence_for:
    - [支持する証拠1]
    - [支持する証拠2]
  evidence_against:
    - [反する証拠1]
  confidence: [HIGH/MEDIUM/LOW]
  root_cause: [特定できた場合の根本原因]
  fix_suggestion: [修正案]

【ルール】
- 確証バイアスに注意: 反する証拠も必ず探すこと
- 他の investigator の発見に対して、自分の調査結果から反論や補強を行うこと
- 証拠がないのに結論を出さないこと
"""

spawn 例:
- Investigator A: 【あなたの仮説】= 仮説A の内容
- Investigator B: 【あなたの仮説】= 仮説B の内容
- Investigator C: 【あなたの仮説】= 仮説C の内容

### Phase 4: 調査と議論

#### Round 1: 独立調査

1. 3人が並行でコードベースを調査
2. 各自が証拠を集めて INVESTIGATION_RESULT を broadcast

#### Round 2: 相互反証

3. 各 investigator が他の2人の結果を検証
4. 反論: 「その証拠はこう解釈すべきでは？」
5. 補強: 「自分の調査でもそれを裏付ける証拠を見つけた」
6. 新発見: 「調査中に第4の可能性を発見した」

#### Round 3: 合意形成

7. 最も証拠が強い仮説に収束する
8. 各自が最終的な confidence を Lead に報告:
   - 同意する仮説とその理由
   - 残る不確実性

### Phase 5: Lead が結論をまとめる

3人の調査結果を統合し、以下を判定する:

```
【合意あり】全員が同じ仮説に HIGH confidence
  → 根本原因を確定、修正案を提示

【多数決】2人が同じ仮説に HIGH/MEDIUM confidence
  → 有力な原因として提示、追加検証を提案

【不一致】全員バラバラ、または全員 LOW confidence
  → 調査結果を整理してユーザーに報告、追加情報を依頼
```

### Phase 6: 報告と次のステップ

以下の順序で確実にクリーンアップし、結果をユーザーに報告する:

1. 全チームメイト（Investigator A, B, C）にシャットダウンを依頼する
2. 全員が停止したことを確認する
3. チームをクリーンアップする
4. ユーザーに報告:

```
修正を実装しますか？
- Yes → `/dev-core:tdd [修正内容]` で TDD サイクルを実行
- No → 調査結果を Issue にコメントとして追記
```

## 出力例

```
【デバッグ調査結果】

🔍 調査チーム: 3仮説 × 2ラウンド議論

仮説A: DB接続プールの枯渇
  📊 Investigator A: HIGH confidence
  証拠: connection leak in src/lib/db.ts:42, pool size=5
  反証: なし
  他の調査員: B=同意, C=同意

仮説B: レースコンディション
  📊 Investigator B: LOW confidence
  証拠: 並行処理あるがロック機構も存在
  反証: Aが発見した connection leak で説明可能

仮説C: 外部APIタイムアウト
  📊 Investigator C: LOW confidence
  証拠: タイムアウト設定が長い(30s)
  反証: エラーログにタイムアウトの記録なし

【結論】
🎯 根本原因: DB接続プールの枯渇（confidence: HIGH）
📍 箇所: src/lib/db.ts:42 - connection が release されていない
💡 修正案: finally ブロックで connection.release() を確実に呼ぶ

【次のステップ】
→ `/dev-core:tdd "Fix connection leak in db.ts"` で修正を実装
```

## ワークフロー全体像

```
/dev-core:debug-team [症状]
       ↓
症状の整理（ユーザーと Lead）
       ↓
仮説の立案（3つ）
       ↓
Agent Team 作成（Investigator A + B + C）
       ↓
Round 1: 各自が独立調査 → 証拠収集
       ↓
Round 2: 相互反証 → 議論
       ↓
Round 3: 合意形成 → confidence 報告
       ↓
Lead が結論をまとめて報告
       ↓
チームクリーンアップ
       ↓
/dev-core:tdd で修正実装（オプション）
```
