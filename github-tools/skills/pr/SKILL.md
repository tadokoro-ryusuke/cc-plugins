---
name: pr
description: "現在のブランチから Pull Request を作成する。変更内容と検証結果から本文を作り、本文はファイル経由で渡し、既定では draft で作成する。Issue は存在と内容を確認できたときだけ紐付ける。本文の下書きだけを作ることもできる。/github-tools:pr で起動する。"
argument-hint: "[Issue番号] [--ready] [--body-only]"
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Bash(mktemp:*), Read
---

# Pull Request 作成

## 概要

現在のブランチの変更内容を分析し、プロジェクトの規約に従った Pull Request を作成します。

## モードと承認

- **既定**: PR を draft で作成する。draft は後から ready にでき、取り消しやすいため。
- **ready**: `--ready` が付いているか、ユーザーが「レビュー可能な状態で」などと明示したときだけ、ready で作成する。
- **本文だけ**: `--body-only` が付いているか、「本文だけ」「下書きだけ」と頼まれたときは、タイトルと本文を作って提示し、push も PR 作成もしない。本文を頼まれただけでは、外部に PR を作る承認にはならないため。
- `/github-tools:pr` の起動そのものが PR 作成の依頼なので、作成するかどうかや draft / ready を改めて確認しない。質問するのは、送信に必要な権限が欠けているとき（例: 未コミットの変更をコミットしてよいか分からない）だけにする。

## 実行フロー

### 1. 事前チェック

```bash
git branch --show-current
git status --short
```

- `main` / `master` からは PR を作らない。
- 未コミットの変更は保全する。stash・破棄・無関係なファイルの自動コミットはしない。
  - PR に入るのはコミット済みの内容だけ。未コミットの変更があれば、PR に含まれないことを報告に書く。
  - ユーザーがコミットまで頼んでいる場合は、手順 4 のチェックの後に、意図したファイルだけを stage してコミットする。
  - 本文だけのモードでは、未コミットの変更があっても続けてよい。コミット済みの内容と未コミットの変更を、下書きの中で区別する。
- リモートの状態を取得し、base ブランチを決める。本文だけのモードでネットワークが使えなければ、手元の情報で進め、base が古い可能性を下書きに明記する。

```bash
git fetch origin
git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
```

### 2. Issue 番号の特定と確認

候補は次の順に探す。

1. 引数で指定された番号
2. ブランチ名（例: `feature/issue-31`）
3. 直近のコミットメッセージにある `#31`

候補が見つかったら、存在と内容を確かめる。

```bash
gh issue view <番号> --json number,title,state,url
```

- `Closes #<番号>` を付けるのは、Issue が存在し、その内容が今回の変更に対応していると確認できたときだけにする。マージ時に Issue が自動で閉じられるため。
- ブランチ名の数字は Issue 番号とは限らない。たとえば `feature/oauth2-login` からは `2` が取れるが、これはプロトコル名の一部である。Issue が見つからない、内容が変更と対応しない、すでに閉じている場合は `Closes` を付けず、関連 Issue の節も省く。
- 引数で指定された番号でも、確認できなければ同じ扱いにし、そのことを報告する。

### 3. 変更内容の分析

```bash
git rev-parse origin/<base> HEAD
git diff --name-only origin/<base>...HEAD
git diff --shortstat origin/<base>...HEAD
git log --oneline origin/<base>..HEAD
```

- 比較した base と HEAD の SHA を記録する。手順 7 で、作成直前の状態と照合するため。
- 変更の種類（feat / fix / docs / test / refactor / chore など）は、リポジトリの規約（Conventional Commits、既存の PR タイトルなど）に合わせて決める。
- このセッションでレビュー（組み込みの `/code-review`、`dev-core:code-review`、Codex レビューなど）を行っていれば、レビューした HEAD の SHA も控える。

### 4. 品質チェック

- dev-core が導入されていれば、`dev-core:verify` で検証する。
- 導入されていなければ、プロジェクトの設定（`.claude/dev-core.local.md`、`package.json` の scripts、`Makefile`、CI 設定、`AGENTS.md` / `CLAUDE.md`）から lint / typecheck / test のコマンドを見つけ、直接実行する。
- 検証の証拠は、push する HEAD と同じ内容に対するものに限る。未コミットの変更（追跡ファイルの変更や、検証の入力になる未追跡ファイル）があると、作業ツリーで実行した結果は HEAD の証拠にならない。未コミットの修正でテストが通っても、HEAD の中身は壊れたままのことがあるため。
  - その場合は、`git worktree add --detach <一時ディレクトリ> HEAD` で HEAD の隔離コピーを作り、そこでチェックを実行する。
  - 隔離コピーで実行できない（依存の導入が重いなど）ときは、該当チェックを「HEAD に対して未実行」として扱い、理由とともに本文と報告に書く。
  - 未コミットの変更が検証の入力と無関係だと確認できたとき（検証対象外の未追跡メモだけ、など）に限り、作業ツリーでの結果を HEAD の証拠にしてよい。
- 同じ HEAD（と、上の条件を満たす作業ツリー）に対して同じコマンドをこのセッションで実行済みなら、その結果を使ってよい。その場合は、再実行ではなく既存の結果を使ったことを本文に書く。
- 失敗したチェックがあれば、PR を作る前に結果を報告して止める。直すか、失敗を明記して draft で出すかは、ユーザーが決める。
- 実行できなかったチェックは「未実行」として成功と区別し、理由とともに本文と報告に書く。

### 5. タイトル

```text
# フォーマット（Issue 番号は確認できたときだけ付ける）
[種類]: [簡潔な説明] (#[Issue番号])

# 例
feat: クライアント検索機能の実装 (#31)
fix: ログイン時のエラーハンドリング修正
```

### 6. 本文の作成

プロジェクトに PR テンプレート（`.github/pull_request_template.md` など）があれば、それに従う。無ければ次の構成にする。課題と変更後の振る舞いを先に書き、続けて検証と制約を書く。

```markdown
## 概要

[何が問題で、この PR で何がどう変わるか]

## 関連 Issue

- Closes #[確認できた Issue 番号]

## 変更内容

- [主な変更]

## 検証

- [実行したコマンドと結果。未実行のチェックは理由とともに書く]

## 補足

- [既知の制約、見てほしい点、デプロイ後の確認事項]
```

- 確認できた Issue が無ければ「関連 Issue」の節ごと省く。「補足」も書くことが無ければ省く。
- 本文はファイルに書いてから渡す。複数行の本文をコマンドライン引数に展開すると、クォートやバッククォートで内容が壊れるため。
- ファイルは作業ツリーの外に作る。リポジトリ内に置くと、誤ってコミットされるおそれがあるため。

```bash
mktemp "${TMPDIR:-/tmp}/pr-body.XXXXXX"
```

作成したパスに本文を書き、Read で読み返して、意図した内容になっているか確かめる。本文だけのモードでは、ここでタイトル・本文・ファイルのパスを提示して終える。

### 7. PR の作成

作成の直前に、手順 3 で記録した状態と一致しているか確かめる。

```bash
git fetch origin
git rev-parse origin/<base> HEAD
```

- base か HEAD が変わっていたら、手順 3 からやり直す。
- レビューした HEAD と今の HEAD が違う場合は、差分をレビューし直すか、レビューしていない差分があることを本文の「補足」に書く。
- ブランチがリモートに無い、またはリモートより進んでいれば push する。force push はしない。

```bash
git push -u origin HEAD
```

```bash
# 既定（draft）。ready のときだけ --draft を外す
gh pr create --draft --title "<タイトル>" --body-file "<本文ファイルのパス>" --base <base>
gh pr view --json url,isDraft
```

- draft に対応していないリポジトリで作成に失敗したら、その結果を報告し、ready で作るかをユーザーに確認する。
- 作成後は、PR の URL、draft / ready の別、スキップしたチェック、PR に含まれなかった未コミットの変更を報告する。

### 8. 後処理（任意）

ラベルやレビュアーは、リポジトリで実際に使われていて（`gh label list` などで確認できる）、規約かユーザーの指示があるときだけ付ける。

```bash
gh pr edit --add-label "<ラベル>"
```

## 実行例

```bash
# Issue を自動で探し、draft で作成
/github-tools:pr

# Issue #31 を確認して紐付ける
/github-tools:pr 31

# ready で作成
/github-tools:pr --ready

# 本文の下書きだけを作る（PR は作らない）
/github-tools:pr --body-only
```

## 特徴

- **確認済みの Issue だけを紐付ける**: ブランチ名やコミットメッセージから候補を探し、`gh issue view` で確かめてから `Closes` を付ける
- **検証の証拠**: dev-core 導入時は `dev-core:verify`、未導入時はプロジェクトの lint / typecheck / test を実行し、結果を本文に書く
- **draft が既定**: ready は明示されたときだけ
- **本文はファイル経由**: 作業ツリーの外に書き、読み返してから `--body-file` で渡す
- **作業の保全**: 未コミットの変更を stash・破棄・自動コミットしない。作成直前に base と HEAD を照合する
