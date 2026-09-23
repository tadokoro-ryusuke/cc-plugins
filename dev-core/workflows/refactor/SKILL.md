---
name: refactor
description: "作業中の変更・PR・ブランチ・最近の変更に対して Martin Fowler / t-wada の原則でリファクタリングを実行する。テストグリーン維持・外部動作不変が制約。親が実装し、検証は dev-core:verify で行う。/dev-core:refactor で起動する。"
argument-hint: "[コミットハッシュ|PR番号|ブランチ名|ファイル/ディレクトリ] [--commit] [--push]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Agent(dev-core:tdd-practitioner)
---

# コードリファクタリング

開始前に `dev-core:best-practices` スキルをロードし、TDD/FSD/Clean Architecture/DDD のベストプラクティスを確認する。

フロントエンドを扱うときは、以下のスキルもロードする。

- `dev-core:frontend-patterns` - コンポーネント設計・データフェッチのパターン（useEffect 回避の正本）
- `frontend-design:frontend-design`（インストールされていれば） - フロントエンド設計ガイドライン
- `ui-ux-pro-max:ui-ux-pro-max`（インストールされていれば） - UI/UX デザイン DB 検索

## 概要

Martin Fowler と T-wada の原則に基づいたリファクタリングを実行する。
対象は現在の変更、PR、ブランチ、特定ファイル/ディレクトリ、または最近の変更から選択可能。

最初に `$ARGUMENTS` から `--commit` と `--push` を delivery flags として分離し、残りを `TARGET` とする。`--push` はこのリファクタリングの commit と push を許可する。PR comment は含まず、別の明示依頼が必要。以下の対象判定では `TARGET` だけを使う。

## 実行の担当

親（このセッション）がリファクタリングを実装し、検証も親がツールで直接実行する。外部動作を保ったままの小さな変更の積み重ねは密結合で逐次の作業なので、分けても文脈の受け渡しが増えるだけになる。

`Agent(dev-core:tdd-practitioner)` に委譲するのは、次のときだけにする（原則は `dev-core:best-practices` の `references/delegation-and-review.md`）。

- 対象の中に、書き込み範囲・依存が重ならない独立した塊があり、並行で進める利得がある
- テストやビルドの出力が大きく、親の文脈から隔離したい

委譲するときは、対象ファイル、変更コンテキスト、下記のリファクタリング観点と制約だけを渡す。子の報告にある実行コマンドと生の結果を親が確かめてから次へ進み、委譲の理由を報告に1行残す。

## リファクタリング観点

1. コーディング規約への準拠（プロジェクトの既存規約を優先する）
2. 重複コードの排除（DRY原則）
3. 単一責任の原則（SRP）の適用
4. 早期リターン/ガード節の活用
5. 明確で意図が伝わる命名への改善
6. マジックナンバーの定数化
7. （React の場合）データフェッチ用 useEffect の削除と代替実装への置き換え（正本: frontend-patterns スキルの「データフェッチ」）
8. 冗長なコードの分割・簡潔化

PR が対象のときは、次も見る。

- レビューコメントで指摘される前に品質を改善する
- PR のサイズが大きい場合は段階的に実行する
- CI で検出される前に lint/typecheck 違反を修正する

制約:

- テストはグリーンを維持する
- 外部動作は変更しない
- 各変更後にテストを実行して確認する

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

親が「リファクタリング観点」と下記の優先順位に沿って、小さな変更を積み重ねる。各変更の後に focused なテストを実行し、グリーンを確かめてから次の変更へ進む。委譲の条件に当たる塊だけを `tdd-practitioner` に渡す（「実行の担当」参照）。

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

### 6. 検証とコミット

1. **検証**

   親が `dev-core:verify` を実行し、build・typecheck・lint・test・security・diff の結果を実出力で確かめる。失敗があれば修正して、影響する段を再実行する。同じ修正経路で3回失敗したら止めて、状況を報告する。

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
/dev-core:refactor → 追加リファクタリングと dev-core:verify での検証（このコマンド）
       ↓
/dev-core:code-review → 規約レンズのレビュー
       ↓
PR 作成・マージ
```

## 関連コマンド

- `/dev-core:verify`: リファクタリング後の 6 段階検証
- `/dev-core:code-review`: dev-core の規約レンズ（FSD / Clean Architecture / DDD、セキュリティ規約）でのレビュー

プロジェクト設定ファイル（.claude/\*.local.md）を確認し、追加ツールが指定されている場合はそれを使う。
