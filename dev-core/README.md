# Dev Core Plugin

TDD 開発フレームワーク。t-wada 式 TDD、FSD、Clean Architecture、DDD のベストプラクティスを、知識スキル・ワークフロー・専門エージェント・Hooks 自動化の4層で提供します。

5.1.0 では、テストを弱めて通すことの禁止と検出、テストの書き方の正本（best-practices/references/testing.md）、危険コマンドのフックの作り直し、security-auditor と E2E の返却の統一を入れました（[変更点](#510-の変更点)）。

5.0.0 から、親セッションが既定の実装者になりました。サブエージェントへの委譲とレビューは、利得とリスクに当てはまるときだけ行います（[Opus 5.5 での運用](#opus-55-での運用)、[4.x → 5.0.0 への移行](#4x--500-への移行)）。

## どんな時に使うか

### 新機能開発

```
/dev-core:grill 認証方式の選択肢を検討  # 重要判断を一度に1問ずつ圧力テスト
/dev-core:task ユーザー認証機能を追加    # 調査 → 証拠付き計画
/dev-core:task ユーザー認証機能を追加 --issue # 明示時だけIssue作成
/dev-core:execute docs/plans/task-*.md   # TDD 実装
/dev-core:verify                         # 6段階検証
```

### バグ修正

```
/dev-core:debug "エラーメッセージ"       # 4フェーズ根本原因分析
/dev-core:tdd "バグ修正: ..."            # TDD サイクルで修正
```

### コードレビュー・改善

```
/dev-core:code-review                    # 規約レンズ（FSD/CA/DDD・セキュリティ規約）でのレビュー
/code-review                             # バグ探索全般（Claude Code 組み込み）
/dev-core:refactor                       # リファクタリング
```

## 構成（2層スキル + エージェント + Hooks）

### 知識スキル（`skills/` — Codex と共有）

ツール非依存の開発原則。Claude が文脈に応じて自動ロードし、`/dev-core:<skill>` でも起動できる。主なスキルは次のとおり。全スキルの一覧はリポジトリルートの [AGENTS.md](../AGENTS.md) のスキルインデックスにある。

| スキル | 内容 |
|--------|------|
| best-practices | TDD/SOLID/コーディング規約のコア原則。詳細は references/{coding-standards,architecture,security,delegation-and-review}.md に progressive disclosure。delegation-and-review は実装の所有・委譲・リスクゲートのレビューの原則 |
| frontend-patterns | Webフロントエンドのコンポーネント設計・状態管理・フォーム・データフェッチ・アクセシビリティ・性能・テストのパターン（フレームワーク非依存。取得手段はレンダリングモデルに合わせて選ぶ） |
| backend-patterns | API設計、Repository、サービス層パターン |
| verify | 6段階検証フロー（build→type→lint→test→security→diff）。証拠ベース完了判定（Iron Law）の正本。検証コマンドはプロジェクトから自動検出 |
| debug | 4フェーズ根本原因分析。Three Strikes Rule（3回失敗で STOP）の正本 |
| continuous-learning | Mitchell Hashimoto 式の複利的改善ループ |
| codex-collab | Claude Code ⟷ Codex 協働（セカンドオピニオン/レスキュー）の駆動 |

### ワークフロー（`workflows/` — Claude Code 専用）

計画・実行・レビューの手順を定めるタスク型スキル。親セッションが実装し、サブエージェントへの委譲は条件に当てはまるときだけ行う。`/dev-core:code-review` 以外は**ユーザー起動専用**（`disable-model-invocation: true`）。

| コマンド | 用途 |
|----------|------|
| `/dev-core:grill` | 重要な計画・判断を一度に1問ずつ圧力テスト |
| `/dev-core:task` | リポジトリ調査 → 証拠付き完了条件 → TDD計画を親が書く。Issueはopt-in |
| `/dev-core:execute` | 永続計画に基づく自律実行。親が実装し、委譲とレビューは条件に当てはまるときだけ。commit/PRはopt-in |
| `/dev-core:tdd` | 単独TDDサイクル。単独で起動したときは親が実装する |
| `/dev-core:refactor` | リファクタリング。検証は `dev-core:verify` |
| `/dev-core:code-review` | 規約レンズ（FSD/CA/DDD の層・依存方向、セキュリティ規約、コーディング規約）でのレビュー。バグ探索全般は組み込みの `/code-review` |
| `/dev-core:debug-team` | Agent Teamで競合する仮説を並行に検証するバグ調査 |
| `/dev-core:e2e` | Playwright E2Eテスト |

### エージェント（`agents/`）

エージェントは、親が委譲を決めたときだけ使う。実行系は `model` を省略して親のモデルに追従し、レビュー系は `model: inherit` を明示する。effort は役割ごとに frontmatter で固定している（理由と効く条件は [Opus 5.5 での運用](#opus-55-での運用)）。必要な知識スキルは frontmatter の `skills` でプリロードされる。

| エージェント | 役割 | model | effort |
|-------------|------|-------|--------|
| tdd-practitioner | 書き込み範囲と受け入れチェックが確定した実装単位を、委譲を受けて TDD で実装する | 省略（親に追従） | medium |
| build-error-resolver | ビルド・型チェックのエラーを最小の diff で修復する。大量のエラーログを親の文脈から切り離す | 省略（親に追従） | medium |
| e2e-runner | Playwright E2E の実行とデバッグ。ログを親の文脈から切り離す | 省略（親に追従） | medium |
| code-reviewer | リスクゲートに当たる変更を、新しい文脈で独立にレビューする | inherit | high |
| security-auditor | セキュリティ・権限・秘密情報の境界に触れる変更を独立に監査する | inherit | high |

### フック（`hooks/` + `scripts/` — 自動実行）

| タイミング | 処理 | 実体 |
|-----------|------|------|
| SessionStart | allowlist済みrepository metadata + 未完了planのpath/status + 作業規律（リスクに応じた検証、証拠の再利用条件、同じ経路での Three Strikes）の注入 | scripts/session-start-context.sh |
| PreToolUse:Bash | 代表的な誤操作の tripwire。止める: rm -r でのルート・ホームの削除、main/master への強制 push、DB クライアントでの DROP/TRUNCATE。確認に回す: 作業ツリーを捨てる git 操作（reset の hard、clean の force、restore . など）。引用符の中身と heredoc の本文は照合しない | scripts/block-dangerous-commands.sh |
| PostToolUse:Write\|Edit | Prettier自動フォーマット（設定があるプロジェクトのみ） | scripts/format-changed-file.sh |
| Stop | 停止前の検出: 追加行のデバッグ残骸（console.log/debugger 等）、テストファイルに追加された focus/skip マーカー、テストファイルの削除。未追跡の新規ファイルも対象 | scripts/stop-quality-gate.sh |

危険コマンドのフックは best-effort の tripwire で、完全なセキュリティ境界ではない。rm の重要パス（/、~、作業ディレクトリとその親）は Claude Code 本体が全モードで自動承認しない。プラグインからは permissions.deny を配布できないので、厳密に止めたい操作は利用者の settings に書き、main への強制 push はサーバー側の branch protection でも止める。例:

```json
{
  "permissions": {
    "deny": ["Bash(git push --force *)", "Bash(git push -f *)", "Bash(terraform destroy *)"]
  }
}
```

フックの回帰テストは `scripts/test-block-dangerous-commands.sh`（止める・通す・確認に回すの3つの表）で、CI で実行する。jq が無いときは止めずに通し（non-blocking error）、SessionStart で一度だけ知らせる。

Claude Code の現行hook仕様では SessionStart/PreCompact は prompt handler 非対応。planの永続化は `/execute` が各iteration・停止・圧縮前に行い、SessionStart command hook はplan本文をdeveloper contextへ流さず再開対象だけを知らせる。`scripts/validate-claude-hooks.mjs` がevent/type互換性をCIで検証する。

検出パターンの追加 = continuous-learning スキルの実践箇所。スクリプトと回帰テスト（`scripts/test-stop-quality-gate.sh`、CI で実行）を編集してフック自体を成長させる。Stop フックの検出は文字列照合による best-effort で、テストの弱体化をすべて捕まえるものではない（アサーションの純減やスナップショットの一括更新は verify の Diff ステップで判断する）。Stop には `onFailure` が効かないので、jq や git が無い、スクリプトが異常終了したときは停止を通す（fail-open）。

`dev-core/evals/skill-behavior-cases.json` は grill の trigger/no-trigger、可逆な判断の継続、不可逆判断の停止、現在証拠による完了判定、TDD/refactor/debugのdelivery side effect禁止、テストを弱めて通さないこと（best-practices・verify）、単独 TDD の全体テストに加え、実行トポロジー（密結合な作業を親が持つ、独立トラックだけを委譲する、lint に agent を立てない、リスクゲートのレビューとその代替、テキストだけの end_turn を完了にしない、証拠の再利用、同じ経路での Three Strikes）を行動ケースとして固定する。`node scripts/validate-skill-evals.mjs` は schema と参照 skill を決定的に検証する静的gateであり、model挙動の採点は将来のcalibrated live evalで行う。

## Opus 5.5 での運用

必要な Claude Code は 2.1.280 以上です（agent frontmatter の `effort` と Opus 5.5 の既定 effort に依存）。下に書く呼び出しごとの effort 指定は 2.1.292 以上、effort から切り離された ultracode は 2.1.284 以上の挙動です。

**推奨するセッションの使い分け**

- 計画（`/dev-core:task`・`/dev-core:grill`）: high 以上
- 実行（`/dev-core:execute`）: medium。Opus 5.5 の既定値で、Anthropic の評価ではコーディングで Opus 5 の high と同等以上
- xhigh / max は、効果を測れた作業に限る

dev-core はセッション（親）の effort を変えません。skill の frontmatter にも effort を置いていません。`/dev-core:execute` は、開始時の実効 effort が xhigh 以上なら一度だけ medium を案内し、そのまま続けます。

**agent の effort を固定している理由**

effort を書かない agent は、セッションの effort で動きます。親を xhigh に上げると、委譲した実装やログの隔離まで xhigh になります。そこで役割ごとの既定値を frontmatter に置いています（`scripts/agent-effort-pins.json` が正本）。この README で「固定」と呼ぶのは、この既定値のことです。

frontmatter の effort は既定値で、次の2つがこれを上書きします。

- 呼び出しごとの指定（2.1.292 以上）: ユーザーが「high でレビューして」のように頼むと、Claude は fork でない subagent の呼び出しに effort を渡せます。渡した値は frontmatter より優先されます。渡すかどうかは Claude が決め、dev-core のワークフローからは渡していないので、頼まなければ既定値で動きます。
- `CLAUDE_CODE_EFFORT_LEVEL`: 呼び出しごとの指定と frontmatter の両方に優先します。

ultracode は 2.1.284 から effort と切り離されました。`/effort` のトグルや `ultracode` 設定で入れても、effort は変わりません。xhigh になるのは、`claude --effort ultracode` で起動したときと、Agent SDK で effortLevel に ultracode を渡したときだけです。

| 状況 | 固定の効果 |
|---|---|
| 既定の Opus 5.5 medium セッション | 実行系は変わらない（元から medium）。レビュー系だけが high に上がる |
| 親を high / xhigh に上げた（`--effort ultracode` での起動も xhigh になる） | 実行系は medium のまま。レビュー系は high に揃う（xhigh のセッションでは high に抑えられる） |
| 親が Fable 5.1 / Sonnet 5（既定 high） | 実行系は medium に下がる。実行系は model を省略しているので、親と同じモデルで動く |

**固定を変えたいとき**

固定値はプラグインの設定では上書きできません（プラグイン agent の model と effort を settings で変える要望は、not planned で閉じられています）。代わりに次を使います。

- 呼び出しごとの指定（2.1.292 以上）: 「security-auditor を xhigh で」のように頼む。その呼び出しだけに効く
- `CLAUDE_CODE_EFFORT_LEVEL`: 親も子もすべて同じ effort にする
- `maxEffortLevel`（settings）: 上限をかける
- 親が Fable 5.1 のときに実行系を安くしたい: `CLAUDE_CODE_SUBAGENT_MODEL=opus`（model を省略している実行系にだけ効く。レビュー系は `inherit` なので対象外）

出典（2026-10-26 確認）: [sub-agents の Choose an effort level](https://code.claude.com/docs/en/sub-agents#choose-an-effort-level)、[model-config の Adjust effort level](https://code.claude.com/docs/en/model-config#adjust-effort-level)、[Claude Code CHANGELOG の 2.1.284 と 2.1.292](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)、[anthropics/claude-code#79866](https://github.com/anthropics/claude-code/issues/79866)

## 5.1.0 の変更点

- **テストの完全性**: 仕様の変更を根拠にしないテストの改変（削除・skip/only・期待値の緩和・テスト入力の特別扱い）で通さない。verify の Diff ステップと Stop フックで検出し、単独の TDD でも完了前に全体テストを回す。flaky の隔離には owner・期限・代替カバレッジを付ける
- **テストの書き方の正本**: `skills/best-practices/references/testing.md`（期待値の出し方、テストダブルの優先順位、自前の DB の実物での integration、テストデータ、E2E のロケータ）
- **フック**: 危険コマンドのフックは、引用符と heredoc を除いたコマンドの位置だけを照合する tripwire にし、戻せる操作は確認に回す。Stop フックは未追跡ファイル、focus/skip マーカー、テストファイルの削除も検出する。どちらも回帰テストを CI で回す
- **委譲先**: security-auditor を重大度（P0〜P3）・確度・file:line の契約に揃え、OWASP Top 10:2025 に更新した。e2e-runner に状態付きの返却を入れ、ロケータを Playwright の推奨順にした
- **ワークフロー**: refactor は振る舞いを変えず（バグは報告）、テストの薄い対象は特性テストで固定する。debug は赤くなる再現から始める。3回失敗後の別モデルへの委譲は同意か事前許可があるときだけ
- **data-design-ops**: 本番で `EXPLAIN ANALYZE` を使わない。主キーに UUID を使うなら時刻順の UUIDv7（または ULID）にする
- **security-by-design**: 依存監査の CI ゲート基準の正本を置いた（既定は High 以上で fail、例外は除外ファイルだけ）。AI エージェントの脅威対策を OWASP LLM Top 10 2026・Agentic Top 10・MCP 2026-07-28・AISVS 1.01 に合わせた
- **cicd-release-design**: サプライチェーン対策（新着版のクールダウン、install script、frozen install、Trusted Publishing、Actions の SHA ピンの強制）を references/supply-chain.md に足した
- **frontend-patterns**: レンダリングモデルごとの取得手段、アクセシビリティの実装、Core Web Vitals、テストの書き方を足した
- **data-auth-boundary-design / interface-contract-design**: 外部公開 ID は非連番にするが、推測困難さには頼らない（IDOR はサーバ側の認可で防ぐ）。共有リンクなどの capability トークンは ID と別に作り、作り方の正本を data-auth に置いた。MCP のツールとスキーマも対外契約に含めた

## 4.x → 5.0.0 への移行

**変わったこと**

- 実装は親が行います。`/dev-core:tdd`・`/dev-core:refactor` は単独起動で子に委譲しません。
- 委譲するのは、独立トラック、大量出力の隔離、リスクゲートの独立レビューの3つの場合だけです。
- バッチごとのレビューをやめました。安定した候補がリスクゲートに該当するときに、1回だけレビューします。

**廃止した agent / workflow と代替**

| 廃止 | 代替 |
|---|---|
| quality-checker | 親が `dev-core:verify` とプロジェクトの lint / typecheck / test を直接実行する |
| issue-creator | 親が `gh issue create --body-file` で作成する（`/dev-core:task --issue`） |
| task-planner | 親が計画を書く。広い調査には組み込みの Explore を使う |
| task-team | `/dev-core:task` の後、計画を新しい文脈で1回レビューする |
| doc-updater・architecture-guide | なし（どの workflow からも使われていなかった） |

**組み合わせの前提**

github-tools は 2.1.0 以上を使ってください。2.0.0 の `/github-tools:pr` は廃止した quality-checker を呼びます。

**自分の設定・CLAUDE.md の確認**

廃止した agent 名を参照している指示があれば、上の代替に置き換えてください。

## Codex 互換・協働

dev-core の知識スキル（`skills/`）は Agent Skills 標準準拠で、Claude Code と Codex の双方から利用できます。`workflows/` は Claude Code 専用（Codex には共有されない）。

- **Codex から使う（2経路）**:
  - 経路A: `.codex-plugin/plugin.json` を持つ dev-core を Codex の plugin として install（bundled skills）
  - 経路B: `scripts/setup-shared-skills.sh` で利用者プロジェクトの `.agents/skills/<skill>` を SSoT（`dev-core/skills`）へ symlink
- **Codex 権限設定**: Claude Code の `permissions.allow/deny` は、Codex では permission profiles（filesystem/network）と rules（command allow/prompt/forbidden）へ分けて移行。
- **協働ワークフロー**: `codex-collab` スキルが Claude 実装 → Codex レビュー（`/codex:review`）/ レスキュー（`/codex:rescue`）を駆動。Three Strikes Rule・Zero Trust Review と統合。リスクゲートの必須レビューで code-reviewer を起動できないときの代替にもなる。前提に codex-plugin-cc（OpenAI 公式）。
- **構成検証**: `scripts/check-skills-drift.mjs` + `scripts/check-plugin-agents.mjs` + `scripts/validate-claude-hooks.mjs` + `claude plugin validate --strict`（CI: `.github/workflows/skills-drift-check.yml`）が frontmatter 標準準拠・マニフェスト整合・agent の effort 固定と参照先・hook互換性・インデックス整合を静的検証。

詳細・移行手順:

- [`docs/codex-interop/shared-skills-setup.md`](../docs/codex-interop/shared-skills-setup.md)
- [`docs/codex-interop/codex-permissions.md`](../docs/codex-interop/codex-permissions.md)

## プロジェクト設定

`.claude/dev-core.local.md` でプロジェクト固有の設定（verify スキルが最優先で参照する）。コマンドは言語・スタックに合わせて記述する:

```markdown
<!-- 例1: Node.js (pnpm) -->
---
package-manager: pnpm
build-command: pnpm build
typecheck-command: pnpm typecheck
lint-command: pnpm lint
test-command: pnpm test
audit-command: pnpm audit --audit-level high
---

## 技術スタック
- Framework: Laravel 11 + Vue 3
- Database: MySQL
```

```markdown
<!-- 例2: Rust (cargo) -->
---
build-command: cargo build
typecheck-command: cargo clippy -- -D warnings
lint-command: cargo fmt --check
test-command: cargo test
audit-command: cargo audit
---

## 技術スタック
- Framework: Axum / Tauri 2
```

```markdown
<!-- 例3: Python (uv) -->
---
build-command: uv sync --locked
typecheck-command: uv run mypy src/
lint-command: uv run ruff check . && uv run ruff format --check .
test-command: uv run pytest
audit-command: uv run pip-audit
---

## 技術スタック
- Framework: FastAPI + Pydantic
```

`audit-command` の閾値と例外の基準は [security-by-design の「依存監査の CI ゲート基準」](skills/security-by-design/SKILL.md) に従う（例1の High は出発点の既定）。

複数言語が共存するプロジェクト（例: Tauri = Cargo.toml + package.json）では、**全系統のコマンドを `&&` で連結するか、Makefile / justfile に一本化して指定する**。片方の言語だけ検証して完了扱いにしない。
