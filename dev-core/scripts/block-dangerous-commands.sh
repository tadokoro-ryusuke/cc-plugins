#!/usr/bin/env bash
# PreToolUse(Bash) フック: 代表的な誤操作を止める best-effort の tripwire。
#
# 完全なセキュリティ境界ではない（多層防御の一層）。厳密な禁止は、利用者の settings の
# permissions.deny、sandbox、サーバー側の branch protection で行う。rm の重要パス
# （/、~、作業ディレクトリとその親）は、Claude Code 本体が全モードで自動承認しない。
#
# 照合は、引用符の中身と heredoc の本文を除いた「コマンドの位置」の語だけに行う。
# `;` `&&` `||` `|` `&` と改行で区切った各コマンドについて、sudo / env / command / xargs などの
# 前置きを外してから判定する。`bash -c '...'` と `$( ... )` の中身は1段だけ見る。
#
#   block（exit 2）: rm -r で / ・ ~ ・ $HOME を消す、main / master への強制 push（-f / --force /
#                    +refspec。宛先を書かないときは今のブランチ）、DB クライアントでの DROP / TRUNCATE
#   ask（確認）    : git reset --hard、git clean -f、git restore .、git checkout -- .、
#                    git branch -D、main / master への --force-with-lease
#
# jq が無い・入力を解釈できないときは、理由を stderr に出して exit 1 で通す（non-blocking error）。
set -u

if ! command -v jq >/dev/null 2>&1; then
  echo "block-dangerous-commands: jq が見つからないため検査できません。jq を入れてください" >&2
  exit 1
fi

INPUT=$(cat)
if ! CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null); then
  echo "block-dangerous-commands: フックの入力を JSON として解釈できません" >&2
  exit 1
fi
[ -z "$CMD" ] && exit 0

PROTECTED_BRANCH_PATTERN='^(main|master)$'
BLOCK_REASONS=""
ASK_REASONS=""

add_block() { BLOCK_REASONS="${BLOCK_REASONS}- $1
"; }
add_ask() { ASK_REASONS="${ASK_REASONS}- $1
"; }

# コマンド列を「単純なコマンド」ごとの行に分ける。引用符の中では区切らず、heredoc の本文は捨てる。
split_commands() {
  printf '%s\n' "$1" | awk '
    BEGIN { q = ""; seg = ""; heredoc = ""; pending = "" }
    {
      line = $0
      if (heredoc != "") {
        t = line; sub(/^\t+/, "", t)
        if (t == heredoc) heredoc = ""
        next
      }
      if (q == "" && match(line, /<<-?[ \t]*["'\'']?[A-Za-z_][A-Za-z0-9_]*["'\'']?/)) {
        d = substr(line, RSTART, RLENGTH)
        gsub(/<<-?[ \t]*/, "", d); gsub(/["'\'']/, "", d)
        pending = d
      }
      n = length(line)
      for (i = 1; i <= n; i++) {
        c = substr(line, i, 1)
        if (q != "") {
          seg = seg c
          if (c == "\\" && q == "\"" && i < n) { i++; seg = seg substr(line, i, 1); continue }
          if (c == q) q = ""
          continue
        }
        if (c == "\047" || c == "\"") { q = c; seg = seg c; continue }
        if (c == "\\" && i < n) { seg = seg c substr(line, i + 1, 1); i++; continue }
        if (c == ";" || c == "&" || c == "|") { print seg; seg = ""; continue }
        seg = seg c
      }
      if (q == "") { print seg; seg = "" } else { seg = seg " " }
      if (pending != "") { heredoc = pending; pending = "" }
    }
    END { if (seg != "") print seg }
  '
}

# 引用符を外した語の並び（中身は残す）
unquote() { printf '%s' "$1" | tr -d "\"'"; }

current_branch() { git branch --show-current 2>/dev/null; }

check_rm() {
  local recursive=0 arg
  for arg in "$@"; do
    case "$arg" in
      --recursive) recursive=1 ;;
      --*) ;;
      -*[rR]*) recursive=1 ;;
    esac
  done
  [ "$recursive" -eq 1 ] || return 0
  for arg in "$@"; do
    # ~ と $HOME はパターン側で展開されないよう引用符で囲む（語の側は展開前の文字列のまま）
    # shellcheck disable=SC2088,SC2016
    case "$arg" in
      /|/\*|'~'|'~/'|'~/*'|'$HOME'|'$HOME/'|'$HOME/*'|'${HOME}'|'${HOME}/')
        add_block "rm -r でルートかホームを消す: rm $*" ;;
    esac
  done
}

check_git_push() {
  local force=0 lease=0 positional=() arg
  for arg in "$@"; do
    case "$arg" in
      --force-with-lease*|--force-if-includes) lease=1 ;;
      --force) force=1 ;;
      --*) ;;
      -*f*) force=1 ;;
      -*) ;;
      *) positional+=("$arg") ;;
    esac
  done
  # 先頭の位置引数は remote、残りが refspec
  local refspecs=("${positional[@]:1}") spec plus dst
  if [ "${#refspecs[@]}" -eq 0 ]; then
    dst=$(current_branch)
    if printf '%s' "$dst" | grep -qE "$PROTECTED_BRANCH_PATTERN"; then
      [ "$force" -eq 1 ] && add_block "今のブランチ ($dst) への強制 push"
      [ "$force" -eq 0 ] && [ "$lease" -eq 1 ] && add_ask "今のブランチ ($dst) への --force-with-lease"
    fi
    return 0
  fi
  for spec in "${refspecs[@]}"; do
    plus=0
    case "$spec" in +*) plus=1; spec="${spec#+}" ;; esac
    dst="${spec##*:}"
    dst="${dst#refs/heads/}"
    printf '%s' "$dst" | grep -qE "$PROTECTED_BRANCH_PATTERN" || continue
    if [ "$force" -eq 1 ] || [ "$plus" -eq 1 ]; then
      add_block "$dst への強制 push"
    elif [ "$lease" -eq 1 ]; then
      add_ask "$dst への --force-with-lease"
    fi
  done
}

check_git() {
  # git のグローバルオプション（-C <dir>、-c <k=v> など）を飛ばしてサブコマンドを得る
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -C|-c) shift 2 || return 0 ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ "$#" -gt 0 ] || return 0
  local sub="$1" arg
  shift
  case "$sub" in
    push) check_git_push "$@" ;;
    reset)
      for arg in "$@"; do [ "$arg" = "--hard" ] && add_ask "git reset --hard（未コミットの変更が消える）"; done ;;
    clean)
      for arg in "$@"; do
        case "$arg" in --force|-*f*) add_ask "git clean -f（未追跡ファイルが消える）"; break ;; esac
      done ;;
    restore)
      local staged=0 worktree=0 everything=0
      for arg in "$@"; do
        case "$arg" in
          --staged|-S) staged=1 ;;
          --worktree|-W) worktree=1 ;;
          .|:/|./) everything=1 ;;
        esac
      done
      if [ "$everything" -eq 1 ] && { [ "$staged" -eq 0 ] || [ "$worktree" -eq 1 ]; }; then
        add_ask "git restore .（作業ツリーの変更が消える）"
      fi ;;
    checkout)
      for arg in "$@"; do
        case "$arg" in .|:/|./) add_ask "git checkout .（作業ツリーの変更が消える）"; break ;; esac
      done ;;
    branch)
      for arg in "$@"; do [ "$arg" = "-D" ] && add_ask "git branch -D（マージされていないブランチも消える）"; done ;;
  esac
}

check_sql() {
  if printf '%s' "$1" | grep -qiE '(^|[^[:alnum:]_])(drop[[:space:]]+(table|database|schema)|truncate)([^[:alnum:]_]|$)'; then
    add_block "DB クライアントでの DROP / TRUNCATE"
  fi
}

check_command() {
  local raw="$1" depth="$2"
  local -a toks
  read -r -a toks <<<"$(unquote "$raw")" || true
  local i=0 n="${#toks[@]}"
  # 前置きを外してコマンドの位置を得る
  while [ "$i" -lt "$n" ]; do
    case "${toks[$i]}" in
      sudo)
        i=$((i + 1))
        while [ "$i" -lt "$n" ] && [[ "${toks[$i]}" == -* ]]; do
          case "${toks[$i]}" in -u|-g|-h|-p|-C) i=$((i + 2)) ;; *) i=$((i + 1)) ;; esac
        done ;;
      env)
        i=$((i + 1))
        while [ "$i" -lt "$n" ] && { [[ "${toks[$i]}" == -* ]] || [[ "${toks[$i]}" == *=* ]]; }; do i=$((i + 1)); done ;;
      xargs)
        i=$((i + 1))
        while [ "$i" -lt "$n" ] && [[ "${toks[$i]}" == -* ]]; do i=$((i + 1)); done ;;
      command|nohup|time|exec|builtin|then|do|else|'('|'{'|'!') i=$((i + 1)) ;;
      [A-Za-z_]*=*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "$i" -lt "$n" ] || return 0
  local cmd="${toks[$i]##*/}"
  local -a args=("${toks[@]:$((i + 1))}")
  case "$cmd" in
    rm) check_rm "${args[@]+"${args[@]}"}" ;;
    git) check_git "${args[@]+"${args[@]}"}" ;;
    psql|mysql|mariadb|sqlite3|sqlcmd) check_sql "$raw" ;;
    bash|sh|zsh|dash)
      if [ "$depth" -eq 0 ]; then
        local inner
        inner=$(printf '%s' "$raw" | sed -nE "s/.*[[:space:]]-c[[:space:]]+'([^']*)'.*/\1/p; s/.*[[:space:]]-c[[:space:]]+\"([^\"]*)\".*/\1/p" | head -n 1)
        [ -n "$inner" ] && check_all "$inner" 1
      fi ;;
  esac
  # $( ... ) の中身を1段だけ見る
  if [ "$depth" -eq 0 ]; then
    local sub
    sub=$(printf '%s' "$raw" | sed -nE 's/.*\$\(([^()]*)\).*/\1/p' | head -n 1)
    [ -n "$sub" ] && check_all "$sub" 1
  fi
  return 0
}

check_all() {
  local text="$1" depth="$2" segment
  while IFS= read -r segment; do
    [ -n "${segment//[[:space:]]/}" ] || continue
    check_command "$segment" "$depth"
  done <<EOF
$(split_commands "$text")
EOF
}

check_all "$CMD" 0

if [ -n "$BLOCK_REASONS" ]; then
  {
    echo "BLOCKED: 取り返しのつかない操作の可能性があるため止めました（dev-core の tripwire）:"
    printf '%s' "$BLOCK_REASONS"
    echo "意図した操作なら、ユーザーに確認したうえでユーザー自身が実行してください。"
  } >&2
  exit 2
fi

if [ -n "$ASK_REASONS" ]; then
  jq -n --arg reason "$(printf '戻せない可能性のある操作です。実行してよいか確認してください:\n%s' "$ASK_REASONS")" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: $reason}}'
  exit 0
fi

exit 0
