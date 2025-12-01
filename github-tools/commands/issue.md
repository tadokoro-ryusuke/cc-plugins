---
allowed-tools: Bash(gh:*), Read(*.md), Write(*.md)
description: "作業指示ドキュメントからGitHub Issueを作成します"
argument-hint: "[作業指示ドキュメントのパス]"
---

# GitHub Issue 作成

## 概要

作業指示ドキュメントを読み込み、GitHub Issue を作成します。

## 処理フロー

1. **ドキュメントの読み込み**

   - $ARGUMENTS で指定されたドキュメントを読み込む
   - ドキュメントが存在しない場合は、対話的に作成

2. **Issue の構成**

   - タイトル: ドキュメントのタイトルセクション
   - ラベル: 優先度、タイプ（feature/bug/task）を自動判定
   - 本文: ドキュメント全体を Markdown 形式で整形

3. **Issue テンプレート**

   ```markdown
   ## 📋 概要

   [概要セクション]

   ## 🎯 ユーザーストーリー

   [ユーザーストーリーセクション]

   ## ✅ 受け入れ条件

   [受け入れ条件セクション]

   ## 🧪 シナリオ（BDD）

   [シナリオセクション]

   ## 🔧 技術要件

   [技術要件セクション]

   ## ⚠️ 制約事項

   [制約事項セクション]

   ## 📅 スケジュール

   [優先度とスケジュールセクション]

   ---

   ### 関連情報

   - アーキテクチャ: FSD + Clean Architecture + DDD
   - TDD: t-wada 式 Red→Green→Refactor→Commit
   ```

4. **GitHub CLI コマンドの実行**

   ```bash
   gh issue create \
     --title "[タイトル]" \
     --body "[整形された本文]" \
     --label "[ラベル]"
   ```

5. **作成後の処理**
   - Issue URL を表示
   - 作業指示ドキュメントに Issue 番号を追記
   - 必要に応じて計画立案へ進むか確認

## 実行例

```bash
/github-tools:issue ./docs/tasks/add-client-search.md
```

もし$ARGUMENTS が指定されていない場合は、最初に `/github-tools:task` コマンドで作業指示を作成することを提案します。

ultrathink
