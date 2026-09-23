# コーディング規約

## 命名規約

**原則: 言語標準のケース規約に従う。** 独自規約を発明せず、その言語のフォーマッタ・リンタ（rustfmt / Ruff / gofmt / ESLint 等）が強制するスタイルガイドを正とする（dev-core:conventions-as-guardrails 参照）。

| 言語 | 変数・関数 | クラス・型 | 定数 | ファイル名 |
|---|---|---|---|---|
| TypeScript/JS | camelCase | PascalCase | UPPER_SNAKE_CASE | kebab-case（`user-service.ts`） |
| Rust | snake_case | PascalCase | SCREAMING_SNAKE_CASE | snake_case（`user_service.rs`） |
| Python (PEP 8) | snake_case | PascalCase | UPPER_SNAKE_CASE | snake_case（`user_service.py`） |
| Go | camelCase（公開は先頭大文字） | 同左 | 同左（MixedCaps） | 小文字連結（`userservice.go`） |
| PHP (PSR) | camelCase | PascalCase | UPPER_SNAKE_CASE | クラス名一致（`UserService.php`） |

言語横断で共通なのは「意図が読める名前を付ける」「略語を避ける」「boolean は is/has/can 接頭辞」のみ。ケース規約は言語ごとに異なるものとして扱う。

## コードスタイル

- **DRY**: コード重複は即座に排除
- **早期リターン/ガード節**: 深いネストを避ける
- **イミュータビリティ**: 共有データを直接変更せず、更新済みの値を新しく作る（JS: `[...array, item]` / Python: 新リスト内包・`dataclasses.replace` / Rust: 所有権と `&mut` で言語が制御するため借用規則に従う）
- **ファイルサイズ**: 200-400行推奨、500行超で分割検討。関数は50行以下
- **三項演算子**: 単純な場合のみ。ネストした三項演算子は使用禁止

## ハードコーディング禁止

- **マジックナンバー**: `const MAX_RETRY = 3;` — 数値リテラル直接記述禁止
- **設定値**: 環境変数または設定ファイル（API Key, URL, パス）
- **UI文字列**: 定数や言語ファイルで管理

## 型の厳格性（言語別）

原則: **型システムの「逃げ道」を既定で禁止し、使う場合は理由をコメントで残して人間承認を得る。**

- **TypeScript**: strict mode 有効。`any` 禁止（`unknown` + 型ガード）。公開関数には明示的な戻り値型。インポート順序: 外部 → 内部（絶対パス）→ 相対
- **Rust**: `cargo clippy -- -D warnings` を通す。`unwrap()` / `expect()` は main・テスト・不変条件の明示以外で禁止。`unsafe` はブロックごとに理由コメント必須
- **Python**: mypy または pyright を CI ゲートに。`Any` / `type: ignore` は理由付きのみ。新規コードは型注釈必須、既存コードはモジュール単位で漸進的に strict 化
- **Go**: `go vet` + golangci-lint を通す。`interface{}`/`any` の乱用禁止

## Git 規約

commit / push / PR が現在の依頼で明示的に許可されている場合だけ、この節を適用する。

### Conventional Commits

```
<type>(<scope>): <subject>
```

type: feat | fix | docs | style | refactor | test | chore

- 意味のある単位で細かくコミットする（Perfect Commit）
- `git add` はファイル個別指定（`git add .` で無関係な変更を巻き込まない）

### ブランチ戦略

ブランチ戦略の選択（既定は GitHub Flow）→ dev-core:issue-driven-dev Step 5 を正本とする。
ブランチ名は種別プレフィックス + Issue 番号（例: `feature/123-cancel-order`）。

## リファクタリング技法

テストがグリーンの状態を維持しながら、一度に一つずつ適用する:

- メソッドの抽出: 複雑な関数を分割
- 変数/関数の名前変更: 明確性の向上
- マジックナンバーを定数に置き換え
- 条件式の簡略化
- クラス/モジュールの抽出
- デッドコードの排除
