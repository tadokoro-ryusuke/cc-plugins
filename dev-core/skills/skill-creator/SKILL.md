---
name: skill-creator
description: スキル作成・更新のガイド。「スキルを作成」「スキルを作りたい」「新しいスキルを追加」「〇〇用のスキルを作って」と言われた時、またはスキル構造、段階的開示、YAML frontmatter、description の書き方について質問された時に使用する。
---

# スキル作成ガイド

## クイックスタート

スキル作成の基本ステップ:

1. **具体例の理解** - どのようなクエリでトリガーされるか明確化
2. **リソース計画** - scripts/, references/, assets/に何を含めるか決定
3. **初期化** - `scripts/init_skill.py`でテンプレート生成
4. **実装** - SKILL.mdとリソースを作成
5. **検証** - `scripts/validate_skill.py`で品質チェック

## スキル構造

```
skill-name/
├── SKILL.md              # 必須: メタデータ + 指示
├── scripts/              # 任意: 実行可能コード
├── references/           # 任意: 参照ドキュメント
└── assets/               # 任意: 出力用ファイル（テンプレート等）
```

## SKILL.md の書き方

### Frontmatter（最重要）

```yaml
---
name: skill-name
description: スキルの機能説明。「〇〇して」「△△を作成」などの具体的トリガーフレーズを含める。
---
```

**descriptionのルール:**
- スキルが「何をするか」と「いつ使うか」の両方を記述
- 具体的なトリガーフレーズを含める（「〇〇を作成」「△△を編集」など）
- 三人称で記述（「ユーザーを支援します」ではなく「〇〇を処理する」）
- 1024文字以内

**良い例:**
```yaml
description: PDFファイルからテキスト・表を抽出し、フォーム入力・文書マージを行う。「PDFからテキスト抽出」「PDFフォームに入力」「PDF結合」と言われた時に使用。
```

**悪い例:**
```yaml
description: PDFを処理します  # 曖昧すぎる、トリガーフレーズがない
```

### Body（本文）

**原則: Claudeは賢い。Claudeが知らない情報のみ追加する。**

含めるべき:
- 具体的なワークフロー手順
- スクリプトの使用方法
- references/への参照（いつ読むべきか明記）
- 具体的なコード例

含めないでおく:
- 一般的な概念説明（「PDFとは」など）
- Claudeが既に知っている情報
- 冗長な説明

**500行以下を維持。超える場合はreferences/に分離。**

## 段階的開示パターン

### パターン1: 参照分離

```markdown
## 基本操作
[基本的なコード例]

## 高度な機能
- **フォーム入力**: [references/forms.md](references/forms.md)参照
- **API詳細**: [references/api.md](references/api.md)参照
```

### パターン2: ドメイン別分離

複数ドメインがある場合、ドメイン別にファイルを分け、必要なものだけロード:

```
references/
├── finance.md    # 財務関連クエリ時のみロード
├── sales.md      # 営業関連クエリ時のみロード
└── product.md    # 製品関連クエリ時のみロード
```

### パターン3: 条件付き詳細

```markdown
## 基本編集
XMLを直接編集する。

**追跡変更が必要な場合**: [references/redlining.md](references/redlining.md)
**OOXML詳細が必要な場合**: [references/ooxml.md](references/ooxml.md)
```

## ワークフロー設計

### 順次ワークフロー

複雑なタスクは明確なステップに分解:

```markdown
## PDFフォーム入力ワークフロー

進捗チェックリスト:
- [ ] Step 1: フォーム分析（analyze_form.py実行）
- [ ] Step 2: フィールドマッピング作成（fields.json編集）
- [ ] Step 3: マッピング検証（validate_fields.py実行）
- [ ] Step 4: フォーム入力（fill_form.py実行）
- [ ] Step 5: 出力確認（verify_output.py実行）
```

### 条件付きワークフロー

```markdown
1. 変更タイプを判断:
   **新規作成?** → 「作成ワークフロー」へ
   **既存編集?** → 「編集ワークフロー」へ
```

### フィードバックループ

品質が重要なタスクには検証ループを実装:

```markdown
1. 変更を実行
2. **すぐに検証**: `python scripts/validate.py`
3. エラーがあれば修正して再検証
4. **検証成功後のみ**次のステップへ
```

## scripts/ の設計

### いつスクリプトを含めるか
- 同じコードを繰り返し書く場合
- 決定論的な信頼性が必要な場合
- エラーハンドリングを統一したい場合

### スクリプト設計原則

**問題を解決し、Claudeに任せない:**

```python
# 良い例: エラーを明示的に処理
def process_file(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"ファイル {path} が見つかりません、デフォルト作成")
        with open(path, 'w') as f:
            f.write('')
        return ''

# 悪い例: エラーをClaudeに任せる
def process_file(path):
    return open(path).read()  # 失敗したらClaude任せ
```

**マジックナンバーを避ける:**

```python
# 良い例: 値を説明
REQUEST_TIMEOUT = 30  # HTTPリクエストは通常30秒以内に完了
MAX_RETRIES = 3       # 3回で一時的失敗の大半が解決

# 悪い例: なぜこの値?
TIMEOUT = 47
RETRIES = 5
```

## references/ の設計

### いつreferencesを使うか
- SKILL.mdが500行を超えそうな時
- ドメイン別に情報を分離したい時
- 詳細なAPIドキュメントがある時

### 長いファイルには目次

100行以上のファイルには冒頭に目次を追加:

```markdown
# APIリファレンス

## 目次
- 認証とセットアップ
- コアメソッド（CRUD）
- 高度な機能
- エラー処理パターン
- コード例

## 認証とセットアップ
...
```

## 具体例: シンプルなスキル

```yaml
---
name: commit-message
description: gitの差分を分析して説明的なコミットメッセージを生成する。「コミットメッセージを作成」「変更をコミット」と言われた時に使用。
---
```

```markdown
# コミットメッセージ生成

## 形式

type(scope): 簡潔な説明

詳細説明（任意）

## 例

**入力**: JWT認証を追加
**出力**:
feat(auth): JWT認証を実装

ログインエンドポイントとトークン検証ミドルウェアを追加

**入力**: 日付表示バグ修正
**出力**:
fix(reports): タイムゾーン変換での日付フォーマット修正

レポート生成全体でUTCタイムスタンプを一貫使用
```

## 具体例: リソース付きスキル

```
pdf-processor/
├── SKILL.md
├── scripts/
│   ├── extract_text.py
│   ├── fill_form.py
│   └── validate.py
└── references/
    ├── forms.md
    └── api.md
```

```yaml
---
name: pdf-processor
description: PDFからテキスト・表抽出、フォーム入力、文書マージを行う。「PDFからテキスト抽出」「PDFフォーム入力」「PDF結合」と言われた時に使用。
---
```

```markdown
# PDF処理

## クイックスタート

テキスト抽出:
python scripts/extract_text.py input.pdf > output.txt

## フォーム入力

1. フォーム分析: `python scripts/analyze_form.py form.pdf`
2. フィールド編集: `fields.json`を編集
3. 入力実行: `python scripts/fill_form.py form.pdf fields.json output.pdf`

**詳細**: [references/forms.md](references/forms.md)

## API詳細

高度なオプションについては[references/api.md](references/api.md)参照
```

## 避けるべきパターン

### 冗長な説明
```markdown
# 悪い例
PDF（Portable Document Format）は、テキストや画像を含む一般的なファイル形式です...

# 良い例
pdfplumberでテキスト抽出:
```

### 複数オプションの提示
```markdown
# 悪い例
pypdfまたはpdfplumberまたはPyMuPDFを使用できます...

# 良い例
テキスト抽出にはpdfplumberを使用:
（スキャンPDFでOCRが必要な場合はpdf2image + pytesseract）
```

### 深いネスト参照
```markdown
# 悪い例: 2レベル以上のネスト
SKILL.md → advanced.md → details.md

# 良い例: 1レベルのみ
SKILL.md → references/advanced.md
SKILL.md → references/details.md
```

## チェックリスト

作成完了前に確認:

### 必須
- [ ] descriptionに具体的トリガーフレーズがある
- [ ] descriptionに「何をするか」と「いつ使うか」が含まれる
- [ ] SKILL.md本文が500行以下
- [ ] 冗長な説明がない（Claudeは既に知っている情報）

### 推奨
- [ ] 具体的なコード例がある
- [ ] ワークフローに明確なステップがある
- [ ] 参照ファイルへのリンクに「いつ読むか」が明記
- [ ] スクリプトにエラーハンドリングがある

## スクリプト

- **初期化**: `python scripts/init_skill.py <skill-name> --path <output-dir>`
- **検証**: `python scripts/validate_skill.py <skill-dir>`
