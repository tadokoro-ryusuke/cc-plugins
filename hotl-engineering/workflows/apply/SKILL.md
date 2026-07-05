---
name: apply
description: "合意済みの適用計画に基づき HOTL テンプレートを適用する（モードA Step 3–5）。計画がまだ無ければ先に /hotl-engineering:assess を実行する。/hotl-engineering:apply で起動する。"
disable-model-invocation: true
argument-hint: "[対象リポジトリのパス（省略時はカレントディレクトリ）]"
---

# HOTL Apply — テンプレート適用と引き渡し

hotl-engineering スキル本体（`skills/hotl-engineering/SKILL.md`）と
`assets/ADJUST.md` を読み込み、**モードAの Step 3–5** を実行する。

前提: アセスメントと適用計画への合意が済んでいること。
このセッションに計画が無い場合は、先に `/hotl-engineering:assess` を実行するか、
既存の計画（会話履歴・ドキュメント）を確認してから進める。**計画なしで
テンプレートを全部入りコピーしない。**

手順:

1. 合意済みサブセットのテンプレートを `assets/` からコピーし、
   `assets/ADJUST.md` の置換ポイントに沿って書き換える
   （パッケージマネージャ / Tier 2 paths と CODEOWNERS の同期 / モデルID / デプロイ先）
2. **必ず Phase 1 設定で導入する**（security 層 continue-on-error、AIレビューは
   required にしない、branch protection は PR 必須 + force push 禁止のみ）
3. workflow YAML の構文検証（`yaml.safe_load` 等）とスクリプトの構文チェックを行う
4. 成果物 README に「2週間の較正期間で偽陽性を潰してから強制化する」ことと、
   Phase 2 チェックリスト（required check 化・environment reviewer・CODEOWNERS 有効化・
   eval baseline 初期化・setup-branch-protection.sh 実行）を明記して引き渡す
