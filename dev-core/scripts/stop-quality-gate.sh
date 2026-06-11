#!/usr/bin/env bash
# Stop フック: 応答終了前のクオリティゲート。
# 変更ファイルの追加行に残ったデバッグ残骸（console.log / debugger 等）を検出したら
# exit 2 で停止をブロックし、Claude にクリーンアップを促す。
#
# - stop_hook_active が true の場合（このフックのブロックから継続した応答）は
#   無限ループ防止のため必ず exit 0 する。意図的に残す判断もこの 2 周目で許容される。
# - 検出パターンを追加する場合は DEBUG_PATTERN を編集する（continuous-learning スキル参照）。
set -u

INPUT=$(cat)

# 無限ループ防止: 既にこのフックのフィードバックを受けた後の停止は通す
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$ACTIVE" = "true" ] && exit 0

# git リポジトリ外では何もしない
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

DEBUG_PATTERN='^\+.*(console\.(log|debug)\(|debugger;|var_dump\(|binding\.pry|breakpoint\(\))'

# 除外対象（テストファイル・スクリプト類）はファイルパスで判定する
EXCLUDE_PATH_PATTERN='(\.test\.|\.spec\.|_test\.|(^|/)tests?/|(^|/)__tests__/|(^|/)scripts?/)'

# 未コミットの変更（staged + unstaged）の追加行のみを対象にする
FINDINGS=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  hits=$(git diff HEAD --unified=0 -- "$f" 2>/dev/null | grep -E "$DEBUG_PATTERN" | head -5)
  if [ -n "$hits" ]; then
    FINDINGS="${FINDINGS}${f}:
${hits}
"
  fi
done <<EOF
$(git diff HEAD --name-only --diff-filter=ACMR 2>/dev/null | grep -vE "$EXCLUDE_PATH_PATTERN")
EOF

if [ -n "$FINDINGS" ]; then
  {
    echo "Stop quality gate: 変更にデバッグ残骸が含まれています。除去するか、意図的に残す場合はその理由をユーザーに報告してから終了してください:"
    echo "$FINDINGS"
  } >&2
  exit 2
fi

exit 0
