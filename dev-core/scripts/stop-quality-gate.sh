#!/usr/bin/env bash
# Stop フック: 応答終了前のクオリティゲート。
# 変更ファイルの追加行に残ったデバッグ残骸（console.log / debugger 等）を検出したら
# exit 2 で停止をブロックし、Claude にクリーンアップを促す。
#
# - stop_hook_active が true の場合（このフックのブロックから継続した応答）は
#   無限ループ防止のため必ず exit 0 する。意図的に残す判断もこの 2 周目で許容される。
# - 検出パターンを追加する場合は DEBUG_PATTERN を編集する（continuous-learning スキル参照）。
# - Go の fmt.Println は、main パッケージのファイルと cmd/ 配下では正当な出力として
#   使われるため、そのファイルに限って検出対象から外す（他のパターンはそのまま検出する）。
set -u

INPUT=$(cat)

# 無限ループ防止: 既にこのフックのフィードバックを受けた後の停止は通す
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$ACTIVE" = "true" ] && exit 0

# git リポジトリ外では何もしない
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# JS/TS: console.log/debug, debugger / PHP: var_dump / Ruby: binding.pry
# Python: breakpoint(), pdb.set_trace() / Rust: dbg!() / Go: fmt.Println
DEBUG_PATTERN='^\+.*(console\.(log|debug)\(|debugger;|var_dump\(|binding\.pry|breakpoint\(\)|pdb\.set_trace\(\)|\bdbg!\(|fmt\.Println\()'

# Go の fmt.Println を正当な出力として扱うファイル: パスの cmd/ セグメント、または package main 宣言
# GO_PRINT_TOKEN は DEBUG_PATTERN 内の表記と一致させる（一致しないと除外が効かず、検出側に倒れる）
GO_PRINT_TOKEN='|fmt\.Println\('
GO_PRINT_ALLOWED_PATH_PATTERN='(^|/)cmd/'
GO_PACKAGE_MAIN_PATTERN='^[[:space:]]*package[[:space:]]+main([[:space:]]|$)'
DEBUG_PATTERN_WITHOUT_GO_PRINT="${DEBUG_PATTERN/"$GO_PRINT_TOKEN"/}"

# 除外対象（テストファイル・スクリプト類）はファイルパスで判定する
EXCLUDE_PATH_PATTERN='(\.test\.|\.spec\.|_test\.|(^|/)tests?/|(^|/)__tests__/|(^|/)scripts?/)'

# 未コミットの変更（staged + unstaged）の追加行のみを対象にする
# name-only のパスはリポジトリルート基準なので、ファイル内容はルートから読む
TOP=$(git rev-parse --show-toplevel 2>/dev/null)
FINDINGS=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  pattern="$DEBUG_PATTERN"
  if printf '%s\n' "$f" | grep -qE "$GO_PRINT_ALLOWED_PATH_PATTERN" \
    || grep -qE "$GO_PACKAGE_MAIN_PATTERN" "$TOP/$f" 2>/dev/null; then
    pattern="$DEBUG_PATTERN_WITHOUT_GO_PRINT"
  fi
  hits=$(git diff HEAD --unified=0 -- "$f" 2>/dev/null | grep -E "$pattern" | head -5)
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
