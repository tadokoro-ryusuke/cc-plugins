# Indie Product Discovery & Marketing

個人開発・小さなチームのプロダクトについて、課題の発見から需要検証、海外向け LP、ローンチ、集客、定着、ユニットエコノミクスまでを支援するスキル群。
観察事実・報告・推論・仮説を区別した証拠台帳と、結果を見る前に宣言した判定ルールで進める。見た目の完成度や反応の数を、需要の証拠と取り違えないことを重視する。

codex-plugins の `indie-product-marketing` を、Claude Code 向けに日本語で翻案したもの（正本と同期は後述）。

## 3つのスキル

| スキル | 担当 | 次に渡す先 |
|---|---|---|
| `indie-product-marketing:indie-idea-discovery` | 創業者自身の経験と市場の行動証拠から課題を掘り、独立した発散パスで案を出し、ハードゲートと証拠グレード付きで比較する | 検証やローンチも依頼に含まれていれば `indie-product-marketing` に続ける |
| `indie-product-marketing:indie-product-marketing` | 選んだ機会の需要検証、ローンチ計画、グロース診断、チャネル実験、マーケティング監査。実験カード・計測・ユニットエコノミクス・コンプライアンスの確認を含む | LP の設計と実装は `global-landing-design` |
| `indie-product-marketing:global-landing-design` | 海外・多言語向けのプロダクト LP を、参考サイトの調査、ページの論旨、ビジュアル文法、誠実なデモ、実装・ローカライズ、検証の順で作る | 広い集客・ローンチ計画は `indie-product-marketing` |

スキルは依頼の内容から自動で読み込まれる。明示的な指定は要らない。

## 使用例

indie-idea-discovery:

```
個人開発のネタがない。自分の仕事の経験から、解く価値のある課題を探して、検証できる候補に絞って
「メモアプリ」という種から、方向性の違う案を広げて比較したい
手元のアイデア8個を、証拠の強さで比べて1つに絞りたい
```

indie-product-marketing:

```
選んだアイデアに需要があるか、作り込む前に検証したい。ウェイトリストとスモークテストを設計して
このプロダクトのローンチ計画を、計測と最初のチャネル選びから立てて
インストールは増えたが定着しない。集客・定着・ユニットエコノミクスのどこで詰まっているか診断して
```

global-landing-design:

```
参考サイトを2つ調べて、海外の開発者向けの英語 LP の方向性を決めて、実装まで進めて
この英語の LP を日本語にローカライズして。デモとダイアログの文言も含めて
この LP の主張が証拠の範囲に収まっているかレビューして
```

## 構成

```
indie-product-marketing/
├── .claude-plugin/plugin.json
├── README.md
├── evals/skill-behavior-cases.json     # 行動ケース（トリガーの正例・負例と、境界の振る舞い）
└── skills/
    ├── indie-idea-discovery/
    │   ├── SKILL.md                    # 日本語翻案
    │   ├── references/                 # 英語原文の同一コピー + claude-code-runtime.md
    │   └── assets/                     # 英語原文の同一コピー（成果物のテンプレート）
    ├── indie-product-marketing/
    │   ├── SKILL.md
    │   ├── references/
    │   └── assets/
    └── global-landing-design/
        ├── SKILL.md
        ├── references/                 # evaluation-cases.md に LP の評価ケース
        └── assets/
```

references と assets は英語のまま同梱している。成果物は依頼の言語で書いてよい。

## 外部アクションの境界

下書き、設計、ローカルでの実装と検証までは、依頼の範囲で進める。次の操作は、ユーザーの明示の指示があるときだけ行う。

- 広告の出稿、予算の消化、課金
- 公開投稿、DM、リプライ、いいね
- Product Hunt やギャラリーなどへの掲載
- ウェイトリストなどへのメール送信
- 決済の設定と有効化
- デプロイ、DNS の切り替え、検索エンジンへのインデックス公開
- Artifact の公開リンク化

一括・自動のエンゲージメント（自動いいね、一括 DM・リプライ、自動フォロー）は、指示があっても行わない。ブラウザ MCP や CLI から実際に実行できてしまう環境なので、この境界を明文化している。

あわせて、次の報告の仕方を守る。

- ローカルのデモを、デプロイ済みや需要の証拠として報告しない。デザインレビュー・実装の検証・需要の証拠は分けて報告する。
- WebFetch は小型モデルによるページの要約を返す。数値・引用・価格・規約の文言は生のソースで照合し、照合できなければ台帳に「要約経由・未照合」と書く。
- 同じモデルによる採点は順位付けの補助であり、市場の事実の認定ではない。

Claude Code 固有の実行指示は、各スキルの `references/claude-code-runtime.md` にまとめている。

## 他プラグインとの棲み分け

| 相手 | 分担 |
|---|---|
| ui-ux-pro-max / frontend-design | スタイル・配色・フォントの参照の補助。LP の論旨・証拠・ローカライズ・検証の主担当は global-landing-design。配色だけの依頼なら ui-ux-pro-max で足りる |
| design-core:design-review / ui-visual-defaults | 見た目と WCAG の審査、デザイントークンの確定（導入されている場合）。design-review は global-landing-design が作った LP の審査レンズになる |
| compliance-core | 個人情報・生成物の権利処理など、法規の深い論点（導入されている場合）。本プラグインのコンプライアンス確認は事前のチェックリストで、法的助言ではない |
| dev-core | 検証済みのコンセプト（`assets/validation-handoff.md`）を `/dev-core:task` に渡して MVP の計画にする。LP のビルド・lint・テストの検証は `dev-core:verify`（導入されている場合） |
| 受託の営業・見積 | 対象外。自社プロダクトの需要検証やプロダクト価格とは別の話なので、本プラグインは使わない |

## 正本と同期

**ドメイン知識の正本は codex-plugins**（SKILL.md の内容、references、assets）。cc へは一方向に翻案する。

| ファイル | 正本 | cc 側の扱い |
|---|---|---|
| `skills/*/SKILL.md` | codex-plugins | 日本語へ一方向に翻案する。判断規則・完了条件・外部アクションの境界は変えない。`$<skill>` は `indie-product-marketing:<skill>` に置き換える |
| `skills/*/references/**`、`skills/*/assets/**` | codex-plugins | 英語原文のバイト単位の同一コピー。cc 側では編集しない |
| `skills/*/references/claude-code-runtime.md` | **cc-plugins** | Claude Code 固有の実行ノート。cc が所有し、cc だけで更新する |

ドメイン知識の改善は codex-plugins で先に行い、そのあと cc に反映する。cc の版番号（0.1.0〜）は codex 側と独立に採番する。

### 同期元

| 項目 | 値 |
|---|---|
| リポジトリ | [tadokoro-ryusuke/codex-plugins](https://github.com/tadokoro-ryusuke/codex-plugins) |
| プラグインと版 | `plugins/indie-product-marketing` 0.3.1 |
| コミット | `68322c9`（ブランチ `codex/indie-generalize`） |

### 同期の確認

codex-plugins のチェックアウトを `CODEX` に指定し、cc-plugins のルートで実行する。差分が出なければ一致している。

```bash
CODEX=../codex-plugins
tmp="$(mktemp -d)"
git -C "$CODEX" archive 68322c9 plugins/indie-product-marketing/skills | tar -x -C "$tmp"
diff -r -x SKILL.md -x agents -x claude-code-runtime.md \
  "$tmp/plugins/indie-product-marketing/skills" indie-product-marketing/skills
```

`agents/`（Codex の `openai.yaml`）は同梱しない。その既定の依頼文は、上の「使用例」に移している。

### 同期を更新するとき

1. codex-plugins 側の変更がマージされたコミットを決める。
2. references と assets を、そのコミットからそのままコピーする。
3. SKILL.md の差分を日本語へ翻案する。Claude Code 固有の指示は SKILL.md に書かず、`references/claude-code-runtime.md` に置く。
4. この README の「同期元」を更新し、`.claude-plugin/plugin.json` の version を上げる。
5. 下の検証を通し、上の同期の確認で差分が無いことを確かめる。

## 検証

```bash
node scripts/check-skills-drift.mjs
node scripts/validate-skill-evals.mjs --plugin indie-product-marketing
claude plugin validate indie-product-marketing --strict
```

`evals/skill-behavior-cases.json` のスキーマ検証は、行動の実行ではない。ケースを実行したときは、モデル・実効 effort・スキルの版・prompt・fixture・tool trace・判定を記録し、未実行のケースは pending として扱う。LP のケースの詳細は `skills/global-landing-design/references/evaluation-cases.md` にある。

## インストール

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install indie-product-marketing@cc-plugins
```

インストールや更新のあとは、新しいセッションで `indie-product-marketing:*` のスキルが一覧に出ることを確かめる。
