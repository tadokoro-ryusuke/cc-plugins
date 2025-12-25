---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Read(*.md,*.ts,*.tsx), Task(subagent_type:dev-core:quality-checker)
description: '現在のブランチからPull Requestを作成します。変更内容を分析し、適切なタイトルと説明を生成します'
argument-hint: '[Issue番号] (省略時は自動検出)'
---

# Pull Request 作成

## 概要

現在のブランチの変更内容を分析し、プロジェクトの規約に従ったPull Requestを作成します。

## 実行フロー

### 1. 事前チェック

```bash
# 現在のブランチを確認
CURRENT_BRANCH=$(git branch --show-current)

# mainブランチでないことを確認
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "❌ mainブランチから直接PRは作成できません"
  exit 1
fi

# 未コミットの変更がないか確認
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️ 未コミットの変更があります。コミットしてください。"
  git status
  exit 1
fi

# リモートとの同期確認
git fetch origin
```

### 2. Issue番号の特定

```bash
# 引数で指定された場合
if [ -n "$ARGUMENTS" ]; then
  ISSUE_NUMBER="$ARGUMENTS"
else
  # ブランチ名から自動検出（例: feature/issue-31）
  ISSUE_NUMBER=$(echo $CURRENT_BRANCH | grep -oE '[0-9]+' | head -1)

  # コミットメッセージから検出
  if [ -z "$ISSUE_NUMBER" ]; then
    ISSUE_NUMBER=$(git log --oneline -10 | grep -oE '#[0-9]+' | head -1 | tr -d '#')
  fi
fi

# Issue情報の取得
if [ -n "$ISSUE_NUMBER" ]; then
  echo "📋 Issue #$ISSUE_NUMBER の情報を取得中..."
  ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title -q .title)
fi
```

### 3. 変更内容の分析

```bash
# ベースブランチとの差分を確認
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
CHANGED_FILES=$(git diff --name-only origin/$BASE_BRANCH...HEAD)
COMMITS=$(git log --oneline origin/$BASE_BRANCH...HEAD)
STATS=$(git diff --shortstat origin/$BASE_BRANCH...HEAD)

# 変更の種類を判定
if echo "$CHANGED_FILES" | grep -q "\.test\|\.spec"; then
  CHANGE_TYPE="test"
elif echo "$CHANGED_FILES" | grep -q "docs/"; then
  CHANGE_TYPE="docs"
elif echo "$COMMITS" | grep -qi "fix"; then
  CHANGE_TYPE="fix"
else
  CHANGE_TYPE="feat"
fi
```

### 4. 品質チェック

quality-checkerエージェントを使用：

```bash
# lint と typecheck を実行
echo "🔍 品質チェックを実行中..."
```

プロジェクト設定に従ってlint、typecheck、testを実行

### 5. PRタイトルと説明の生成

```text
# タイトルフォーマット
[CHANGE_TYPE]: [簡潔な説明] (#[ISSUE_NUMBER])

# 例
feat: クライアント検索機能の実装 (#31)
fix: ログイン時のエラーハンドリング修正 (#45)
```

### 6. PR説明文の作成

```markdown
## 📋 概要

[変更の概要を記載]

## 🔗 関連Issue

- Closes #[ISSUE_NUMBER]

## 📝 変更内容

### 追加

- [追加した機能や機能]

### 変更

- [変更した内容]

### 削除

- [削除した内容]

## 🧪 テスト

- [ ] すべてのテストがパス
- [ ] 新機能にテストを追加
- [ ] 手動テスト完了

## 📸 スクリーンショット

[必要に応じて画面キャプチャ]

## ✅ チェックリスト

- [ ] コーディングガイドラインに準拠
- [ ] コードレビューの準備完了
- [ ] ドキュメント更新（必要な場合）

## 🚀 デプロイ後の確認事項

[本番環境での確認が必要な項目]

---

### 実装詳細

**アーキテクチャ**: FSD + Clean Architecture + DDD
**TDD**: t-wada式 Red→Green→Refactor→Commit

### 変更ファイル

\`\`\`
$STATS
\`\`\`

<details>
<summary>コミット履歴</summary>

\`\`\`
$COMMITS
\`\`\`

</details>
```

### 7. PR作成

```bash
# ドラフトかどうかを確認
echo "このPRをドラフトとして作成しますか？ (y/N)"

# PR作成
gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base $BASE_BRANCH

# 作成されたPRのURLを表示
PR_URL=$(gh pr view --json url -q .url)
echo "✅ PR作成完了: $PR_URL"
```

### 8. 後処理オプション

```bash
# ラベルの追加
if [ "$CHANGE_TYPE" = "feat" ]; then
  gh pr edit --add-label "enhancement"
elif [ "$CHANGE_TYPE" = "fix" ]; then
  gh pr edit --add-label "bug"
fi

# レビュワーの追加（オプション）
```

## 実行例

```bash
# Issue番号を自動検出してPR作成
/github-tools:pr

# Issue番号を指定してPR作成
/github-tools:pr 31

# ブランチ名: feature/issue-31 の場合
# 自動的にIssue #31と関連付け
```

## 特徴

- **自動Issue連携**: ブランチ名やコミットメッセージからIssue番号を検出
- **品質保証**: PR作成前に必ずlint/typecheck/testを実行
- **テンプレート**: プロジェクト固有のPRテンプレートを使用
- **変更分析**: 変更内容から適切なタイプ（feat/fix/test/docs）を判定
- **ドラフト対応**: 作業中のPRはドラフトとして作成可能

高品質なPRを効率的に作成できます。
