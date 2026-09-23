# アーキテクチャ原則 — FSD / Clean Architecture / DDD

**適用範囲の使い分け**: FSD は **SPA/Web フロントエンド専用**の方法論（`widgets` = ページ構成要素）。バックエンド・CLI・バッチ・Cloudflare Workers・Tauri の Rust コアには適用せず、Clean Architecture / Hexagonal のレイヤリングを使う。普遍なのは「依存は内側（ドメイン）へ一方向」という原則であり、ディレクトリ命名は対象に合わせる。

## Feature-Sliced Design (FSD) — フロントエンド専用

### レイヤー構造（上から下へ依存）

```
src/
├── app/       # アプリケーション層（ページ、グローバル設定）
├── widgets/   # ウィジェット層（ページ構成要素）
├── features/  # フィーチャー層（ユーザー向け機能）
├── entities/  # エンティティ層（ビジネスエンティティ）
└── shared/    # 共有層（UI、ユーティリティ、設定）
```

### 依存関係ルール

- 上位層は下位層のみに依存可能
- 同一層内での相互依存は禁止
- shared 層はどこからでも使用可能

### スライス構成

```
features/[feature-name]/
├── api/      # APIクライアント、サーバーアクション
├── model/    # ストア、型、ビジネスロジック
├── ui/       # UIコンポーネント
└── index.ts  # パブリックAPI
```

## Clean Architecture — 全スタック共通

### 依存性の逆転

- ビジネスロジックは外部依存を持たない
- インターフェースを通じた疎結合（TS: `interface` / Rust: trait / Python: `typing.Protocol` or ABC / Go: interface）
- 詳細（UI、DB）はビジネスルールに依存

非フロントエンドでの典型構成（ディレクトリ名は言語慣習に従う）:

```
src/
├── domain/          # エンティティ・値オブジェクト・リポジトリ interface（外部依存ゼロ）
├── application/     # ユースケース（domain のみに依存）
├── infrastructure/  # DB・外部 API の具象実装
└── presentation/    # HTTP ハンドラ / CLI / Tauri コマンド（薄いアダプタに保つ）
```

Tauri では `#[tauri::command]` 関数を presentation 層の薄いアダプタとし、ドメインロジックは Tauri 非依存のクレートに置く（`cargo test` 単体で回せる形が正）。Cloudflare Workers では Hono ハンドラを同様に薄く保ち、Env（バインディング）は infrastructure 層でコンストラクタ注入する。

```typescript
// Domain層（entities）— インターフェース定義
interface ClientRepository {
  findById(id: string): Promise<Client>;
}

// Application層（features）— ユースケース
class GetClientUseCase {
  constructor(private repo: ClientRepository) {}
  async execute(id: string) { return this.repo.findById(id); }
}

// Infrastructure層（features/api）— 具象実装
class DBClientRepository implements ClientRepository {
  async findById(id: string) { /* DB操作 */ }
}
```

## DDD（ドメイン駆動設計）

### エンティティとバリューオブジェクト

```typescript
// エンティティ（識別子を持つ）
class Client {
  constructor(
    private readonly id: ClientId,
    private name: ClientName,
    private tags: Tag[],
  ) {}
}

// バリューオブジェクト（不変、自己検証）
class ClientName {
  constructor(private readonly value: string) {
    if (value.length < 2) throw new Error("クライアント名は2文字以上必要です");
  }
}
```

### 集約とリポジトリ

- 集約ルートを通じたアクセス
- トランザクション境界の明確化
- リポジトリパターンの実装
