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
   コードから読み取れない項目は**まとめて1回で**質問する
2. 性格判定（実験・PoC / 社内ツール / 本番プロダクト / エージェント系）と、
   性格別の推奨サブセット・導入しないものを理由付きで提示する
3. 導入順序（comment-only → 較正 → 強制）・required check の集約方針・
   CP1〜CP4 の配置を含む適用計画を提示して**止まる**

このコマンドではテンプレートの適用・ファイル生成を行わない。
ユーザーが計画に合意したら `/hotl-engineering:apply` で Step 3 以降に進む。
