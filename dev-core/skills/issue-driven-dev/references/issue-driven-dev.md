# issue-driven-dev 詳細リファレンス

SKILL.md 本文から §番号で参照される詳細資料。テンプレートはそのままコピーして使い、プロジェクトの実態に合わせて最小限だけ調整する。

## §1 Issue Forms(YAML)テンプレート3種

`.github/ISSUE_TEMPLATE/` に以下の3ファイルを置く。Issue Forms は Markdown テンプレートと違い入力欄を構造として強制できるため、「受入基準のない Issue」をフォーム段階で防げる。

### §1.1 バグ報告 — `bug_report.yml`

```yaml
name: バグ報告
description: 動作が期待と異なる問題を報告する
title: "[Bug]: "
labels: ["type/bug", "status/needs-triage"]
body:
  - type: textarea
    id: summary
    attributes:
      label: 何が起きているか(現状)
      description: 観測した事実だけを書く。推測は「技術メモ」へ
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: 期待される動作
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: 再現手順
      description: 番号付きで。再現率(常に/時々/特定条件)も書く
      placeholder: |
        1. ...
        2. ...
        3. ...
    validations:
      required: true
  - type: textarea
    id: environment
    attributes:
      label: 環境
      description: OS / ブラウザ / アプリのバージョン / 環境(本番・staging・ローカル)
    validations:
      required: true
  - type: textarea
    id: evidence
    attributes:
      label: エラーログ・スクリーンショット
      description: 完全なエラーメッセージとスタックトレース
  - type: textarea
    id: notes
    attributes:
      label: 技術メモ(任意)
      description: 原因の推測・関連しそうなファイル・直近の関連変更
```

### §1.2 機能要望 — `feature_request.yml`

```yaml
name: 機能要望
description: 新しい機能・改善を提案する
title: "[Feature]: "
labels: ["type/feature", "status/needs-triage"]
body:
  - type: textarea
    id: background
    attributes:
      label: 背景 / なぜ必要か
      description: この機能が解決する課題。誰が困っているか(business context)
    validations:
      required: true
  - type: textarea
    id: story
    attributes:
      label: ユーザーストーリー
      placeholder: "〜として、〜したい。なぜなら〜だから。"
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 受入基準
      description: 検証可能な条件をチェックボックスで。これがそのまま完了条件・テスト仕様になる
      placeholder: |
        - [ ] 条件1
        - [ ] 条件2
    validations:
      required: true
  - type: textarea
    id: out_of_scope
    attributes:
      label: スコープ外
      description: この Issue でやらないことを明記する
    validations:
      required: true
  - type: textarea
    id: notes
    attributes:
      label: 技術メモ(任意)
```

### §1.3 タスク — `task.yml`

```yaml
name: タスク
description: リファクタリング・設定変更・調査などの作業単位
title: "[Task]: "
labels: ["type/chore", "status/needs-triage"]
body:
  - type: textarea
    id: background
    attributes:
      label: 背景 / なぜやるか
    validations:
      required: true
  - type: textarea
    id: work
    attributes:
      label: 作業内容
      description: 何をどうするか。30分未満または自明なら一行で可
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 完了条件
      description: 30分を超える作業、および AI エージェントに委任する作業では必須
      placeholder: |
        - [ ] 条件1
```

補足: `blank_issues_enabled: false` を `config.yml` に設定すると、テンプレートを迂回した空 Issue を防げる(運用が固まってから有効化する)。

## §2 ラベル3軸体系とマイルストーンの初期セット

### §2.1 ラベル定義

3軸×各5個以内を厳守する。属性を増やしたくなったら GitHub Projects のカスタムフィールドへ。

| ラベル | 意味 |
|---|---|
| `type/bug` | 期待と異なる動作の修正 |
| `type/feature` | 新機能・機能改善 |
| `type/chore` | リファクタ・依存更新・設定・調査 |
| `type/docs` | ドキュメントのみの変更 |
| `priority/P0` | 即時対応。本番障害・セキュリティ。他作業を止める |
| `priority/P1` | 現行マイルストーン内で対応 |
| `priority/P2` | 次回以降のマイルストーンで対応 |
| `priority/P3` | いつかやる。四半期ごとに棚卸しして close も検討 |
| `status/needs-triage` | 未仕分け(新規 Issue の既定値) |
| `status/ready` | 受入基準精査済み。エージェントに割当可能 |
| `status/blocked` | 依存・外部要因で着手不能(理由をコメントに書く) |

運用ルール:

- `status/ready` は「人間が受入基準を精査済み」の証。AI が一括生成した Issue に AI 自身が `ready` を付けてはならない。
- `status/blocked` を付けるときは「何にブロックされているか」「解除条件」をコメントに必ず書く。
- 軸をまたぐラベル(例: `urgent-bug`)を作らない。1 Issue に各軸1つずつ。

### §2.2 マイルストーン運用

- **リリース単位**(例: `v1.2.0`)または**契約フェーズ単位**(例: `フェーズ2: 決済機能`)で切る。それ以外の単位(週・人)では切らない。
- 期日を必ず設定する。期日と進捗率(closed/total)が自動で可視化され、受託では顧客報告と請求根拠の裏付けになる。
- マイルストーンに入らない Issue は入れない(空マイルストーンや「その他」置き場を作らない)。バックログは `priority/*` とトリアージで管理する。

## §3 良い Issue の実例(合格/不合格)

### §3.1 合格例

> **タイトル**: パスワードリセットメールが再送できるようにする
>
> **背景 / なぜ**: リセットメールが迷惑メールに入るケースが多く、ユーザーがログイン不能のまま離脱している。サポート問い合わせの上位項目。
>
> **現状と期待**: 現状はリセット要求後60分間は再送不可。期待は、60秒のクールダウン後に再送ボタンが有効になること。
>
> **受入基準**:
> - [ ] リセット要求後60秒経過で「再送する」ボタンが有効になる
> - [ ] 再送は同一トークンを失効させ、新トークンを発行する
> - [ ] 60秒以内の再送要求は 429 を返し、UI にクールダウン残り秒数を表示する
> - [ ] 上記3点の自動テストがある
>
> **スコープ外**: メールテンプレートのデザイン変更、SMS でのリセット。
>
> **技術メモ**: レート制限は既存の RateLimiter ミドルウェアを流用できる見込み。

合格の理由: 実装者(人間でも AI でも)がこれだけ読んで着手でき、受入基準がそのままテスト仕様になり、スコープ外が明記されているので実装が膨張しない。

### §3.2 不合格例と直し方

> **タイトル**: ログイン周りをいい感じにする

不合格の理由と直し方:

- 「いい感じ」は検証不能 → 観測可能な現状と期待に書き直す。
- 関心事が不明(UI? セキュリティ? パフォーマンス?) → 1 Issue = 1 関心事に分割する。
- 受入基準がない → エージェントに委任した場合、完了条件をエージェント自身が決めることになり、成果物の合否を人間が判定できなくなる。

例外: 「typo 修正: README の `recieve` → `receive`」のような30分未満かつ自明な作業はタイトル+一行で可。ただし AI エージェントに委任するなら自明な作業でも完了条件を一行書く。

## §4 ADR / Design Doc テンプレート

### §4.1 ADR テンプレート(MADR 系の最小構成)

`docs/adr/NNNN-<決定の要約>.md` としてリポジトリに置き、コードと一緒にバージョン管理する。

```markdown
# NNNN: <決定を一文で>

- Status: Accepted   <!-- Proposed / Accepted / Superseded by NNNN -->
- Date: YYYY-MM-DD

## Context(背景)

<!-- この決定が必要になった状況。制約条件。何が問題だったか -->

## Decision(決定)

<!-- 何をすると決めたか。一文で言い切る -->

## Consequences(結果)

<!-- この決定で良くなること・悪くなること・受け入れたトレードオフ -->

## Alternatives Considered(検討した代替案)

<!-- 採らなかった選択肢と、採らなかった理由 -->
```

supersede 運用:

1. 決定を覆すときは、既存 ADR を**編集しない**。新しい番号で ADR を作る。
2. 新 ADR の Context に「NNNN を supersede する。理由: …」を書く。
3. 旧 ADR の Status を `Superseded by NNNN` に変更する(変更してよいのは Status 行のみ)。

書くタイミングの判断: 「後任(または AI エージェント)が『なぜこうなってる?』と聞きたくなる決定」は全部書く。アーキテクチャ・技術選定・外部連携・セキュリティに関わる決定は必須。

### §4.2 Design Doc 構成(Google 流)

実装前に書く。完璧さより早さ — 主目的は実装前のフィードバック獲得。実装後は更新せず歴史資料として残す。

```markdown
# <機能名> Design Doc

## Context and Scope(背景とスコープ)
## Goals and Non-Goals(目標と非目標)
## Design(設計)
<!-- システム構成図・データフロー・API・データモデル。トレードオフを明示 -->
## Alternatives Considered(検討した代替案)
## Cross-cutting Concerns(横断的関心事)
<!-- セキュリティ・プライバシー・監視・移行 -->
```

書き分けの整理:

| | Design Doc / RFC | ADR |
|---|---|---|
| 役割 | 選択肢を探索し合意する | 決定を記録する |
| タイミング | 実装前 | 決定した直後 |
| 更新 | 実装後は凍結(歴史資料) | 不変(覆すなら supersede) |
| 分量 | 数ページ可 | 1決定1ファイル・短く |

受託の注意: 顧客に見せる納品設計書と、自分+AI 用の Design Doc を混同しない。納品ドキュメントの範囲と形式は契約で決まるため、ADR/Design Doc から納品書類を生成する方向で二重管理を防ぐ。

### §4.3 ADR(不変の記録)と AGENTS.md(現在形)の役割分離

README が人間向けの入口、AGENTS.md / CLAUDE.md が AI エージェント向けの運用ドキュメントで、いずれも「常時更新の現在形」。不変の記録である ADR とは役割が違う。ADR は決定時点を凍結し、覆すときは新 ADR で supersede する。AGENTS.md は現在の正だけを持ち、変更したら即コミットする(鮮度が信頼性そのもの)。なぜ: 腐った現在形は無い記述より有害(AI が古い情報を信じて作業する)ため。過去案件の ADR 群は次案件でエージェントに文脈として注入できる再利用資産になるので、「AI が読んで文脈復元できるか」を文書品質の評価軸に加える。

中身の設計(何を書き何を書かないか・薄く保つ・二重管理禁止) → dev-core:conventions-as-guardrails Step 3 参照。

## §5 レビュー規律の詳細

### §5.1 Conventional Comments 早見表

指摘の重み(対応必須か否か)を接頭辞で明示する。レビュイー(人間・AI とも)が対応要否を判断できることが目的。

| 接頭辞 | 意味 | 対応 |
|---|---|---|
| `praise:` | 良い点の指摘 | 不要 |
| `nit:` | 些細な指摘(好みの範囲) | 任意 |
| `suggestion:` | 改善提案 | 検討必須・採否は任意 |
| `question:` | 理解のための質問 | 回答必須 |
| `thought:` | 将来に向けたアイデア | 不要(Issue 化を検討) |
| `issue:` | 修正が必要な問題 | 対応必須 |
| `issue (blocking):` | マージを止める問題 | 解決までマージ不可 |

### §5.2 レビュー運用ルール

- **Small CL**: 迷ったら想定より小さく分割する。1 PR = 1 Issue = 1 関心事を守れば自然に小さくなる。
- **応答 SLO: 1営業日以内**。完全なレビューでなくてよい — 「今日中に見る」の一言でも SLO は満たせる。放置がレビュー文化を殺す。
- 承認基準は「完璧」ではなく「確実な改善」(better, not perfect)。コードベースの健全性が時間とともに改善するなら通す。
- レビューで設計・可読性を見る。「動くか」だけのレビューは自動テストと重複しており価値がない。

### §5.3 AI 一次レビュー + 人間最終承認の分担

| 担当 | 見るもの |
|---|---|
| AI(一次レビュー) | 全行の網羅チェック: セキュリティ・規約違反・明白なバグ・テスト漏れ |
| 人間(最終承認) | 妥当性: 設計判断・ビジネス整合・受入基準との一致・マージ可否 |

運用上の注意:

- AI の指摘は鵜呑みにしない。一次情報(実ファイル・実行出力)で検証してから反映する。
- 実装したエージェント自身に自分の実装のレビューやテスト生成をさせない(自己弁護的になる)。レビューは別エージェント・別セッションに分離する。
- 独立レビューの依頼方法 → dev-core:codex-collab 参照。

## §6 週次トリアージ手順

週1回、固定の曜日に実施する(スキップしない。溜まった needs-triage はスループット低下として現れる)。

### §6.1 手順チェックリスト

1. [ ] `status/needs-triage` の Issue を古い順に全件開く
2. [ ] 重複を検出したら close し、正本 Issue にリンクを残す
3. [ ] `type/*` と `priority/*` を付ける
4. [ ] 顧客要望 Issue は契約仕分けゲートへ(§6.2)
5. [ ] 受入基準を精査し、合格ラインを満たすものだけ `status/ready` に昇格
6. [ ] マイルストーンを割り当てる(入らないものはバックログのまま)
7. [ ] `status/blocked` の Issue の解除条件を確認し、解除されていたら `ready` へ
8. [ ] 数週間 open のままの巨大 Issue を分割するか判断する
9. [ ] `priority/P3` の棚卸し(四半期ごと): やらないと判断したものは理由を書いて close

AI エージェントに任せられるのは 1〜3 のドラフト(ラベル提案・重複検出・優先度提案)まで。4〜9 の確定は人間が行う。

### §6.2 契約仕分けゲート(受託のみ)

顧客からの要望 Issue は、着手前に必ず次の3択に人間が仕分ける:

| 仕分け | 意味 | 次のアクション |
|---|---|---|
| 契約内 | 現行契約・現行スコープで対応する | 通常のトリアージへ(priority 付与) |
| 見積対象 | スコープ外。追加の合意が必要 | 自組織の見積・価格判断プロセスへ回す。合意前に実装着手しない |
| 対応不可 | 技術・契約・方針上対応しない | 理由を Issue に書いて close(顧客への伝え方は合意形成の問題 → client-alignment 参照) |

なぜゲートが必要か: 仕分けせずに実装すると、スコープ外作業が無償で積み上がり、変更管理の証跡も残らないため。仕分けの結果と理由を Issue に記録すること自体が、受託における変更管理の証跡になる。

注: 契約・検収に関わる運用は法的助言ではなく実務の型(2026年時点の目安・要確認)。契約条項への反映は弁護士等の専門家に確認する。
