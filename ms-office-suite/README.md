# ms-office-suite

Microsoft Officeドキュメント操作スキルを提供するClaude Codeプラグイン。

## 機能

### PDFスキル
- テキスト/テーブル抽出
- PDF作成（reportlab）
- 結合・分割（qpdf, pypdf）
- フォーム記入（フィル可能/不可能両対応）
- 画像抽出
- OCR（スキャン文書）

### DOCXスキル
- Word文書の作成（docx-js）
- 既存文書の編集（OOXML操作）
- 変更履歴（Tracked Changes）管理
- コメント追加
- テキスト抽出

## 依存関係

### システム要件

```bash
# macOS
brew install poppler qpdf pandoc

# Ubuntu/Debian
apt-get install poppler-utils qpdf pandoc libreoffice
```

### Python

```bash
pip install pypdf pdfplumber reportlab pdf2image pillow pytesseract defusedxml
```

### Node.js

```bash
npm install docx
```

## 使用方法

### PDF作成

```
PDFを作成して、タイトル「月次レポート」と表を含めてください
```

### PDFテキスト抽出

```
このPDFからテキストを抽出してください
```

### Word文書作成

```
提案書のWordドキュメントを作成してください
```

### Word文書編集（変更履歴付き）

```
このWord文書を編集して、変更履歴を残してください
```

## スキルトリガー

以下のようなリクエストでスキルが自動的に読み込まれます：

**PDF:**
- 「PDFを作成」「PDFからテキストを抽出」
- 「PDFを結合」「PDFを分割」
- 「PDFフォームに記入」「PDFからテーブルを抽出」

**DOCX:**
- 「Word文書を作成」「DOCXを編集」
- 「文書に変更履歴を追加」
- 「Word文書からテキストを抽出」

## ディレクトリ構造

```
ms-office-suite/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── pdf/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   ├── advanced-reference.md
│   │   │   └── forms.md
│   │   └── scripts/
│   │       ├── check_fillable_fields.py
│   │       ├── convert_pdf_to_images.py
│   │       ├── check_bounding_boxes.py
│   │       ├── create_validation_image.py
│   │       ├── extract_form_field_info.py
│   │       ├── fill_fillable_fields.py
│   │       └── fill_pdf_form_with_annotations.py
│   └── docx/
│       ├── SKILL.md
│       ├── references/
│       │   ├── docx-js.md
│       │   └── ooxml.md
│       ├── scripts/
│       │   ├── __init__.py
│       │   ├── utilities.py
│       │   └── document.py
│       └── ooxml/
│           └── scripts/
│               ├── unpack.py
│               ├── pack.py
│               └── validate.py
└── README.md
```

## ライセンス

MIT
