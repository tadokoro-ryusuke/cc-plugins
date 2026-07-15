# コーディング規約

## 命名規約

- **camelCase**: 変数、関数、メソッド（`getUserById`, `isActive`）
- **PascalCase**: クラス、型、インターフェース、コンポーネント（`UserService`, `ButtonProps`）
- **UPPER_SNAKE_CASE**: 定数（`MAX_RETRY_COUNT`, `API_BASE_URL`）
- **kebab-case**: ファイル名、ディレクトリ名（`user-service.ts`）

## コードスタイル

- **DRY**: コード重複は即座に排除
- **早期リターン/ガード節**: 深いネストを避ける
- **イミュータビリティ**: `[...array, item]`, `{ ...obj, key: val }` — 直接変更しない
- **ファイルサイズ**: 200-400行推奨、500行超で分割検討。関数は50行以下
- **三項演算子**: 単純な場合のみ。ネストした三項演算子は使用禁止

## ハードコーディング禁止

- **マジックナンバー**: `const MAX_RETRY = 3;` — 数値リテラル直接記述禁止
- **設定値**: 環境変数または設定ファイル（API Key, URL, パス）
- **UI文字列**: 定数や言語ファイルで管理

## TypeScript

- **strict mode** 有効
- **any 禁止**: `unknown` + 型ガードを使用
- **明示的な戻り値の型**: 公開関数には必ず型を指定
- **インポート順序**: 外部ライブラリ → 内部モジュール（絶対パス）→ 相対パス

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

main | develop | feature/* | fix/* | release/*

## リファクタリング技法

テストがグリーンの状態を維持しながら、一度に一つずつ適用する:

- メソッドの抽出: 複雑な関数を分割
- 変数/関数の名前変更: 明確性の向上
- マジックナンバーを定数に置き換え
- 条件式の簡略化
- クラス/モジュールの抽出
- デッドコードの排除
