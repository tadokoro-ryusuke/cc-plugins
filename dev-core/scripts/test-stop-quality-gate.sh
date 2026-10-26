#!/usr/bin/env bash
# stop-quality-gate.sh の回帰テスト。一時リポジトリに変更を作り、フックの exit code を確かめる。

set -eu

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
hook="$script_dir/stop-quality-gate.sh"
failures=0

new_repo() {
  repo="$(mktemp -d)"
  git -C "$repo" init -q
  git -C "$repo" config user.email fixture@example.invalid
  git -C "$repo" config user.name fixture
  mkdir -p "$repo/src" "$repo/tests" "$repo/scripts" "$repo/cmd/tool"
  printf '%s\n' 'export const a = 1;' >"$repo/src/app.ts"
  printf '%s\n' "it('works', () => {});" >"$repo/tests/app.test.ts"
  printf '%s\n' 'package util' '' 'func A() {}' >"$repo/src/util.go"
  git -C "$repo" add -A
  git -C "$repo" commit -q -m init
}

# expect <期待する exit code> <ラベル> [stop_hook_active]
expect() {
  expected="$1"
  label="$2"
  active="${3:-false}"
  set +e
  (cd "$repo" && printf '{"stop_hook_active":%s}' "$active" | bash "$hook" >/dev/null 2>&1)
  actual=$?
  set -e
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label (expected exit $expected, got $actual)" >&2
    failures=$((failures + 1))
  fi
  rm -rf "$repo"
}

new_repo
printf '%s\n' 'export const b = 2;' >>"$repo/src/app.ts"
expect 0 "clean tracked change passes"

new_repo
printf '%s\n' 'console.log("x");' >>"$repo/src/app.ts"
expect 2 "debug leftover in a tracked change blocks"

new_repo
printf '%s\n' 'console.log("x");' >>"$repo/src/app.ts"
expect 0 "second pass is allowed (stop_hook_active)" true

new_repo
printf '%s\n' 'console.log("x");' >"$repo/src/new.ts"
expect 2 "debug leftover in an untracked new file blocks"

new_repo
printf '%s\n' 'console.log("x");' >>"$repo/scripts/build.sh"
printf '%s\n' 'console.log("x");' >>"$repo/tests/app.test.ts"
expect 0 "debug output in scripts and tests is not a leftover"

new_repo
printf '%s\n' "it.only('focus', () => {});" >>"$repo/tests/app.test.ts"
expect 2 "focused test added to a tracked test file blocks"

new_repo
printf '%s\n' "describe.skip('skipped', () => {});" >"$repo/tests/new.test.ts"
expect 2 "skipped test in an untracked test file blocks"

new_repo
printf '%s\n' '@pytest.mark.skip(reason="later")' 'def test_x(): pass' >"$repo/tests/test_new.py"
expect 2 "pytest skip in a new test file blocks"

new_repo
printf '%s\n' 'const skipped = items.filter(isSkippable);' >>"$repo/tests/app.test.ts"
expect 0 "ordinary code mentioning skip is not a skip marker"

new_repo
printf '%s\n' "test.only ('spaced', () => {});" >>"$repo/tests/app.test.ts"
expect 2 "focused test with a space before the parenthesis blocks"

new_repo
printf '%s\n' '#[test]' '#[ignore = "requires network"]' 'fn slow() {}' >"$repo/src/lib.rs"
expect 2 "Rust ignore with a reason in a source file blocks"

new_repo
printf '%s\n' 'console.log("x");' >"$repo/notes.txt"
expect 0 "untracked non-source files are not scanned"

new_repo
git -C "$repo" rm -q tests/app.test.ts
expect 2 "deleting a tracked test file blocks"

new_repo
printf '%s\n' 'package main' '' 'import "fmt"' '' 'func main() { fmt.Println("hi") }' >"$repo/cmd/tool/main.go"
expect 0 "fmt.Println in package main is legitimate output"

new_repo
printf '%s\n' 'func B() { fmt.Println("debug") }' >>"$repo/src/util.go"
expect 2 "fmt.Println outside package main blocks"

repo="$(mktemp -d)"
git -C "$repo" init -q
printf '%s\n' 'console.log("x");' >"$repo/first.ts"
expect 0 "repository without commits does not fail"

# jq が無いときは何もしない（停止を通す）。jq を除いた PATH を作って確かめる
new_repo
printf '%s\n' 'console.log("debug");' >>"$repo/src/app.ts"
nojq="$(mktemp -d)"
for tool in git grep sed awk cat head tail wc find tr cut sort mktemp rm dirname basename env ls stat xargs; do
  tool_path="$(command -v "$tool" 2>/dev/null)" || continue
  case "$tool_path" in /*) ln -s "$tool_path" "$nojq/$tool" ;; esac
done
set +e
(cd "$repo" && printf '{"stop_hook_active":false}' | PATH="$nojq" /bin/bash "$hook" >/dev/null 2>&1)
actual=$?
set -e
if [ "$actual" != 0 ]; then
  echo "FAIL: jq が無いときは停止を通す (expected exit 0, got $actual)" >&2
  failures=$((failures + 1))
fi
rm -rf "$repo" "$nojq"

if [ "$failures" -ne 0 ]; then
  echo "$failures stop-quality-gate case(s) failed" >&2
  exit 1
fi
echo "stop-quality-gate: all cases passed"
