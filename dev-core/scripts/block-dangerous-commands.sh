#!/usr/bin/env bash
# PreToolUse(Bash) フック: 代表的な誤操作を止める best-effort の tripwire。
#
# 完全なセキュリティ境界ではない（多層防御の一層）。厳密な禁止は、利用者の settings の
# permissions.deny、sandbox、サーバー側の branch protection で行う。rm の重要パス
# （/、~、作業ディレクトリとその親）は、Claude Code 本体が全モードで自動承認しない。
#
# コマンド文字列を1文字ずつ字句解析し（引用符・エスケープ・コメント・heredoc・$( )・バッククォート）、
# `;` `&` `|` `(` `)` と改行で区切った各コマンドの語の並びを判定する。引用符で囲まれた語は1語として
# 扱い、実行されない文字列（引用符の中身、引用符付きの heredoc の本文、コメント）はコマンドとして
# 見ない。$( ) とバッククォート、引用符なしの heredoc の中の $( ) は、コマンドとして見る。
# if・then・sudo・env・command・xargs・nice・timeout などの前置きは、オプションとその値を読み飛ばす。
# bash -c / -lc など、eval、env -S の中の文字列は2段まで見る。
#
#   block（exit 2）: rm -r で / ・ ~ ・ $HOME を消す、main / master への強制 push（-f / --force /
#                    +refspec。宛先を書かないときは今のブランチ）、DB クライアントでの DROP / TRUNCATE
#   ask（確認）    : 作業ツリーや未追跡ファイルを捨てる git 操作、git branch -D、
#                    main / master への --force-with-lease
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
MAX_DEPTH=2
TAB=$(printf '\t')
BLOCK_REASONS=""
ASK_REASONS=""

add_block() { BLOCK_REASONS="${BLOCK_REASONS}- $1
"; }
add_ask() { ASK_REASONS="${ASK_REASONS}- $1
"; }

# コマンド文字列を字句解析し、語は "W<TAB>値"、コマンドの区切りは "S" の1行ずつに出す。
lex_commands() {
  printf '%s' "$1" | awk '
    function emit() { if (inword) { gsub(/\n/, " ", word); print "W\t" word; word = ""; inword = 0 } }
    function sep() { emit(); print "S" }
    function push(kind) { sp++; smode[sp] = mode; sdepth[sp] = depth; skind[sp] = kind; mode = "N"; depth = 0; sep() }
    function pop() { sep(); mode = smode[sp]; depth = sdepth[sp]; sp--; if (mode == "D") inword = 1 }
    function collect(line,    rest) {
      rest = line
      while (match(rest, /\$\([^()]*\)/)) { nd++; deferred[nd] = substr(rest, RSTART + 2, RLENGTH - 3); rest = substr(rest, RSTART + RLENGTH) }
      rest = line
      while (match(rest, /`[^`]*`/)) { nd++; deferred[nd] = substr(rest, RSTART + 1, RLENGTH - 2); rest = substr(rest, RSTART + RLENGTH) }
    }
    function lex(s,    n, i, c, nx, k, d, q, strip, j, line, t) {
      n = length(s); mode = "N"; depth = 0; sp = 0; word = ""; inword = 0; nh = 0
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1); nx = substr(s, i + 1, 1)
        if (mode == "S") { if (c == "\047") mode = "N"; else word = word c; continue }
        if (mode == "D") {
          if (c == "\"") { mode = "N"; continue }
          if (c == "\\" && index("$`\"\\\n", nx) > 0) { word = word nx; i++; continue }
          if (c == "$" && nx == "(") { emit(); i++; push("p"); continue }
          if (c == "`") { emit(); push("b"); continue }
          word = word c; continue
        }
        # mode N
        if (c == " " || c == "\t") { emit(); continue }
        if (c == "\n") {
          sep()
          for (k = 1; k <= nh; k++) {
            while (i < n) {
              j = index(substr(s, i + 1), "\n")
              if (j == 0) { line = substr(s, i + 1); i = n } else { line = substr(s, i + 1, j - 1); i = i + j }
              t = line; if (hstrip[k]) sub(/^\t+/, "", t)
              if (t == hdelim[k]) break
              if (!hquoted[k]) collect(line)
            }
          }
          nh = 0
          continue
        }
        if (c == "#" && !inword) { while (i < n && substr(s, i + 1, 1) != "\n") i++; continue }
        if (c == "\\") { if (nx == "\n") { i++; continue } word = word nx; inword = 1; i++; continue }
        if (c == "\047") { mode = "S"; inword = 1; continue }
        if (c == "\"") { mode = "D"; inword = 1; continue }
        if (c == "`") { if (sp > 0 && skind[sp] == "b") pop(); else { emit(); push("b") } continue }
        if (c == "$" && nx == "(") { emit(); i++; push("p"); continue }
        if (c == "$" && nx == "{") {
          d = 0
          for (; i <= n; i++) { c = substr(s, i, 1); word = word c; if (c == "{") d++; else if (c == "}") { d--; if (d == 0) break } }
          inword = 1; continue
        }
        if (c == ";" || c == "&" || c == "|") { sep(); continue }
        if (c == "(") { depth++; sep(); continue }
        if (c == ")") { if (depth > 0) { depth--; sep() } else if (sp > 0) pop(); else sep(); continue }
        if (c == "<" && nx == "<" && substr(s, i + 2, 1) != "<") {
          emit(); i += 2; strip = 0
          if (substr(s, i, 1) == "-") { strip = 1; i++ }
          while (substr(s, i, 1) == " " || substr(s, i, 1) == "\t") i++
          d = ""; q = 0
          for (; i <= n; i++) {
            c = substr(s, i, 1)
            if (c == "\047" || c == "\"" || c == "\\") { q = 1; continue }
            if (c == " " || c == "\t" || c == "\n" || c == ";" || c == "&" || c == "|" || c == "<" || c == ">" || c == ")") break
            d = d c
          }
          i--
          if (d != "") { nh++; hdelim[nh] = d; hquoted[nh] = q; hstrip[nh] = strip }
          continue
        }
        if (c == "<" || c == ">") { emit(); continue }
        word = word c; inword = 1
      }
      sep()
    }
    { text = (NR == 1) ? $0 : text "\n" $0 }
    END {
      nd = 0
      lex(text)
      for (m = 1; m <= nd; m++) lex(deferred[m])
    }
  '
}

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

# 1つのコマンドの語の並びを判定する。引数: 深さ 語...
check_words() {
  local depth="$1"
  shift
  local -a w=("$@")
  local n="${#w[@]}" i=0
  # 前置き（予約語・sudo・env・command・xargs など）を、オプションとその値ごと読み飛ばす
  while [ "$i" -lt "$n" ]; do
    case "${w[$i]}" in
      if|then|elif|else|do|while|until|'!'|'{'|'}') i=$((i + 1)) ;;
      sudo)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            --) i=$((i + 1)); break ;;
            -u|-g|-h|-p|-C|-D|-R|-T|-U|-r|-t) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      env)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            --) i=$((i + 1)); break ;;
            -u|-C|--unset|--chdir) i=$((i + 2)) ;;
            -S|--split-string)
              [ "$((i + 1))" -lt "$n" ] && check_text "${w[$((i + 1))]}" "$((depth + 1))"
              i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *=*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      command)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            -v|-V) return 0 ;;
            --) i=$((i + 1)); break ;;
            -*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      xargs)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            --) i=$((i + 1)); break ;;
            -n|-L|-I|-P|-s|-d|-E|-a) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      timeout)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            -s|-k|--signal|--kill-after) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) i=$((i + 1)); break ;;
          esac
        done ;;
      nice)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${w[$i]}" in
            -n) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      time|nohup|exec|builtin|stdbuf|setsid)
        i=$((i + 1))
        while [ "$i" -lt "$n" ] && [[ "${w[$i]}" == -* ]]; do i=$((i + 1)); done ;;
      [A-Za-z_]*=*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "$i" -lt "$n" ] || return 0
  local cmd="${w[$i]##*/}"
  local -a args=("${w[@]:$((i + 1))}")
  local arg next
  case "$cmd" in
    rm) check_rm "${args[@]+"${args[@]}"}" ;;
    git) check_git "${args[@]+"${args[@]}"}" ;;
    psql|mysql|mariadb|sqlite3|sqlcmd) check_sql "${args[*]+"${args[*]}"}" ;;
    eval) check_text "${args[*]+"${args[*]}"}" "$((depth + 1))" ;;
    bash|sh|zsh|dash|ksh)
      # -c、-lc、-ec など c を含むオプションの次の語が、実行する文字列
      next=0
      for arg in "${args[@]+"${args[@]}"}"; do
        if [ "$next" -eq 1 ]; then
          check_text "$arg" "$((depth + 1))"
          break
        fi
        case "$arg" in --*) ;; -*c*) next=1 ;; esac
      done ;;
  esac
  return 0
}

# 文字列を字句解析し、各コマンドを判定する。引数: 文字列 深さ
check_text() {
  local text="$1" depth="$2" line
  [ "$depth" -le "$MAX_DEPTH" ] || return 0
  local -a seg=()
  while IFS= read -r line; do
    if [ "$line" = "S" ]; then
      [ "${#seg[@]}" -gt 0 ] && check_words "$depth" "${seg[@]}"
      seg=()
    else
      seg+=("${line#W"$TAB"}")
    fi
  done <<EOF
$(lex_commands "$text")
EOF
  [ "${#seg[@]}" -gt 0 ] && check_words "$depth" "${seg[@]}"
  return 0
}

check_text "$CMD" 0

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
