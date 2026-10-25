#!/usr/bin/env bash
# Stop フック: 応答終了前のクオリティゲート（デバッグ残骸とテスト弱体化の検出）。
# 未コミットの変更（追跡済みの差分と、未追跡の新規ファイル）を見て、次を検出したら
# exit 2 で停止をブロックし、Claude に対応を促す。
#   - 追加行に残ったデバッグ残骸（console.log / debugger 等）
#   - テストファイルに追加された focus / skip マーカー（it.only / describe.skip / @pytest.mark.skip 等）
#   - 追跡済みのテストファイルの削除
#
# - stop_hook_active が true の場合（このフックのブロックから継続した応答）は
#   無限ループ防止のため必ず exit 0 する。意図的に残す判断もこの 2 周目で許容される。
# - 検出は文字列の照合による best-effort で、テストの弱体化をすべて捕まえるものではない。
#   アサーションの純減やスナップショットの一括更新は、verify の Diff ステップで人が判断する。
# - jq・git が無い、コミットが1つも無いリポジトリなどでは何もしない（停止を通す）。
# - 検出パターンを追加する場合は DEBUG_PATTERN / SKIP_PATTERN / RUST_IGNORE_PATTERN を編集する（continuous-learning スキル参照）。
# - 未追跡ファイルは、ソースの拡張子のものだけを最大 MAX_UNTRACKED_FILES 件、MAX_FILE_BYTES 以下に限って見る。
# - Go の fmt.Println は、main パッケージのファイルと cmd/ 配下では正当な出力として
#   使われるため、そのファイルに限って検出対象から外す（他のパターンはそのまま検出する）。
set -u

INPUT=$(cat)

# 無限ループ防止: 既にこのフックのフィードバックを受けた後の停止は通す
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$ACTIVE" = "true" ] && exit 0

# git リポジトリ外、またはコミットが無いリポジトリでは何もしない
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
TOP=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
git -C "$TOP" rev-parse --verify -q HEAD >/dev/null 2>&1 || exit 0

# JS/TS: console.log/debug, debugger / PHP: var_dump / Ruby: binding.pry
# Python: breakpoint(), pdb.set_trace() / Rust: dbg!() / Go: fmt.Println
DEBUG_PATTERN='^\+.*(console\.(log|debug)\(|debugger;|var_dump\(|binding\.pry|breakpoint\(\)|pdb\.set_trace\(\)|\bdbg!\(|fmt\.Println\()'

# Go の fmt.Println を正当な出力として扱うファイル: パスの cmd/ セグメント、または package main 宣言
# GO_PRINT_TOKEN は DEBUG_PATTERN 内の表記と一致させる（一致しないと除外が効かず、検出側に倒れる）
GO_PRINT_TOKEN='|fmt\.Println\('
GO_PRINT_ALLOWED_PATH_PATTERN='(^|/)cmd/'
GO_PACKAGE_MAIN_PATTERN='^[[:space:]]*package[[:space:]]+main([[:space:]]|$)'
DEBUG_PATTERN_WITHOUT_GO_PRINT="${DEBUG_PATTERN/"$GO_PRINT_TOKEN"/}"

# デバッグ残骸の検出から外すファイル（テストファイル・スクリプト類）
EXCLUDE_PATH_PATTERN='(\.test\.|\.spec\.|_test\.|(^|/)tests?/|(^|/)__tests__/|(^|/)scripts?/)'

# テストファイルとみなすパス
TEST_PATH_PATTERN='(\.test\.|\.spec\.|_test\.|(^|/)test_[^/]*\.py$|(^|/)tests?/|(^|/)__tests__/)'
# テストの focus / skip マーカー（括弧の前の空白も許す）
# JS/TS: it/test/describe.only・.skip、fit/fdescribe/xit/xdescribe/xtest / Python: pytest の skip
# Go: t.Skip / Java・Kotlin: @Disabled
SKIP_PATTERN='^\+.*(\b(it|test|describe|context)\.(only|skip)[[:space:]]*\(|(^|[^[:alnum:]_.])(fit|fdescribe|xit|xdescribe|xtest)[[:space:]]*\(|@pytest\.mark\.skip|pytest\.skip[[:space:]]*\(|\bt\.Skip(Now|f)?[[:space:]]*\(|@Disabled\b)'
# Rust のテストは src/ の中にも書かれるので、#[ignore]（理由付きを含む）は .rs ファイルならどこでも見る
RUST_IGNORE_PATTERN='^\+[[:space:]]*#\[ignore([[:space:]]*=|[[:space:]]*\])'

# 未追跡ファイルはソースだけを、上限付きで見る（巨大な未追跡ツリーで Stop のたびに待たせないため）
SOURCE_EXT_PATTERN='\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|svelte|py|rb|php|go|rs|java|kt|kts|swift|scala|cs|c|cc|cpp|h|hpp|dart|ex|exs|lua)$'
MAX_UNTRACKED_FILES=200
MAX_FILE_BYTES=1048576

DEBUG_FINDINGS=""
TEST_FINDINGS=""

# 1ファイルの追加行を検査する。引数: パス 追加行
scan() {
  local f="$1" lines="$2" hits pattern
  if printf '%s\n' "$f" | grep -qE "$TEST_PATH_PATTERN"; then
    hits=$(printf '%s\n' "$lines" | grep -E "$SKIP_PATTERN" | head -5)
    [ -n "$hits" ] && TEST_FINDINGS="${TEST_FINDINGS}${f}:
${hits}
"
  fi
  case "$f" in
    *.rs)
      hits=$(printf '%s\n' "$lines" | grep -E "$RUST_IGNORE_PATTERN" | head -5)
      [ -n "$hits" ] && TEST_FINDINGS="${TEST_FINDINGS}${f}:
${hits}
" ;;
  esac
  printf '%s\n' "$f" | grep -qE "$EXCLUDE_PATH_PATTERN" && return 0
  pattern="$DEBUG_PATTERN"
  if printf '%s\n' "$f" | grep -qE "$GO_PRINT_ALLOWED_PATH_PATTERN" \
    || grep -qE "$GO_PACKAGE_MAIN_PATTERN" "$TOP/$f" 2>/dev/null; then
    pattern="$DEBUG_PATTERN_WITHOUT_GO_PRINT"
  fi
  hits=$(printf '%s\n' "$lines" | grep -E "$pattern" | head -5)
  [ -n "$hits" ] && DEBUG_FINDINGS="${DEBUG_FINDINGS}${f}:
${hits}
"
  return 0
}

# 追跡済みの変更: 差分の追加行
while IFS= read -r f; do
  [ -z "$f" ] && continue
  scan "$f" "$(git -C "$TOP" diff HEAD --unified=0 -- "$f" 2>/dev/null | grep -v '^+++ ')"
done <<EOF
$(git -C "$TOP" diff HEAD --name-only --diff-filter=ACMR 2>/dev/null)
EOF

# 未追跡の新規ファイル: 全行を追加行として扱う（ソースだけ、シンボリックリンクと巨大なファイルは除く）
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -L "$TOP/$f" ] && continue
  [ -f "$TOP/$f" ] || continue
  [ "$(wc -c <"$TOP/$f" 2>/dev/null || echo 0)" -le "$MAX_FILE_BYTES" ] || continue
  scan "$f" "$(sed 's/^/+/' "$TOP/$f" 2>/dev/null)"
done <<EOF
$(git -C "$TOP" ls-files --others --exclude-standard 2>/dev/null | grep -E "$SOURCE_EXT_PATTERN" | head -n "$MAX_UNTRACKED_FILES")
EOF

DELETED_TESTS=$(git -C "$TOP" diff HEAD --name-only --diff-filter=D 2>/dev/null | grep -E "$TEST_PATH_PATTERN")
if [ -n "$DELETED_TESTS" ]; then
  TEST_FINDINGS="${TEST_FINDINGS}削除されたテストファイル:
${DELETED_TESTS}
"
fi

if [ -n "$DEBUG_FINDINGS" ] || [ -n "$TEST_FINDINGS" ]; then
  {
    if [ -n "$DEBUG_FINDINGS" ]; then
      echo "Stop quality gate: 変更にデバッグ残骸が含まれています。除去するか、意図的に残す場合はその理由をユーザーに報告してから終了してください:"
      echo "$DEBUG_FINDINGS"
    fi
    if [ -n "$TEST_FINDINGS" ]; then
      echo "Stop quality gate: テストの focus / skip マーカーの追加、またはテストファイルの削除があります。仕様の変更を根拠にしない改変なら戻してください。正当な理由（仕様の変更、承認済みの隔離など）がある場合は、対象と根拠をユーザーに報告してから終了してください:"
      echo "$TEST_FINDINGS"
    fi
  } >&2
  exit 2
fi

exit 0
