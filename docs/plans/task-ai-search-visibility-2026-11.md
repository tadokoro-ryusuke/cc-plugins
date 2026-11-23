# Task: AI 検索での見え方を扱うスキル `ai-search-visibility` の新設（2026-11）

- Status: ローカルコミット済み（push・PR・マージはユーザーが行う）
- Plan file: docs/plans/task-ai-search-visibility-2026-11.md
- codex 側の記録: codex-plugins の `docs/plans/task-ai-search-visibility-skill.md`
- Last updated: 2026-11-23

## 目標

1. AI の回答エンジン（ChatGPT search、Perplexity、Google の AI Overviews / AI Mode、Gemini、Copilot、Claude）での見え方について、適格性の確認、計測、ページと第三者ソースへの対応、業者の主張の監査を行うスキルを持つ。
2. 起点は、ある代理店の事例ページ（AEO で AI 経由のユーザーが 47 倍になったという主張）である。再利用できる手順と計測の作法を取り込み、数値と、規約や法に触れる手法は取り込まない。

## スコープ

- codex-plugins（正本・英語）: `plugins/indie-product-marketing/skills/ai-search-visibility/` を新設。SKILL.md、references 4 本、assets 4 本、script とテスト、`agents/openai.yaml`。既存スキルと `channel-strategy.md` からの導線、README、CI、0.4.0。
- cc-plugins: 日本語の SKILL.md、references・assets・scripts の同一コピー、`references/claude-code-runtime.md`、行動ケース 11 件、README（プラグインとルート）、マーケットプレイスの説明、CI と AGENTS.md の検証コマンド、0.2.0。

## 非目標

- push、PR の作成、マージ、インストール済みプラグインの更新（ユーザーが行う）。
- 行動ケースの実行（スキーマ検証だけを行った）。
- 起点にした調査レポートのコミット（扱いが未決。「Blockers And Open Questions」を参照）。
- 日本語のクエリでどのソースが引用されるかの調査。

## 判断

| ID | 判断 | 理由 |
|---|---|---|
| D1 | 既存の `channel-strategy.md` の拡張ではなく、4 つめのスキルにする | 独自のトリガー語（AEO・GEO・LLMO）と、独自の成果物（問いの地図、プロンプトセット、ソース台帳、ページ別の行動表）を持つ |
| D2 | codex のブランチは、main に未マージの `codex/indie-generalize`（PR #7、0.3.1）を取り込んだ上に積む | cc の references と assets は PR #7 のブランチに同期している。main（0.3.0）を土台にすると、同期の確認で既存スキルに差分が出る |
| D3 | 業者の枠組みと調査は、名前付きの出典として引く。採らない手法は一般形で書き、特定の業者に帰さない | 公開リポジトリである。出典の明示は必要だが、名指しで不利な所見を規則として配る理由は無い |
| D4 | 計測の集計は、テスト付きの script に出す | 区間と比較の判定は決定的なロジックで、その場の計算に任せると誤る。基準がゼロの場合の扱いも固定できる |
| D5 | 「需要が未検証なら使わない」を門にしない | 業者の提案の評価や、適格性の確認だけの依頼を弾いてしまう |
| D6 | references の記述は、原文を取得して該当箇所の前後を読んだものだけにする。確かめられなかったものは、その旨を references に書く | references は規則として読まれる |

## Completion Contract

| 条件 | 状態 | 証拠 |
|---|---|---|
| codex 側にスキル一式があり、検証とテストが通る | satisfied | codex `17e4e34`。`validate-codex-plugins.mjs`、`validate-skill-evals.mjs`（68 件）、script のテスト 24 件、オフラインテスト 127 件 |
| cc 側の references・assets・scripts が codex のコミットと一致する | satisfied | プラグインの README の「同期の確認」のコマンドで差分なし |
| cc 側の検証コマンドがすべて通る | satisfied | 「検証」の節 |
| 独立レビューを受け、指摘を一次情報で確かめてから反映した | satisfied | 「レビューの反映」の節 |
| スキルがインストールした状態で意図どおりに発火し、振る舞う | pending | 行動ケースは未実行 |

## 検証（2026-11-23 に実行）

- `node scripts/check-skills-drift.mjs`: passed
- `node scripts/check-plugin-agents.mjs`: passed（5 agents、171 references）
- `node scripts/validate-skill-evals.mjs`: passed（dev-core 55 件）
- `node scripts/validate-skill-evals.mjs --plugin indie-product-marketing`: passed（27 件）。indie-idea-discovery に負例が無いという警告は、この変更の前からある
- `node scripts/validate-claude-hooks.mjs`: passed
- `node --test scripts/*.test.mjs`: 34 件 passed
- `node --test indie-product-marketing/skills/ai-search-visibility/scripts/visibility-stats.test.mjs`: 24 件 passed
- `node --test design-core/skills/ui-visual-defaults/scripts/contrast.test.mjs`: 35 件 passed
- dev-core の hook のテスト 3 本: passed
- `claude plugin validate . --strict`、`claude plugin validate indie-product-marketing --strict`: passed
- 常時コスト: `claude --plugin-dir ./indie-product-marketing plugin details indie-product-marketing` で約 1,800 トークン（0.1.0 は 1,263）。Claude Code 2.1.330

これらは構成・参照・script の検査である。行動ケースの実行ではない。

## Dispatch Ledger

| Dispatch | 役 | 設定（requested → verified） | 入力 | 結果 |
|---|---|---|---|---|
| review-aisv-1 | 独立レビュー（読み取り専用） | `gpt-6.2-astra` / high / read-only → 起動時の出力で同じ値を確認。Codex CLI 0.166.0 | codex `ed28ccd` と未コミットの候補、リポジトリの規則、保存した出典の写し。結論と自己評価は渡していない | completed。指摘 44 件（P1 7、P2 29、P3 8） |

## レビューの反映

指摘は 1 件ずつ、コードか出典の原文で確かめてから反映した。

- **script**: 一律の変化に区間なしで方向の判定を出す、計測経路の違う行を混ぜる、`branded` の欠落を既定で補う、同じ行の再取り込みで率が変わる、片方の snapshot にしか無い群が消える、差の区間がありえない範囲に出る、表に件数が無い、失敗と回答なしの実行を区別できない、を確認して直した。`surface`・`run_id`・`branded` を必須にし、`question_id` と `status` を足した。
- **区間の書き方**: 「おおよその 95% 区間」と呼び、標本の前提を書き、言い換えを 1 つの問いにまとめるよう指示した。
- **オフサイトの判定**: レビューの対価の開示、中立な引用と選別した転載の区別、有料掲載と site reputation policy、レビューを頼める相手を、出典で確かめて直した。
- **個人情報**: 顧客の会話から作るプロンプトは、個人や会社を特定できる情報と秘密を取り除く、と書いた。
- **出典への忠実さ**: 数値の単位と対象の取り違え（Ahrefs、Graphite）、代理店の調査の循環性の指摘先、schema の結果の範囲、Microsoft の移行の期限、Search Console の設定の継承、運営者のレポートが出ない場合を直した。
- **採らなかったもの**: 「G2 は、G2 に知らせずに対価を出すことを禁じている」という記述は、取得した G2 の指針に見つからなかった。確かめられた範囲だけを書いた。

## Blockers And Open Questions

- **PR の順序**: codex-plugins の PR #7（`codex/indie-generalize`、0.3.1）が未マージである。今回の codex のブランチはそれを取り込んでいるので、PR #7 を先にマージするか、今回の PR に PR #7 の 2 コミットが含まれることを認める必要がある。取り込みのとき、README のリリースノートで競合が 1 か所あり、両方の項目を残して解消した。
- **調査レポートの扱い**: `docs/research/ai-search-visibility-aeo-2026-11.md` は未コミットで、名指しの業者について不利な所見を含む。そのままコミットするか、社名を伏せるか、別の場所に置くかは未決。
- **Reddit の規約**: 規約のページとヘルプは自動の取得を拒否された。`off-site-rules.md` の Reddit の行は、ニューヨーク州司法長官のサイトにある利用規約の写しと、検索結果の抜粋に基づく。
- **行動ケース**: 11 件を足したが、実行していない。

## Current Next Action

ユーザーが、(1) codex-plugins の PR #7 の扱いを決め、(2) 両リポジトリの push と PR の作成を指示し、(3) 調査レポートの扱いを決める。マージ後は、Codex 側で `codex plugin marketplace upgrade codex-plugins` と `codex plugin add indie-product-marketing@codex-plugins` を実行し、新しいスレッドを始める。Claude Code 側はプラグインを更新し、新しいセッションで `indie-product-marketing:ai-search-visibility` が一覧に出ることを確かめる。
