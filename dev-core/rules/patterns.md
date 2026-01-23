# Code Patterns

## API レスポンスパターン

```typescript
// 成功レスポンス
type SuccessResponse<T> = {
  success: true;
  data: T;
};

// エラーレスポンス
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

## Custom Hooks パターン

```typescript
function useResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // 実装...

  return { data, error, loading, refetch };
}
```

## Repository パターン

```typescript
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}
```

## Factory パターン

```typescript
interface EntityFactory<T, CreateDTO> {
  create(dto: CreateDTO): T;
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
