#!/usr/bin/env bash
# block-dangerous-commands.sh の回帰テスト。コマンドは実行せず、フック入力の JSON を渡して
# exit code と出力だけを確かめる。
#   block: exit 2
#   ask:   exit 0 で、stdout の permissionDecision が "ask"
#   pass:  exit 0 で、stdout が空

set -eu

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
hook="$script_dir/block-dangerous-commands.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

# フックはカレントディレクトリのブランチを見るので、feature ブランチの一時リポジトリで実行する
git -C "$work" init -q
git -C "$work" config user.email fixture@example.invalid
git -C "$work" config user.name fixture
git -C "$work" commit -q --allow-empty -m init
git -C "$work" switch -q -c feature/x

run_hook() {
  jq -n --arg cmd "$1" '{tool_input: {command: $cmd}}' | (cd "$work" && bash "$hook")
}

expect() {
  expected="$1"
  command_text="$2"
  set +e
  output=$(run_hook "$command_text" 2>/dev/null)
  code=$?
  set -e
  actual=pass
  if [ "$code" -eq 2 ]; then
    actual=block
  elif [ "$code" -eq 0 ] && printf '%s' "$output" | jq -e '.hookSpecificOutput.permissionDecision == "ask"' >/dev/null 2>&1; then
    actual=ask
  elif [ "$code" -ne 0 ] || [ -n "$output" ]; then
    actual="unexpected(exit $code)"
  fi
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: expected $expected, got $actual: $command_text" >&2
    failures=$((failures + 1))
  fi
}

# --- must-block ---
expect block 'rm -rf /'
expect block 'rm -fr /'
expect block 'rm -r -f ~'
expect block 'rm -rf ~/'
# shellcheck disable=SC2016 # $HOME を展開せずにフックへ渡す
expect block 'rm -rf $HOME'
expect block 'sudo rm -rf /'
expect block 'echo start && rm -rf /'
expect block 'git push --force origin main'
expect block 'git push -f origin main'
expect block 'git push origin +main'
expect block 'git push origin main --force'
expect block 'git push --force origin HEAD:main'
expect block 'git push -f origin master'
expect block "bash -c 'git push -f origin main'"
expect block 'psql -c "DROP TABLE users"'
expect block "mysql -e 'truncate table users'"

# --- must-pass（以前は誤って止めていた形を含む） ---
expect pass 'echo "rm -rf /"'
expect pass "grep -rn 'drop table' ."
expect pass 'git commit -m "docs: explain why git reset --hard is risky"'
expect pass 'rm -rf /tmp/build'
expect pass 'rm -rf ./build'
expect pass 'git push --force origin main-fix'
expect pass 'git push origin feature/main'
expect pass 'git push -u origin feature-x'
expect pass 'git push --force'
expect pass 'git status'
expect pass "printf '%s' 'git push -f origin main'"
expect pass "cat <<'EOF'
rm -rf /
git push -f origin main
EOF"
expect pass 'git restore --staged .'

# --- must-ask（戻せる余地のある破壊的操作） ---
expect ask 'git reset --hard'
expect ask 'git reset --hard HEAD~1'
expect ask 'git clean -fdx'
expect ask 'git restore .'
expect ask 'git checkout -- .'
expect ask 'git branch -D old-branch'
expect ask 'git push --force-with-lease origin main'

# 今いるブランチが main なら、宛先を書かない強制 push も止める
git -C "$work" switch -q -c main 2>/dev/null || git -C "$work" switch -q main
expect block 'git push --force'
expect block 'git push -f'

# jq が無いときは止めずに通す（non-blocking error: exit 1）
set +e
printf '%s' '{"tool_input":{"command":"git status"}}' | (cd "$work" && PATH=/nonexistent /bin/bash "$hook" >/dev/null 2>&1)
code=$?
set -e
if [ "$code" -ne 1 ]; then
  echo "FAIL: expected exit 1 when jq is missing, got $code" >&2
  failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  echo "$failures block-dangerous-commands case(s) failed" >&2
  exit 1
fi
echo "block-dangerous-commands: all cases passed"
