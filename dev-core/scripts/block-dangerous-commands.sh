#!/usr/bin/env bash
# PreToolUse(Bash) フック: 破壊的コマンドをブロックする。
# stdin にフック入力 JSON を受け取り、危険パターンに一致したら exit 2（ブロック）。
# 検出パターンを追加する場合はこのファイルを編集する（continuous-learning スキル参照）。
set -u

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$CMD" ] && exit 0

DANGEROUS_PATTERNS=(
  'rm\s+-rf\s+[/~]'
  'drop\s+(table|database)'
  'truncate\s+table'
  'git\s+push\s+--force\s+(origin\s+)?(main|master)'
  'git\s+reset\s+--hard'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if printf '%s' "$CMD" | grep -qEi "$pattern"; then
    echo "BLOCKED: 危険なコマンドを検出しました (pattern: ${pattern}) 。実行が本当に必要な場合はユーザーが手動で実行してください。" >&2
    exit 2
  fi
done

exit 0
