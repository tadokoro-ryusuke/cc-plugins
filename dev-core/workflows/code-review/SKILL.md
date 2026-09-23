---
name: code-review
description: "dev-core の規約レンズ（FSD / Clean Architecture / DDD の層・依存方向・集約境界、セキュリティ規約、コーディング規約）でコードをレビューする。PR・コミット・特定ファイルが dev-core の設計規約とセキュリティ規約に沿っているかを確かめたいときに /dev-core:code-review で起動する。規約に限らないバグ探索全般は Claude Code 組み込みの /code-review を使う。"
argument-hint: "[PR番号/#123] [ファイルパス] [--strict 低確度・P3 の指摘も個別に表示]"
allowed-tools: Read, Grep, Glob, Agent(dev-core:code-reviewer)
---

# 規約レンズのコードレビュー

変更が dev-core の設計規約とセキュリティ規約に沿っているかを評価する。規約の正本は `dev-core:best-practices`（`references/architecture.md`、`references/security.md`、`references/coding-standards.md`）で、評価の進め方と出力形式の正本は `dev-core:code-reviewer` エージェント。

## 組み込みの /code-review との分担

| 観点 | 使うもの |
| --- | --- |
| FSD / Clean Architecture / DDD の層・依存方向・集約境界、セキュリティ規約、dev-core のコーディング規約 | `/dev-core:code-review`（この skill） |
| 規約に限らないバグ探索（正しさ、境界条件、再利用・簡素化） | Claude Code 組み込みの `/code-review` |

両方が要る変更では、それぞれを別に実行する。この skill では汎用のバグ探索を網羅しようとせず、規約のレンズに絞る。規約の知識は dev-core が持ち、汎用のバグ探索は組み込みのほうが広く扱えるため。

## 実行フロー

### 1. レビュー対象の特定

引数に応じて対象を特定する:

- `#123`: PR 番号 → `gh pr diff 123`
- ファイルパス → 指定ファイル
- なし → 最新のコミット変更（`git diff HEAD~1`）

### 2. code-reviewer への依頼

ユーザーがレビューを明示的に依頼しているので、新しい文脈の `Agent(dev-core:code-reviewer)` に1回依頼する。渡すのは、対象の diff の識別子（PR 番号、base と head、またはファイル）、ユーザーの依頼文、次のレンズで、実装の経緯や自己評価は渡さない。

1. **アーキテクチャ規約**: FSD のレイヤー間の import 方向と公開 API、Clean Architecture の依存方向（ドメインが外側の層に依存しない）、DDD の集約境界と不変条件の置き場所
2. **セキュリティ規約**: 入力検証、認証・認可の欠落、秘密情報のハードコードやログ出力、エラーメッセージからの情報漏洩
3. **コーディング規約**: 命名・エラー処理・型の規約。プロジェクトに既存の規約があれば、そちらを優先する

### 3. 結果の報告

- 各指摘には、重大度（P0〜P3）、確度、実在する file:line、根拠にした規約、修正案を付ける。file:line か根拠が欠けた指摘は差し戻す。
- code-reviewer には指摘を全件返させ、絞り込みはこの段で行う。既定では P3 と確度の低い指摘を「要確認」としてまとめて示し、`--strict` のときはそれらも個別に示す。
- スコアや総合評価は付けない。
- 規約の外にあるバグの疑いが見つかったときは、指摘として残したうえで、組み込みの `/code-review` での確認を案内する。

## 使用例

```
/dev-core:code-review #123
/dev-core:code-review src/features/auth/
/dev-core:code-review --strict
```
