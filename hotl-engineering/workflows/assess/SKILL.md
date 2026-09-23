---
name: assess
description: "対象リポジトリの HOTL アセスメント（モードA Step 1–2）を明示実行し、性格判定と適用計画を提示する。テンプレ適用はしない（承認後に /hotl-engineering:apply）。/hotl-engineering:assess で起動する。"
disable-model-invocation: true
argument-hint: "[対象リポジトリのパス（省略時はカレントディレクトリ）]"
---

# HOTL Assess — アセスメントと適用計画の提示

hotl-engineering スキル本体（`skills/hotl-engineering/SKILL.md`）と
`references/principles.md` を読み込み、**モードAの Step 1（アセスメント）と
Step 2（適用計画の提示）だけ**を実行する。

手順:

1. 引数のパス（省略時はカレント）のリポジトリを実際に調査する
   （スタック / 既存 CI / デプロイ先 / リポジトリの性格 / リスクパス / チーム構成・監査要件）。
   あわせて現在の保護（既存の required checks・branch protection / ruleset・must-pass 条件・
   environment reviewer）を棚卸しする。コードや設定から読み取れず、結果を実質的に
   左右する未解決の判断だけを質問する
2. 性格判定（実験・PoC / 社内ツール / 本番プロダクト / エージェント系）と、
   性格別の推奨サブセット・導入しないものを理由付きで提示する
3. 新規の advisory/AI ゲートの観測・較正・昇格条件（代表的な実行結果・責任者・無効化手段）、
   `quality-gate` の扱い（既存の required check を黙って置き換えない）、選んだスコープに
   必要な承認点（限定的な変更に CP1〜CP4 のすべてを入れない）を含む適用計画を提示して**止まる**。
   既存の保護を弱める変更は計画に含めない

このコマンドではテンプレートの適用・ファイル生成を行わない。
ユーザーが計画に合意したら `/hotl-engineering:apply` で Step 3 以降に進む。
