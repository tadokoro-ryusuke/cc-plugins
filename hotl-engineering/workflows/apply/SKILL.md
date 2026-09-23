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

このコマンドの起動と合意済み計画を、ローカル変更の実装権限として扱う。
ruleset / branch protection / environment reviewer / repository variables などの
外部変更は、明示的に権限が与えられている範囲でのみ行い、先に差分を提示する。

手順:

1. 合意済みサブセットで必要なテンプレートだけを `assets/` からコピーし、
   `assets/ADJUST.md` の該当セクションに沿って書き換える
   （パッケージマネージャ / Tier 2 paths と CODEOWNERS の同期 / プロバイダアダプタ /
   デプロイ先と capture/restore アダプタ）
2. **必ず Phase 1 設定で導入する**: 新規に入れる advisory/AI チェックだけを観測モードで入れる
   （AIレビューは `AI_REVIEW_ENFORCE` 未設定・required にしない）。既存の blocking な
   security チェック・branch protection・required checks・must-pass 条件は維持し、
   `continue-on-error` の付与や保護範囲の縮小で既存の保護を弱めない
3. AIレビューを入れる場合は、`assets/scripts/check_review_verdicts.py` を trusted base 側の
   `.github/scripts/check_review_verdicts.py` に設置してから workflow を有効化する。
   本番デプロイを入れる場合は、capture/restore アダプタを実装・リハーサルするまで
   本番の preflight が失敗する状態を維持する
4. workflow YAML の構文検証（`yaml.safe_load` 等）とスクリプトの構文チェックに加え、
   artifact の欠落・不正形式、ジョブ失敗、対象 revision の不一致、recovery preflight の失敗を
   オフラインの fixture で確認する（構文検証はホスト上の workflow やクラウド復旧の証拠ではない）
5. 成果物 README に、新規ゲートの昇格条件（代表的な実行結果が文書化した信頼性・品質基準を
   満たすこと・責任者・無効化手段。経過期間だけを条件にしない）と、残作業
   （required check 化・environment reviewer・CODEOWNERS 有効化・eval baseline 初期化・
   setup-branch-protection.sh の実行など）を、必要な証拠と権限要件つきで明記して引き渡す
