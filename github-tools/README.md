# GitHub Tools Plugin

GitHub連携ワークフローを支援するClaude Codeプラグインです。

## 機能

| スキル | 説明 |
|--------|------|
| `/github-tools:pr` | 現在のブランチからPull Requestを作成 |
| `/github-tools:docs` | コード変更に合わせてドキュメントを更新 |

いずれもユーザー起動専用（`disable-model-invocation: true`）。

## インストール

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install github-tools@cc-plugins
```

## 使用例

### 新機能開発フロー（dev-coreプラグインと連携）

```
# 1. 要件整理 → 計画（Issue は --issue 指定時だけ作成）
/dev-core:task ユーザー認証機能を追加

# 2. TDD実装
/dev-core:execute docs/plans/task-user-auth.md

# 3. Pull Request作成（既定は draft）
/github-tools:pr
```

### ドキュメント更新

```
# コード変更後にドキュメントを更新
/github-tools:docs
```

## 特徴

### `/github-tools:pr`

- **確認済みの Issue 連携**: ブランチ名やコミットメッセージから Issue 番号の候補を探し、`gh issue view` で存在と内容を確かめたときだけ `Closes` を付ける
- **品質保証**: PR作成前にlint/typecheck/testを実行（dev-core 導入時は `dev-core:verify` を使い、未導入時はプロジェクトのコマンドを直接実行）。失敗や未実行のチェックは成功と区別して本文に書く
- **テンプレート**: プロジェクト固有のPRテンプレートがあれば従う
- **変更分析**: 変更の種類（feat/fix/docs など）をリポジトリの規約に合わせて判定する
- **draft が既定**: `--ready` か明示の指示があるときだけ ready で作成する。`--body-only` では本文の下書きだけを作り、PR は作らない
- **本文はファイル経由**: 本文を作業ツリーの外のファイルに書き、`--body-file` で渡す
- **作業の保全**: 未コミットの変更を stash・破棄・自動コミットしない。作成直前に base と HEAD が分析時から変わっていないかを確かめる

## 前提条件

- GitHub CLI (`gh`) がインストールされていること
- GitHub認証が完了していること (`gh auth login`)

## 関連プラグイン

- **dev-core**: TDD開発フロー、要件整理、Issue作成（任意。pr スキルの品質チェックで `dev-core:verify` を利用）
  - dev-core 5.0.0 以降と組み合わせる場合は、github-tools 2.1.0 以上を使う。2.0.0 の pr は、dev-core 5.0.0 で廃止された quality-checker エージェントを呼ぶため

## ライセンス

MIT
