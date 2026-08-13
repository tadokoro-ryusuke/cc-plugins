---
name: backend-patterns
description: "API設計、Repository、サービス層、Resultパターン、キャッシュ、トランザクションのパターンガイド（フレームワーク非依存）。APIエンドポイント・ビジネスロジック・データアクセス層の実装/設計/レビュー時に使用する。対外契約（バージョニング・エラー体系）は dev-core:interface-contract-design、実行時信頼性の設計判断（リトライ・ロック・TTL）は dev-core:resilience-design が正本で、本スキルは実装コード例を担当する。"
---

# Backend Patterns

フレームワーク非依存のバックエンド設計パターン。ORM固有のAPI（Eloquent, Prisma等）は context7 MCP や .claude/*.local.md を参照してください。

実行時の信頼性の設計判断（例外3分類・リトライ・分離レベル/ロック選択・キャッシュTTL/無効化）は dev-core:resilience-design が正本。本スキルは実装コード例を担当する。

## API 設計

対外契約（バージョニング・後方互換・冪等性・イベント契約・RFC 9457 エラー体系）は dev-core:interface-contract-design が正本。本スキルは実装パターンを扱う。

### RESTful エンドポイント

```
GET    /api/users          # 一覧取得
GET    /api/users/:id      # 詳細取得
POST   /api/users          # 作成
PUT    /api/users/:id      # 更新
DELETE /api/users/:id      # 削除
```

### レスポンス形式

- 正常系: リソースを直接返し、適切な HTTP ステータスで結果を表現する（封筒でくるまない）。
- エラー: `application/problem+json`（RFC 9457 Problem Details）で返す。形式の正本は dev-core:interface-contract-design Step 7。
- `success` フラグ封筒型（全部 200 で返して `success: false`）は非推奨。HTTP セマンティクスを殺し、監視もリトライも壊れるため。

### HTTP ステータスコード

200: 成功 | 201: 作成 | 400: バリデーションエラー | 401: 認証 | 403: 認可 | 404: 未発見 | 500: サーバーエラー

## Repository パターン

```typescript
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}
```

具象実装はORM/フレームワークに依存（Eloquent, Prisma, TypeORM等）。インターフェースで抽象化し、依存性逆転を実現。

## サービス層（ユースケース）

```typescript
class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async execute(input: CreateUserInput): Promise<Result<User>> {
    const validated = CreateUserSchema.parse(input);
    const user = User.create(validated);
    const saved = await this.userRepository.save(user);
    await this.emailService.sendWelcome(saved.email);
    return ok(saved);
  }
}
```

## Result パターン

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
```

## キャッシュ戦略

### Cache-Aside パターン

1. キャッシュ確認 → 2. ヒットしなければDB取得 → 3. キャッシュに保存
- 更新時はキャッシュを無効化
- TTL を適切に設定（ユースケースに応じて）

## トランザクション

- 複数の書き込み操作は必ずトランザクションで囲む
- 原子性（ACID）の保証
- デッドロック防止（一貫したロック順序）
- 具体的なAPI はORM/フレームワークに依存（`DB::transaction()`, `prisma.$transaction()`等）
