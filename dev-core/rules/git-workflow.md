# Git Workflow

## Conventional Commits

```
<type>(<scope>): <subject>
```

type: feat | fix | docs | style | refactor | test | chore

## 4段階実装フロー

1. **Task**: 要件整理・計画・Issue作成（/dev-core:task）
2. **Implement**: TDD 実装（/dev-core:execute）
3. **Verify**: 検証（/dev-core:verify）
4. **Refactor**: 改善（/dev-core:refactor）

## ブランチ

main | develop | feature/* | fix/* | release/*
