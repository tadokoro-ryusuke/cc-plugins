# 完全なスキル例

## 目次
- 例1: シンプルなスキル（リソースなし）
- 例2: スクリプト付きスキル
- 例3: 参照ドキュメント付きスキル
- 例4: 複合スキル（全リソースタイプ）

## 例1: シンプルなスキル（リソースなし）

コミットメッセージ生成スキル。SKILL.mdのみで完結。

### ディレクトリ構造
```
commit-message/
└── SKILL.md
```

### SKILL.md
```yaml
---
name: commit-message
description: gitの差分を分析して説明的なコミットメッセージを生成。「コミットメッセージを作成」「変更をコミット」「コミットを書いて」と言われた時に使用。
---
```

```markdown
# コミットメッセージ生成

## 形式

type(scope): 簡潔な説明（50文字以内）

詳細説明（任意、72文字折り返し）

## type一覧
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- style: フォーマット
- refactor: リファクタリング
- test: テスト
- chore: その他

## 例

**変更**: ユーザー認証機能追加
**出力**:
feat(auth): JWT認証を実装

ログインエンドポイントとトークン検証ミドルウェアを追加

**変更**: 日付表示バグ修正
**出力**:
fix(reports): タイムゾーン変換での日付フォーマット修正

レポート生成全体でUTCタイムスタンプを一貫使用

**変更**: 依存関係更新とリファクタリング
**出力**:
chore: 依存関係更新とエラー処理リファクタリング

- lodashを4.17.21にアップグレード
- エンドポイント全体でエラーレスポンス形式を標準化
```

**特徴**:
- 約60行でコンパクト
- 具体例で形式を示す
- Claudeが既に知っている「コミットメッセージとは」の説明なし

---

## 例2: スクリプト付きスキル

PDF回転スキル。決定論的な処理をスクリプト化。

### ディレクトリ構造
```
pdf-rotate/
├── SKILL.md
└── scripts/
    └── rotate_pdf.py
```

### SKILL.md
```yaml
---
name: pdf-rotate
description: PDFページを回転させる。「PDFを回転」「ページを90度回転」「PDFの向きを変更」と言われた時に使用。
---
```

```markdown
# PDF回転

## 使用方法

python scripts/rotate_pdf.py <input.pdf> <output.pdf> --angle <90|180|270>

## オプション
- `--angle`: 回転角度（時計回り）。デフォルト90
- `--pages`: 対象ページ（例: "1,3,5-10"）。デフォルト全ページ

## 例

# 全ページを90度回転
python scripts/rotate_pdf.py input.pdf output.pdf

# 1,3ページのみ180度回転
python scripts/rotate_pdf.py input.pdf output.pdf --angle 180 --pages "1,3"
```

### scripts/rotate_pdf.py
```python
#!/usr/bin/env python3
"""PDF回転スクリプト"""
import argparse
from pypdf import PdfReader, PdfWriter

def parse_pages(pages_str: str, total: int) -> list[int]:
    """ページ指定をパース。"1,3,5-10" → [0, 2, 4, 5, 6, 7, 8, 9]"""
    if not pages_str:
        return list(range(total))

    result = []
    for part in pages_str.split(','):
        if '-' in part:
            start, end = map(int, part.split('-'))
            result.extend(range(start - 1, end))
        else:
            result.append(int(part) - 1)
    return result

def rotate_pdf(input_path: str, output_path: str, angle: int, pages: str = None):
    reader = PdfReader(input_path)
    writer = PdfWriter()

    target_pages = parse_pages(pages, len(reader.pages))

    for i, page in enumerate(reader.pages):
        if i in target_pages:
            page.rotate(angle)
        writer.add_page(page)

    with open(output_path, 'wb') as f:
        writer.write(f)

    print(f"回転完了: {output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='PDF回転')
    parser.add_argument('input', help='入力PDF')
    parser.add_argument('output', help='出力PDF')
    parser.add_argument('--angle', type=int, default=90, choices=[90, 180, 270])
    parser.add_argument('--pages', help='対象ページ（例: "1,3,5-10"）')

    args = parser.parse_args()
    rotate_pdf(args.input, args.output, args.angle, args.pages)
```

**特徴**:
- スクリプトにエラーハンドリングあり
- 引数が明確にドキュメント化
- SKILL.mdはスクリプトの使い方のみで簡潔

---

## 例3: 参照ドキュメント付きスキル

BigQueryスキル。ドメイン別にスキーマを分離。

### ディレクトリ構造
```
bigquery/
├── SKILL.md
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

### SKILL.md
```yaml
---
name: bigquery
description: BigQueryでデータ分析。売上、財務、製品メトリクス取得。「今月の売上は?」「DAUを教えて」「収益レポート作成」などのデータクエリに使用。
---
```

```markdown
# BigQuery分析

## データセット

クエリ対象に応じて参照ファイルを読み込む:

- **財務データ**: 収益、ARR、請求 → [references/finance.md](references/finance.md)
- **営業データ**: 機会、パイプライン → [references/sales.md](references/sales.md)
- **製品データ**: API使用、機能採用 → [references/product.md](references/product.md)

## 共通ルール

1. 常にテストアカウントを除外: `WHERE account_type != 'test'`
2. 日付はUTCで処理
3. 大きなテーブルは日付でパーティション

## クエリテンプレート

SELECT
  [メトリクス],
  [ディメンション]
FROM [テーブル]
WHERE account_type != 'test'
  AND [日付条件]
GROUP BY [ディメンション]
ORDER BY [ソート]
```

### references/finance.md
```markdown
# 財務データスキーマ

## revenue テーブル
| カラム | 型 | 説明 |
|--------|------|------|
| date | DATE | 計上日 |
| account_id | STRING | アカウントID |
| amount | FLOAT64 | 金額（USD） |
| type | STRING | 'subscription', 'usage', 'one-time' |

## billing テーブル
| カラム | 型 | 説明 |
|--------|------|------|
| invoice_date | DATE | 請求日 |
| account_id | STRING | アカウントID |
| amount | FLOAT64 | 請求額 |
| status | STRING | 'paid', 'pending', 'overdue' |

## よく使うクエリ

### 月次収益
SELECT
  DATE_TRUNC(date, MONTH) as month,
  SUM(amount) as revenue
FROM revenue
WHERE account_type != 'test'
GROUP BY month
ORDER BY month
```

**特徴**:
- SKILL.mdは概要とナビゲーションのみ
- 各ドメインの詳細は別ファイル
- ユーザーが財務について質問→finance.mdのみ読み込み

---

## 例4: 複合スキル（全リソースタイプ）

プレゼンテーション作成スキル。テンプレート、スクリプト、参照を含む。

### ディレクトリ構造
```
presentation/
├── SKILL.md
├── scripts/
│   ├── create_pptx.py
│   └── add_chart.py
├── references/
│   ├── layouts.md
│   └── styling.md
└── assets/
    └── template.pptx
```

### SKILL.md
```yaml
---
name: presentation
description: PowerPointプレゼンテーションの作成・編集。「スライド作成」「プレゼンを作って」「PPTXにグラフ追加」と言われた時に使用。
---
```

```markdown
# プレゼンテーション作成

## クイックスタート

# テンプレートから新規作成
python scripts/create_pptx.py "タイトル" output.pptx

# グラフ追加
python scripts/add_chart.py output.pptx --data data.csv --type bar

## テンプレート

`assets/template.pptx`を基に作成。カスタムテンプレートも使用可能。

## レイアウト

利用可能なレイアウトは[references/layouts.md](references/layouts.md)参照

## スタイリング

色、フォント、配置のガイドラインは[references/styling.md](references/styling.md)参照
```

**特徴**:
- assets/にテンプレート（出力用、コンテキスト読み込み不要）
- scripts/に処理コード
- references/に詳細ガイド
- SKILL.mdは最小限のナビゲーション
