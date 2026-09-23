---
name: refactor
description: "作業中の変更・PR・ブランチ・最近の変更に対して Martin Fowler / t-wada の原則でリファクタリングを実行する。テストグリーン維持・外部動作不変が制約。/dev-core:refactor で起動する。"
argument-hint: "[コミットハッシュ|PR番号|ブランチ名|ファイル/ディレクトリ] [--commit] [--push]"
disable-model-invocation: true
allowed-tools: Task(subagent_type:dev-core:tdd-practitioner), Task(subagent_type:dev-core:quality-checker), Read, Glob
---

# コードリファクタリング

**重要**: 開始前に `dev-core:best-practices` スキルをロードして、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認すること。

フロントエンド実装の際は以下のスキルもロードすること：

- `dev-core:frontend-patterns` - コンポーネント設計・データフェッチのパターン（useEffect 回避の正本）
- `frontend-design:frontend-design`（インストールされていれば） - フロントエンド設計ガイドライン
- `ui-ux-pro-max:ui-ux-pro-max`（インストールされていれば） - UI/UX デザイン DB 検索

## 概要

Martin Fowler と T-wada の原則に基づいたリファクタリングを実行する。
対象は現在の変更、PR、ブランチ、特定ファイル/ディレクトリ、または最近の変更から選択可能。

最初に `$ARGUMENTS` から `--commit` と `--push` を delivery flags として分離し、残りを `TARGET` とする。`--push` はこのリファクタリングの commit と push を許可する。PR comment は含まず、別の明示依頼が必要。以下の対象判定では `TARGET` だけを使う。

## サブエージェント使用ガイド（必須）

このコマンドでは以下のサブエージェントを **Task ツール** で必ず呼び出すこと。直接リファクタリングせず、専門エージェントに委譲することで品質を確保する。

### 1. tdd-practitioner（リファクタリング専門家）

**呼び出しタイミング**: リファクタリング対象の特定後、事前テスト実行後

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:tdd-practitioner")
prompt: |
  以下のコードをリファクタリングしてください。

  ## 対象
  [リファクタリング対象のファイル/ディレクトリ]

  ## 変更コンテキスト
  [PR番号、ブランチ名、コミットハッシュなど]

  ## リファクタリング観点
  1. コーディング規約への準拠
  2. 重複コードの排除（DRY原則）
  3. 単一責任の原則（SRP）の適用
  4. 早期リターン/ガード節の活用
  5. 明確で意図が伝わる命名への改善
  6. マジックナンバーの定数化
  7. （React の場合）データフェッチ用 useEffect の削除と代替実装への置き換え
     （正本: frontend-patterns スキルの「データフェッチ」）
  8. 冗長なコードの分割・簡潔化

  ## PRリファクタリングの場合の追加観点
  - レビューコメントで指摘される前に品質改善
  - PRのサイズが大きい場合は段階的に実行
  - CIで検出される前にlint/typecheck違反を修正

  ## 制約
  - テストは必ずグリーンを維持
  - 外部動作は変更しない
  - 各変更後にテスト実行で確認
```

### 2. quality-checker（品質チェック専門家）

**呼び出しタイミング**: リファクタリング完了後、コミット前

**Task ツール呼び出しパターン**:

```
Task(subagent_type: "dev-core:quality-checker")
prompt: |
  リファクタリング後のコードに対して品質チェックを実行してください。

  ## 変更されたファイル
  [git diff --name-only の結果]

  ## チェック項目
  - lint実行（警告・エラー0を確認）
  - typecheck実行（型エラー0を確認）
  - テスト実行（すべてグリーンを確認）
  - コーディング規約の確認

  ## 問題検出時
  - 問題を修正
  - 再度チェックを実行
  - すべてクリーンになるまで繰り返す
```

## 実行フロー

### 1. 対象の特定

差分ファイルはプロジェクトの主要ソース拡張子で絞り込む（下記例の `$SRC_EXT` はプロジェクトに合わせる。例: `ts|tsx|vue|php|py`）。

```bash
# 引数なし: 現在の未コミット変更
if [ -z "$TARGET" ]; then
  echo "🔍 現在の変更をリファクタリング対象とします"
  git diff --name-only | grep -E "\.($SRC_EXT)$"

# PR番号の場合（#123 または 123）
elif [[ "$TARGET" =~ ^#?[0-9]+$ ]]; then
  PR_NUMBER="${TARGET#\#}"
  echo "🔍 PR #$PR_NUMBER の変更をリファクタリング対象とします"

  # PRの情報を取得
  PR_INFO=$(gh pr view $PR_NUMBER --json baseRefName,headRefName)
  BASE_BRANCH=$(echo $PR_INFO | jq -r '.baseRefName')
  HEAD_BRANCH=$(echo $PR_INFO | jq -r '.headRefName')

  # PRの差分ファイルを取得
  git fetch origin $HEAD_BRANCH
  git diff --name-only origin/$BASE_BRANCH...origin/$HEAD_BRANCH | grep -E "\.($SRC_EXT)$"

# ファイル/ディレクトリの場合
elif [ -e "$TARGET" ]; then
  echo "🔍 $TARGET をリファクタリング対象とします"

# ブランチ名またはコミットハッシュの場合
elif git rev-parse --verify $TARGET >/dev/null 2>&1; then
  if git show-ref --verify --quiet refs/heads/$TARGET; then
    echo "🔍 ブランチ $TARGET の変更をリファクタリング対象とします"
    BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
    git diff --name-only $BASE_BRANCH...$TARGET | grep -E "\.($SRC_EXT)$"
  else
    echo "🔍 コミット $TARGET の変更をリファクタリング対象とします"
    git diff --name-only $TARGET^ $TARGET | grep -E "\.($SRC_EXT)$"
  fi

# 引数指定なしで最近の変更を自動検出
else
  echo "🔍 最近変更されたファイルを自動検出（過去5コミット）"
  git diff --name-only HEAD~5..HEAD | grep -E "\.($SRC_EXT)$"
fi
```

### 2. 事前チェック

1. **テストの実行**

   プロジェクト設定に従ってテストを実行（コマンドは dev-core:verify の Step 0 手順で検出する。ハードコードしない）
   すべてのテストがグリーンであることを確認

2. **現在の品質状態**

   lint と typecheck を実行し、現状を把握

### 3. リファクタリング実行

**⚠️ 重要**: 必ず Task ツールで tdd-practitioner エージェントを呼び出すこと。

tdd-practitioner エージェントに以下の情報を渡す：

- リファクタリング対象のファイル/ディレクトリ
- 変更コンテキスト（PR 番号、ブランチ名など）
- リファクタリング観点（上記パターン参照）

### 4. 優先順位

リファクタリングは以下の優先順位で実行：

1. **Critical（必須）**
   - ハードコーディングの除去
   - セキュリティリスクの解消
   - 明らかなバグの修正
   - **（React）データフェッチ用 useEffect の除去**: バグの温床となる useEffect を代替手段に置き換え（frontend-patterns スキル参照）

2. **High（高優先度）**
   - 重複コードの統合
   - 複雑な条件式の簡略化
   - 長大な関数の分割

3. **Medium（中優先度）**
   - 命名の改善
   - 不要なコメントの削除
   - インターフェースの整理

4. **Low（低優先度）**
   - インポートの整理
   - フォーマットの統一
   - 型定義の改善

### 5. TDD サイクルの Refactor フェーズとして実行

- **前提**: すべてのテストがグリーン
- **目的**: コード品質の向上（動作は変更しない）
- **結果**: テストが引き続きグリーン

### 6. 品質確認とコミット

**⚠️ 重要**: 必ず Task ツールで quality-checker エージェントを呼び出すこと。

1. **quality-checker を呼び出す**
   - リファクタリング後のファイルに対して品質チェック
   - 問題があれば修正を実行

2. **差分の確認**

   ```bash
   git diff
   ```

3. **Optional コミット/プッシュ**

   `--commit`、`--push`、または明示依頼がある場合だけ、リファクタリングしたファイルを個別指定で `git add` して commit する。`--push` または明示依頼がある場合だけ、その新しい commit を push する。PR comment は `--push` に含めず、現在の依頼でコメントを明示された場合だけ行う。指定がなければ検証済み working tree の差分を報告して終了する。

   ```bash
   # --commit または --push 指定時のみ
   git add [変更したファイルを個別指定]
   git commit -m "refactor: [変更内容の説明]"

   # --push 指定時のみ
   git push origin $HEAD_BRANCH

   # PR comment は別途明示依頼された場合のみ
   ```

## 実行例

```bash
# 現在の変更をリファクタリング
/dev-core:refactor

# PR番号でリファクタリング
/dev-core:refactor #123
/dev-core:refactor 123

# 特定ファイルのリファクタリング
/dev-core:refactor src/features/client-management/ui/ClientForm.tsx

# ディレクトリ全体
/dev-core:refactor src/features/client-management/

# ブランチの変更をリファクタリング
/dev-core:refactor feature/add-user-auth

# 特定のコミットをリファクタリング
/dev-core:refactor abc123f
```

## 注意事項

- **動作を変更しない**: 外部から見た動作は維持
- **テストを常にグリーンに**: 各ステップでテスト実行
- **段階的に実行**: 一度に大きな変更を避ける
- **YAGNI 原則**: 将来の拡張を過度に考慮しない
- **React の useEffect リファクタリング**: 具体例と代替手段は `dev-core:frontend-patterns` スキルの「データフェッチ」を参照（知識の正本はスキル側に置き、ここには複製しない）

## ワークフロー全体像

```
/dev-core:task → 調査・証拠付き計画（Issueはopt-in）
       ↓
/dev-core:execute → TDD 実装
       ↓
/dev-core:refactor → 追加リファクタリング（このコマンド）
       ↓
/dev-core:verify → 6段階検証
       ↓
/dev-core:code-review → コードレビュー
       ↓
PR 作成・マージ
```

## 関連コマンド

- `/dev-core:verify`: リファクタリング後の 6 段階検証
- `/dev-core:code-review`: コードレビュー実行

プロジェクト設定ファイル（.claude/\*.local.md）を確認し、追加ツールが指定されている場合はそれを活用すること。
コードの動作を変えずに、tdd-practitioner と quality-checker エージェントを活用して品質と保守性を向上させること。
