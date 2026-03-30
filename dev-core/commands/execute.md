---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx,*.vue,*.php), Write, Edit, MultiEdit, Task(subagent_type:dev-core:tdd-practitioner), Task(subagent_type:dev-core:quality-checker), Task(subagent_type:dev-core:security-auditor), Task(subagent_type:dev-core:build-error-resolver), Task(subagent_type:dev-core:code-reviewer)
description: "作成済みの計画書に基づいてTDD実装を実行します"
argument-hint: "[計画書のパス] (例: docs/plans/task-user-auth.md)"
---

# TDD 計画の実行

**重要**: 開始前に `dev-core:best-practices` スキルをロードすること。
フロントエンド実装時は `frontend-design:frontend-design` と `ui-ux-pro-max:ui-ux-pro-max` もロード。

## 実行フロー

### 1. 準備

- 計画書（$ARGUMENTS）を読み込み内容を把握
- `git status` で未コミット変更がないか確認
- 計画書名からブランチを作成: `git checkout -b feature/[slug]`
- .claude/*.local.md を確認しプロジェクト固有設定を読み込む

### 2. Tidy First（事前整理）

計画書の Phase 1 セクションのタスクを実行。既存コードのリファクタリング、依存関係の整理。

### 3. TDD実装 + フィードバックループ

計画書の各イテレーションを **2-5分のマイクロステップ** で順に実行:

```
tdd-practitioner（実装: Red→Green→Refactor）
  ↓
quality-checker（lint/typecheck/test）←── 失敗時: 修正して再実行
  ↓ パス
code-reviewer（3軸レビュー: セキュリティ/品質/慣例）
  ↓
approved? ──NO──→ tdd-practitioner（改善、最大3ラウンド）→ 戻る
  ↓ YES
コミット（ファイル個別指定、Conventional Commits形式）
  ↓
次のイテレーションへ
```

#### サブエージェント呼び出しルール

- **tdd-practitioner**: 各イテレーションで必ず Task ツールで呼び出す。直接実装しない
- **quality-checker**: 各イテレーション完了後・コミット前に必ず呼び出す
- **code-reviewer**: quality-checker パス後にレビュー依頼。全カテゴリ B+ 以上で承認
- **security-auditor**: 新規ファイル追加時、API/認証関連の変更時に呼び出す
- **build-error-resolver**: ビルドエラー発生時に呼び出す

#### 改善ラウンド上限

最大3ラウンド。3ラウンド目でも不合格の場合は残課題をユーザーに報告し判断を仰ぐ。

### 4. 進捗レポート

各イテレーション完了時に報告:

```
✅ Iteration 1: [名前] — レビュー承認、コミット完了
🔄 Iteration 2: [名前] — 実装中
⏸️ Iteration 3: [名前] — 待機中
```

### 5. 最終確認

全イテレーション完了後:
1. quality-checker で最終テスト実行
2. `git log --oneline` と `git diff main...HEAD` で変更確認
3. `gh pr create` でPR作成

## 中断と再開

- 中断時は `/dev-core:checkpoint --create` で進捗保存
- 同じコマンドで続きから再開可能

## エラーハンドリング

- テスト失敗: エラー詳細を表示
- lint/typecheck失敗: quality-checker で修正
- ビルドエラー: build-error-resolver で自動修復
