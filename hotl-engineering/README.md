# HOTL Engineering

Human-on-the-Loop(HOTL)= 人間が各ステップの中にいるのではなく、**少数の監督点（CP1〜CP4）でエビデンスを見て承認/停止する**開発運用モデル。
このプラグインは、少人数チームが AI エージェントと共に自律的に開発を回すための「開発フローの設計・適用・相談」を 1 つのスキルで支援する。

## 2つのモード

| モード | トリガー例 | やること |
|---|---|---|
| **適用モード** | 「このリポジトリに品質ゲートを入れて」「リポジトリを引き継いだので開発フローを整備したい」「CI/CDを設計して」 | アセスメント（既存の保護を含む）→ リポジトリの性格に比例したサブセット提案 → 権限の範囲で必要なテンプレだけ適用（新規の advisory/AI チェックは観測モードから段階導入、既存の強制ゲートは維持） |
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
    scripts/                  # check_review_verdicts.py（AIレビュー verdict の trusted 検証）
    ADJUST.md                 # テンプレ適用時の置換ポイント一覧
workflows/
  assess/ apply/              # 適用モードの明示スラッシュ入口（/hotl-engineering:assess, :apply）
evals/cases.json              # スキル自体の検証ケース7件（with-skill / baseline 比較用）
```

テンプレートは pnpm + Next.js/TS + Azure Container Apps + AWS Bedrock 東京を例として書かれている。
そのままデプロイできる汎用スタックではないので、適用時は必ず `assets/ADJUST.md` の置換ポイントに
従ってプロジェクトに合わせること。本番デプロイには、リハーサル済みの capture/restore アダプタが必要。

## インストール

### Claude Code（推奨: marketplace 経由）

```
/plugin marketplace add tadokoro-ryusuke/cc-plugins
/plugin install hotl-engineering@cc-plugins
```

スキルは自動ロードされる（明示的な指定は不要）。動作確認は「このリポジトリに HOTL の品質ゲートを導入して」等で。

適用モードを確実に・段階的に回したいときは明示スラッシュ入口を使う:

```
/hotl-engineering:assess   # アセスメント → 性格判定 → 適用計画の提示（ここで止まる）
/hotl-engineering:apply    # 合意済み計画に基づくテンプレ適用（Phase 1 設定で導入。既存の保護は弱めない）
```

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

- **全部入りを押し付けない。** ゲートはリポジトリの性格（実験 / 社内ツール / 本番 / エージェント系）に比例させ、必要なテンプレートだけを適用する
- **新規の advisory/AI チェックは Phase 1（comment-only・観測）から。** 既存の blocking な security チェック・branch protection・must-pass 条件は維持し、黙って弱めない
- **昇格は証拠で。** 代表的な実行結果が文書化した基準を満たし、責任者と無効化手段が決まってから強制化する（経過期間だけを根拠にしない）
- 同梱 CI の required check は `quality-gate` 1本に集約し、層の追加・削除で ruleset を触らない。ただし既存の required checks を黙って置き換えない

## 2.0.0 への移行

- AIレビューの強制化を有効にする前に、`assets/scripts/check_review_verdicts.py` を trusted base 側の
  `.github/scripts/check_review_verdicts.py` に設置する。verdict にはレビュー対象の head SHA を含める
- eval-gate の対象レスポンスは、デプロイ済みの `revision` を返すように適合させる
- 本番デプロイの前に、プロジェクト固有の capture/restore アダプタ
  （`.github/scripts/capture-production-state.sh` / `restore-production-state.sh`）を実装してリハーサルする
- 詳細は `assets/ADJUST.md` と `CHANGELOG.md` を参照

## スキルを腐らせない運用ルール

- 相談・適用で原則の不足や誤りが **2回** 露呈したら、references に追記する PR を出す（Issue テンプレート `skill-feedback` を使用）
- 変更は必ず `CHANGELOG.md` に記録する
- 四半期ごとに principles.md の根拠（DORA 等）を最新版レポートで再検証する
