# HOTL Engineering

Human-on-the-Loop(HOTL)= 人間が各ステップの中にいるのではなく、**少数の監督点（CP1〜CP4）でエビデンスを見て承認/停止する**開発運用モデル。
このプラグインは、少人数チームが AI エージェントと共に自律的に開発を回すための「開発フローの設計・適用・相談」を 1 つのスキルで支援する。

## 2つのモード

| モード | トリガー例 | やること |
|---|---|---|
| **適用モード** | 「このリポジトリに品質ゲートを入れて」「リポジトリを引き継いだので開発フローを整備したい」「CI/CDを設計して」 | アセスメント → リポジトリの性格に比例したサブセット提案 → 承認後にテンプレ適用（Phase 1 = comment-only から段階導入） |
| **相談モード** | 「AI SREツールを買うべきか」「エージェントにどこまで任せていいか」「監査にどう説明するか」 | 原則（12原則）+ 判断フレーム（F1〜F7）に基づき、立場を取った推奨 + トレードオフ + 今日できる一歩 |

## 構成

```
skills/hotl-engineering/
  SKILL.md                    # モード判定と実行手順
  references/
    principles.md             # AIネイティブ開発運営の12原則（DORA 2025 等が根拠）
    decision-frameworks.md    # 判断フレーム F1〜F7 + アンチパターン集
    eval-design.md            # eval ゲートの3層設計・golden set カテゴリ設計
    jsox-audit.md             # J-SOX / IT全般統制・監査対応
  assets/
    workflows/                # GitHub Actions テンプレ6本（ci / ai-review / deploy / eval-gate / incident-triage / agent-implement）
    templates/                # CLAUDE.md / CODEOWNERS / branch protection 設定スクリプト
    evals/                    # eval ハーネス雛形（run_evals.py / thresholds / rubric / golden sample）
    ADJUST.md                 # テンプレ適用時の置換ポイント一覧
evals/cases.json              # スキル自体の検証ケース6件（with-skill / baseline 比較用）
```

テンプレートは pnpm + Next.js/TS + Azure Container Apps + AWS Bedrock 東京を例として書かれている。
適用時は必ず `assets/ADJUST.md` の置換ポイントに従ってプロジェクトに合わせること。

## インストール

### Claude Code（推奨: marketplace 経由）

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install hotl-engineering@cc-plugins
```

スキルは自動ロードされる（明示的な指定は不要）。動作確認は「このリポジトリに HOTL の品質ゲートを導入して」等で。
確実に起動したいときは `/hotl-engineering:hotl-engineering` で明示起動できる。

### claude.ai（チームメンバー向けアップロード）

1. このディレクトリからスキル zip を作る:
   ```bash
   cd hotl-engineering/skills && zip -r hotl-engineering.skill hotl-engineering/
   ```
   zip のルートは**スキルフォルダ（直下に SKILL.md）**にすること。プラグインラッパ
   （`.claude-plugin/` や `evals/`）を含めるとアップロードで弾かれる。references/ と
   assets/ はスキルフォルダ内なのでそのまま同梱される。
2. claude.ai → Settings → Capabilities → Skills → Upload で `.skill` をアップロード

## 導入の原則（重要）

- **全部入りを押し付けない。** ゲートはリポジトリの性格（実験 / 社内ツール / 本番 / エージェント系）に比例させる
- **導入は必ず Phase 1（comment-only・観測）から。** 2週間の較正期間で偽陽性を潰してから強制化する
- required check は `quality-gate` 1本に集約し、層の追加・削除で ruleset を触らない

## スキルを腐らせない運用ルール

- 相談・適用で原則の不足や誤りが **2回** 露呈したら、references に追記する PR を出す（Issue テンプレート `skill-feedback` を使用）
- 変更は必ず `CHANGELOG.md` に記録する
- 四半期ごとに principles.md の根拠（DORA 等）を最新版レポートで再検証する
