---
name: tdd
description: "単独のTDDサイクル（Red→Green→Refactor→Evidence）を実行する。新機能の実装・バグ修正をテストファーストで進めるときに /dev-core:tdd で起動する。単独で起動したときは親が実装する。commitは --commit 指定時だけ行う。"
argument-hint: "[機能名/テスト名] [--red テストのみ] [--green 実装のみ] [--commit]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Agent(dev-core:tdd-practitioner)
---

# TDD サイクル実行

t-wada 式の TDD サイクルを単独で実行する。サイクルの定義と規律（Iron Law）の正本は `dev-core:best-practices` スキル。

最初に `$ARGUMENTS` から `--red`、`--green`、`--commit` を flags として分離し、残りを `TDD_TARGET` とする。

## 実行の担当

単独で起動したときは、親（このセッション）が実装する。1つの振る舞いの Red → Green → Refactor は密結合で逐次の作業なので、分けても文脈の受け渡しが増えるだけになる。

`Agent(dev-core:tdd-practitioner)` に委譲するのは、次のときだけにする（原則は `dev-core:best-practices` の `references/delegation-and-review.md`）。

- 対象が、親が進めている作業と書き込み範囲・依存の重ならない独立トラックになっている
- テストやビルドの出力が大きく、親の文脈から隔離したい

委譲するときは、対象の振る舞い、書き込みを許すファイル、受け入れチェック（実行するテストコマンド）だけを渡す。子の報告にある実行コマンドと生の結果を親が確かめてから、次のフェーズへ進む。plan があればその Decision Log に、なければ報告に、委譲の理由を1行残す。

## 実行フロー

### Phase 1: Red 🔴（失敗するテストを書く）

- 対象機能: $TDD_TARGET
- テストは具体的で明確にし、1 つのテストで 1 つの振る舞いを確かめる
- 境界値とエッジケースを考慮する

テストを実行し、**失敗の出力を確認してから**次へ進む。失敗を見ずに Green に進むと、テストが対象の振る舞いを確かめているかが分からないため。

### Phase 2: Green 🟢（テストをパスさせる）

最小限のコードでテストをパスさせ、テスト実行出力で成功を確認する。

### Phase 3: Refactor 🔨（リファクタリング）

テストがグリーンの状態を維持しながらコード改善（重複の排除、命名の改善、構造の整理）。各変更後にテストを再実行する。

### Phase 4: Evidence ✅（証拠）

focused test と関連する lint/typecheck を親がツールで実行し、実出力を記録する。`--commit` 指定がある場合だけ、変更ファイルを個別指定で `git add` し、Conventional Commits 形式でコミットする。

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
