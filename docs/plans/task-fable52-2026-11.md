# Task: Fable 5.2 リリースの影響調査（2026-11）の改善を実装する

- Status: in progress（draft PR の作成待ち）
- Plan file: docs/plans/task-fable52-2026-11.md
- 調査報告: docs/research/fable-5-2-impact-2026-11.md（正本。§3 と §4 の修正後の内容に従う）
- 候補ごとの台帳（補足資料）は作者のローカルにだけ置く。Codex のレビュー前の内容なので、報告書と食い違うときは報告書と本書の「上書き」を優先する
- Last updated: 2026-11-12

## 目的と権限

報告書の束 1〜8 のうち、リポジトリの中で直せるものを実装する。ユーザーは「必要な内容を対応してください」と依頼した（2026-11-12）。

### 実施すること

- cc-plugins と codex-plugins の feature ブランチを push し、**draft PR** を作成する。

### 実施しないこと

- main への push、merge（merge はユーザーが行う）
- インストール済みプラグインの更新、`codex plugin add` による再インストール
- Issue の作成
- 利用者の環境の設定（報告書 §5。リポジトリの外で、各自が確かめる）

## 束とブランチ

| 束 | ブランチ | 版 | 対象の ID |
|---|---|---|---|
| A. hotl | `feature/fable52-hotl` | hotl 2.2.0 | D2-01〜D2-10、D5-01〜D5-03 |
| A'. hotl のミラー | `codex/fable52-hotl` | codex hotl 2.2.0 | 束 A のうち codex に当てはまるもの |
| B. dev-core と検査 | `feature/fable52-dev-core` | dev-core 5.2.0（.claude-plugin と .codex-plugin を揃える） | D1-01〜D1-04、D1-06〜D1-09、D6-07、GAP-01、GAP-04、D4-01〜D4-05、D6-04 |
| B'. dev-core のミラー | `codex/fable52-dev-core` | codex dev-core 5.7.0 | D4-01（conventions-as-guardrails）、D4-02 の (b)(c)（continuous-learning） |
| C. ai-engineering と compliance-core | `feature/fable52-knowledge` | ai-engineering 0.5.0、compliance-core 0.3.0 | D3-01〜D3-10、D3-13、D5-04〜D5-06 |
| D. 計測・記録・規約 | `feature/fable52-tooling` | プラグインの版は上げない | D6-02、D6-03、D6-05、D6-06、GAP-05、GAP-07、GAP-08、D1-10、報告書と本書 |

ファイルの持ち主は束ごとに1つにする。`.github/workflows/skills-drift-check.yml` は束 B、AGENTS.md と README.md（ルート）は束 D が持つ。marketplace.json は触らない。

codex-plugins の A' と B' は、ルートの README.md の「Source update migration」の同じ位置に項目を足すので、B' は A' の上に積む（B' の PR の base は A' のブランチ）。

## 上書き（台帳のままでは誤る点）

- D2-01・D5-01: 対象は thinking が既定で有効なモデル（Opus 5 以降、Sonnet 5 以降、Haiku 5.5、Fable 系）。Opus 4.7・4.8 は省略すると thinking なし。`max_tokens` の既定は 16000 程度まで。64K 以上の案は採らない（非ストリーミングの SDK 呼び出しのため）。effort を送るなら、固定している SDK（`>=1.17,<2`）が `output_config` を受け付けるかをネットワークなしの契約テストで先に確かめる。SDK の例外はすでにメッセージ先頭 200 字が出るので、足すのは黙って捨てる票の理由と `stop_reason`。
- D2-02: 重大度 P2。「自動では注入されない」。プロンプトで CLAUDE.md を明示的に読ませる。`--setting-sources user` は外さない。PR が変えた CLAUDE.md は指示ではなくレビューの対象として扱う。
  - 実装時に変えた点（Codex のレビュー）: claude-code-action が base の版に戻すのは、ルートの CLAUDE.md や `.claude/` など決まったパスだけで、CLAUDE.md が参照する AGENTS.md などは PR の head の版のまま残る。そこで ai-review は、PR の base の tree を `git archive` で `$RUNNER_TEMP/trusted-base/` に書き出し、そこにある CLAUDE.md とその参照先を読ませる。codex のミラーは規範が AGENTS.md で、action はこれを戻さないので、同じ書き出しを使う。
- D2-04: 「国内処理が要件なら」の条件付き。テンプレートの要件は「Anthropic の直 API に出さない」こと。
- D2-06: 条件は「Opus の pin か、プロバイダのモデル一覧に Opus 4.8」。Sonnet 5.5 はさらに Sonnet の pin か Sonnet 5。値はリポジトリ変数で受け取り、テンプレートにモデル ID を書かない。
- D3-08: モデルごとの制約（forced tool_choice は Fable 5.1/5.2・Mythos 5.1/5.2・Opus 5.5・Sonnet 5.5。prefill は 4.6 以降のほぼ全モデル）と API の版の制約（2026-10-21 では sampling を送ると全モデルで 400）を分ける。
- D4-02・D3-12: 足すのは棚卸しと期限だけ。原因の分類と Hook への昇格はすでにある。
- D1-04 と GAP-01: 1つの変更。判定は完全 ID の denylist にし、fixture・規則のコード名・メッセージ・`skills-drift-check.yml` の期待コード一覧を揃えて変える。

## 実施しないもの

- D6-01（D1-04 と逆向き）、D1-05（反証済み）、D3-11（D4-01 と重複）
- D4-06・D4-07（Fable 5.2 で観測してから入れる）
- GAP-02・GAP-03・GAP-06（リポジトリの外。利用者の環境で扱う）
- 台帳の正規表現で付いた MIRROR の誤検出（D5-04・D5-05・D5-06。ai-engineering と compliance-core は codex にミラーしない）

### 実装で見送ったもの

- D5-01 (3): judge の出力を structured outputs に置き換える案。judge の出力契約（ルーブリックと正規表現）を変えることになるので、別の変更にする。
- D2-04 (4): LIGHT と DEEP の役割の目安。上位ティアの判断は、F4 の「現行モデルの effort を上げた結果と比べる」で扱った。
- D6-05 の一部: 検証を 1 本のランナーにまとめる案。今回は AGENTS.md の検証コマンドを CI と揃えるところまで。
- D6-02 (3) の実地確認: plugin eval で `CLAUDE_CODE_EFFORT_LEVEL` が子に渡るかを trace で確かめるには課金される実行が要る。`gen-plugin-evals.mjs` に「初回に trace で確かめる」と書いた。
- codex のミラーで、Claude Code 固有のもの（`/doctor` の prompt-audit、CLAUDE.md の復元の履歴）と、codex 側にすでにあるもの（D4-02 の (a)(d)）。

## Completion Contract

| ID | 完了条件 | 証拠 | 状態 |
|---|---|---|---|
| AC-1 | 束 A〜D と A'・B' が、それぞれのブランチにコミットされている | 各ブランチの `git log origin/main..HEAD`（cc は 4・4・5・5 件、codex は 3・2 件） | done |
| AC-2 | 各束で検証一式が pass する（AGENTS.md の検証コマンド、`node --test scripts/*.test.mjs`、hotl の Python テスト、codex は `validate-codex-plugins.mjs`） | cc の 4 ブランチ: AGENTS.md の一式・CI の負例 fixture・hotl の unittest（PyYAML 6.0.2、anthropic 1.17.0）・marketplace と 8 プラグインの strict validate・`git diff --check` の 23 項目が全部 pass。codex の 2 ブランチ: `validate-codex-plugins.mjs`・`validate-skill-evals.mjs`・unittest（127 件と 111 件）・`git diff --check` が pass（2026-11-12、Claude Code 2.1.322） | done |
| AC-3 | 振る舞いが変わる変更にテストがある（check-plugin-agents の負例、run_evals の票の理由と stop_reason、measure-skill-firing の --effort と --max-budget-usd、session-start-context の期待文字列） | 各テストを先に書いて失敗を確かめてから実装した（束 A・B・D の実装記録）。ai-review の base の書き出しにもテストがある（`scripts/tests/test_workflows.py`） | done |
| AC-4 | 束ごとに独立レビュー（Codex）を通し、指摘を実ファイルで確かめて反映した | 下の Progress Log | done |
| AC-5 | draft PR が作成されている | PR の URL | pending |

## Progress Log

- 2026-11-12: 調査報告を作成し、Codex のレビューを反映した。6 本のブランチを origin/main（cc 70a6f01、codex 9c82ff9）から作った。
- 2026-11-12: 束 A〜D と A'・B' を実装した。Codex のレビューと反映は次のとおり。
  - 束 A（中 1・低 1）: 中は「CLAUDE.md の参照先を PR の head から読める」。base の tree の書き出しで直した（上書きの D2-02）。低は「results.json に judge のモデル ID が無い」。summary に `judge_model` を足した。
  - 束 B: 指摘 0 件。主張は一次情報（changelog と model-config）で照合した。
  - 束 C（中 1）: 「fallback 先には前の推論が引き継がれない」は言い過ぎ。thinking block を読めるかは、モデルの組と基盤で確かめるように直した。
  - 束 D（低 1）: 本書に利用者の設定値とローカルの管理状態が書いてあった。一般化した。
  - A'（中 1・低 1）: 中は「モデルを替えるとき強制ゲートを外して Phase 1 に戻す案内」。強制を保ったまま新旧を比べる手順に直した。低は「Claude Code が AGENTS.md を読む条件」の書き方。
  - B': 指摘 0 件。
- 2026-11-12: 6 本の検証一式を、実装したエージェントとは別に再実行し、全部 pass した（AC-2）。

## Current Next Action

6 本のブランチを push し、draft PR を作る。B' の PR は A' のブランチを base にする。PR を作ったら AC-5 を更新する。
