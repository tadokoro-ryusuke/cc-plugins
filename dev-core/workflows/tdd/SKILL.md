---
name: tdd
description: "単独のTDDサイクル（Red→Green→Refactor→Evidence）を実行する。新機能の実装・バグ修正をテストファーストで進めるときに /dev-core:tdd で起動する。commitは --commit 指定時だけ行う。"
argument-hint: "[機能名/テスト名] [--red テストのみ] [--green 実装のみ] [--commit]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Task(subagent_type:dev-core:tdd-practitioner)
---

# TDD サイクル実行

t-wada 式の TDD サイクルを単独で実行する。サイクルの定義・規律（Iron Law、合理化テーブル）の正本は `best-practices` スキルと `tdd-practitioner` エージェント。

最初に `$ARGUMENTS` から `--red`、`--green`、`--commit` を flags として分離し、残りを `TDD_TARGET` とする。

## 実行フロー

実装は **必ず Task ツールで `dev-core:tdd-practitioner` エージェントに委譲する**。直接実装しない。

### Phase 1: Red 🔴（失敗するテストを書く）

tdd-practitioner に以下を依頼する:

- 対象機能: $TDD_TARGET
- テストは具体的で明確であること。1 つの機能に対して 1 つのテスト
- 境界値とエッジケースを考慮

テストを実行し、**失敗の出力を確認してから**次へ進む（失敗を見ずに Green に進むのは違反）。

### Phase 2: Green 🟢（テストをパスさせる）

最小限のコードでテストをパスさせ、テスト実行出力で成功を確認する。

### Phase 3: Refactor 🔨（リファクタリング）

テストがグリーンの状態を維持しながらコード改善（重複の排除、命名の改善、構造の整理）。各変更後にテストを再実行する。

### Phase 4: Evidence ✅（証拠）

focused test と関連する lint/typecheck を実行し、実出力を記録する。`--commit` 指定がある場合だけ、変更ファイルを個別指定で `git add` し、Conventional Commits 形式でコミットする。

## 報告ルール

各フェーズの完了報告には、**そのフェーズで実際に実行したテストコマンドの出力（パス/失敗数）を引用する**。実行していないのに ✅ を書くことは禁止。所要時間・行数などの計測していないメトリクスは書かない。

## オプション

- `--red`: Phase 1 のみ実行（テスト作成）
- `--green`: Phase 2 のみ実行（実装）
- `--commit`: 検証後に変更を明示的にコミット

## 使用例

```
/dev-core:tdd "ユーザーログイン機能"
/dev-core:tdd "パスワードリセット" --red
/dev-core:tdd --green
```
