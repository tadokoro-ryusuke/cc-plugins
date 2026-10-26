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
# 見ない。$( ) とバッククォート、${x:-$( )}、引用符なしの heredoc の中の $( ) は、別のコマンドとして見る。
# $( ) の終わりは、本体を同じ字句解析で走査して探す（引用符・コメント・heredoc の中の括弧は数えない）。
# 既知の制約: case の「パターン)」を含む $( ) は終わりを早く見誤る。パイプで渡した SQL やスクリプト
# （cat <<EOF | psql など）は見ない。SQL の文字列リテラルの中の DROP / TRUNCATE も止める（止める側の誤検知）。
# 関数の中で IFS を空にしてから検査を呼ぶような使い方は想定しない。
# 置換は外側の語の一部として残すので、置換の後ろの語も外側の同じコマンドの引数になる。
# if・then・sudo・env・command・xargs・nice・timeout などの前置きは、オプションとその値を読み飛ばす。
# bash -c / -lc など、eval、env -S の中の文字列は2段まで見る。
#
#   block（exit 2）: rm -r で / ・ ~ ・ $HOME を消す、main / master への強制 push（-f / --force /
#                    +refspec。宛先を書かないときは今のブランチ）、DB クライアントでの DROP / TRUNCATE
#                    （heredoc で渡した SQL を含む）。-c もスクリプトのファイルも無いシェルに heredoc で
#                    渡したスクリプトの中も見る
#   ask（確認）    : 作業ツリーや未追跡ファイルを捨てる git 操作、git branch -D、
#                    main / master への --force-with-lease
#
#   65536 文字を超えるコマンド、置換の入れ子が 32 段を超えるコマンド、字句解析が上限を超えたり
#   異常終了したりしたコマンドは、検査しきれないので確認に回す。
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
US=$(printf '\037')
NL='
'
BLOCK_REASONS=""
ASK_REASONS=""

add_block() { BLOCK_REASONS="${BLOCK_REASONS}- $1
"; }
add_ask() { ASK_REASONS="${ASK_REASONS}- $1
"; }

# コマンド文字列を字句解析し、語は "W<TAB>値"、コマンドの区切りは "S" の1行ずつに出す。
lex_commands() {
  printf '%s' "$1" | awk '
    # 語と区切りを出す。quiet のとき（置換の終わりを探すための走査）は何も出さない
    function emit() { if (inword) { if (!quiet) { gsub(/\n/, " ", word); outbuf = outbuf "W\t" word "\n" } word = ""; inword = 0 } }
    function sep() { emit(); if (!quiet) outbuf = outbuf "S\n" }
    function flush() { if (!quiet && outbuf != "") { printf "%s", outbuf; outbuf = "" } }
    # "$(" の "(" の位置 p から、対応する ")" の位置を返す（無ければ 0）。本体を同じ字句解析で
    # 走査するので、引用符・エスケープ・コメント・heredoc・入れ子の置換の中の括弧は数えない
    function close_paren(s, p, n,    sv_mode, sv_depth, sv_word, sv_inword, sv_nh, sv_quiet, k, hd, hq, hs, hp, j) {
      # 入れ子が深すぎる入力は検査しきれない（awk の再帰の深さと処理量を抑える）
      if (nest >= MAX_NEST) { overflow = 1; return 0 }
      nest++
      sv_mode = mode; sv_depth = depth; sv_word = word; sv_inword = inword; sv_nh = nh; sv_quiet = quiet
      for (k = 1; k <= nh; k++) { hd[k] = hdelim[k]; hq[k] = hquoted[k]; hs[k] = hstrip[k]; hp[k] = hpos[k] }
      quiet = 1
      j = lex(s, p + 1, n, 1)
      mode = sv_mode; depth = sv_depth; word = sv_word; inword = sv_inword; nh = sv_nh; quiet = sv_quiet
      for (k = 1; k <= nh; k++) { hdelim[k] = hd[k]; hquoted[k] = hq[k]; hstrip[k] = hs[k]; hpos[k] = hp[k] }
      nest--
      return j
    }
    # バッククォートの位置 i から、閉じるバッククォートの位置を返す（無ければ 0）
    function close_tick(s, i, n) {
      for (i = i + 1; i <= n; i++) {
        if (substr(s, i, 1) == "\\") { i++; continue }
        if (substr(s, i, 1) == "`") return i
      }
      return 0
    }
    # 置換（i が "$(" か "`"）。本体は後で別のコマンド列として解析する（deferred）。外側の語には
    # 置換の原文を置き、外側のコマンドを途切れさせない（置換の後ろの語も同じコマンドの引数になる）
    function subst(s, i, n, j, open) {
      if (j == 0) j = n + 1
      if (!quiet) { nd++; deferred[nd] = substr(s, i + open, j - i - open) }
      word = word substr(s, i, j - i + 1); inword = 1
      return j
    }
    # 引用符なしの heredoc の本文: エスケープされていない $( ) とバッククォートの本体を deferred にする
    function collect(t,    n, i, c, j) {
      if (quiet) return
      n = length(t)
      for (i = 1; i <= n; i++) {
        c = substr(t, i, 1)
        if (c == "\\") { i++; continue }
        if (c == "$" && substr(t, i + 1, 1) == "(") {
          j = close_paren(t, i + 1, n); if (j == 0) j = n + 1
          nd++; deferred[nd] = substr(t, i + 2, j - i - 2); i = j; continue
        }
        if (c == "`") {
          j = close_tick(t, i, n); if (j == 0) j = n + 1
          nd++; deferred[nd] = substr(t, i + 1, j - i - 1); i = j; continue
        }
      }
    }
    # 引用符の外の ${ ... }。中の引用符・エスケープ・置換を扱い、対応する "}" の位置を返す
    function brace(s, i, n,    d, c, nx, q) {
      d = 0; q = ""
      for (; i <= n; i++) {
        c = substr(s, i, 1); nx = substr(s, i + 1, 1)
        if (q == "\047") { word = word c; if (c == "\047") q = ""; continue }
        if (c == "\\") { word = word c nx; i++; continue }
        if (c == "$" && nx == "(") { i = subst(s, i, n, close_paren(s, i + 1, n), 2); continue }
        if (c == "`") { i = subst(s, i, n, close_tick(s, i, n), 1); continue }
        if (q == "\"") { word = word c; if (c == "\"") q = ""; continue }
        if (c == "\047" || c == "\"") { q = c; word = word c; continue }
        word = word c
        if (c == "{") d++
        else if (c == "}") { d--; if (d == 0) return i }
      }
      return n
    }
    # s の start 番目から字句解析する。stopclose なら、深さ 0 の ")" の位置を返す（置換の終わり）
    function lex(s, start, n, stopclose,    i, c, nx, k, d, q, strip, j, line, t, body) {
      mode = "N"; depth = 0; word = ""; inword = 0; nh = 0
      for (i = start; i <= n; i++) {
        if (overflow) return 0
        if (++work > MAX_WORK) { overflow = 1; return 0 }
        c = substr(s, i, 1); nx = substr(s, i + 1, 1)
        if (mode == "S") { if (c == "\047") mode = "N"; else word = word c; continue }
        if (mode == "D") {
          if (c == "\"") { mode = "N"; continue }
          if (c == "\\" && index("$`\"\\\n", nx) > 0) { word = word nx; i++; continue }
          if (c == "$" && nx == "(") { i = subst(s, i, n, close_paren(s, i + 1, n), 2); continue }
          if (c == "`") { i = subst(s, i, n, close_tick(s, i, n), 1); continue }
          word = word c; continue
        }
        # mode N
        if (c == " " || c == "\t") { emit(); continue }
        if (c == "\n") {
          sep()
          for (k = 1; k <= nh; k++) {
            body = ""
            while (i < n) {
              j = index(substr(s, i + 1), "\n")
              if (j == 0) { line = substr(s, i + 1); i = n } else { line = substr(s, i + 1, j - 1); i = i + j }
              t = line; if (hstrip[k]) sub(/^\t+/, "", t)
              if (t == hdelim[k]) break
              body = body line "\n"
            }
            if (!hquoted[k]) collect(body)
            hbody[k] = body
          }
          # 本文を、区切り語を読んだ位置に後ろから差し込む（前の位置がずれないように）
          if (!quiet) {
            for (k = nh; k >= 1; k--) {
              t = hbody[k]; gsub(/\n/, "\037", t)
              outbuf = substr(outbuf, 1, hpos[k]) "H\t" t "\n" substr(outbuf, hpos[k] + 1)
            }
          }
          nh = 0
          flush()
          continue
        }
        if (c == "#" && !inword) { while (i < n && substr(s, i + 1, 1) != "\n") i++; continue }
        if (c == "\\") { if (nx == "\n") { i++; continue } word = word nx; inword = 1; i++; continue }
        if (c == "\047") { mode = "S"; inword = 1; continue }
        if (c == "\"") { mode = "D"; inword = 1; continue }
        if (c == "`") { i = subst(s, i, n, close_tick(s, i, n), 1); continue }
        if (c == "$" && nx == "(") { i = subst(s, i, n, close_paren(s, i + 1, n), 2); continue }
        if (c == "$" && nx == "{") { i = brace(s, i, n); inword = 1; continue }
        if (c == ";" || c == "&" || c == "|") { sep(); continue }
        if (c == "(") { depth++; sep(); continue }
        if (c == ")") {
          if (depth > 0) { depth--; sep(); continue }
          if (stopclose) { emit(); return i }
          sep(); continue
        }
        if (c == "<" && nx == "<" && substr(s, i + 2, 1) != "<") {
          emit(); i += 2; strip = 0
          if (substr(s, i, 1) == "-") { strip = 1; i++ }
          while (substr(s, i, 1) == " " || substr(s, i, 1) == "\t") i++
          d = ""; q = 0; t = ""
          for (; i <= n; i++) {
            c = substr(s, i, 1)
            if (t != "") {
              # ダブルクォートの中では、$ ` " \\ の前のバックスラッシュを外し、バックスラッシュと改行の組は消す
              if (t == "\"" && c == "\\") {
                nx = substr(s, i + 1, 1)
                if (nx == "\n") { i++; continue }
                if (index("$`\"\\", nx) > 0) { d = d nx; i++; continue }
                d = d c; continue
              }
              if (c == t) t = ""; else d = d c; continue
            }
            if (c == "\047" || c == "\"") { t = c; q = 1; continue }
            if (c == "\\") { q = 1; i++; d = d substr(s, i, 1); continue }
            if (c == " " || c == "\t" || c == "\n" || c == ";" || c == "&" || c == "|" || c == "<" || c == ">" || c == ")") break
            d = d c
          }
          i--
          if (d != "") { nh++; hdelim[nh] = d; hquoted[nh] = q; hstrip[nh] = strip; hpos[nh] = length(outbuf) }
          continue
        }
        if (c == "<" || c == ">") { emit(); continue }
        word = word c; inword = 1
      }
      sep()
      flush()
      return 0
    }
    { text = (NR == 1) ? $0 : text "\n" $0 }
    END {
      nd = 0; quiet = 0; nest = 0; work = 0; overflow = 0; outbuf = ""
      MAX_NEST = 32; MAX_WORK = 2000000
      lex(text, 1, length(text), 0)
      for (m = 1; m <= nd && !overflow; m++) lex(deferred[m], 1, length(deferred[m]), 0)
      if (overflow) exit 3
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
  # このコマンドに heredoc で渡した本文（check_text が用意する）。入れ子の検査で上書きされる前に写す
  local -a bodies=(${HEREDOCS[@]+"${HEREDOCS[@]}"})
  local arg next script body
  case "$cmd" in
    rm) check_rm "${args[@]+"${args[@]}"}" ;;
    git) check_git "${args[@]+"${args[@]}"}" ;;
    psql|mysql|mariadb|sqlite3|sqlcmd)
      # 引数の SQL と、heredoc で渡した SQL の両方を見る
      check_sql "${args[*]+"${args[*]}"}"
      for body in ${bodies[@]+"${bodies[@]}"}; do check_sql "$body"; done ;;
    eval) check_text "${args[*]+"${args[*]}"}" "$((depth + 1))" ;;
    bash|sh|zsh|dash|ksh)
      # -c、-lc、-ec など c を含むオプションの次の語が、実行する文字列。-c もスクリプトのファイルも無ければ、
      # heredoc で渡した本文をスクリプトとして実行する
      next=0
      script=0
      for arg in "${args[@]+"${args[@]}"}"; do
        if [ "$next" -eq 1 ]; then
          check_text "$arg" "$((depth + 1))"
          break
        fi
        case "$arg" in
          --*) ;;
          -*c*) next=1 ;;
          -*) ;;
          *) script=1 ;;
        esac
      done
      if [ "$next" -eq 0 ] && [ "$script" -eq 0 ]; then
        for body in ${bodies[@]+"${bodies[@]}"}; do check_text "$body" "$((depth + 1))"; done
      fi ;;
  esac
  return 0
}

# 文字列を字句解析し、各コマンドを判定する。引数: 文字列 深さ
check_text() {
  local text="$1" depth="$2" line
  [ "$depth" -le "$MAX_DEPTH" ] || return 0
  local -a seg=()
  local lexed
  if ! lexed=$(lex_commands "$text"); then
    add_ask "コマンドを字句解析しきれませんでした（置換の入れ子が深すぎるか、解析の上限を超えた）"
    return 0
  fi
  # heredoc やヒアストリングは古い bash で一時ファイルを作り、作れない環境では検査を飛ばしてしまうので、
  # 改行だけで分けた配列にして回す（glob の展開は止める）
  local -a lines=()
  local old_ifs="$IFS" noglob=0
  case $- in *f*) noglob=1 ;; esac
  set -f
  IFS='
'
  # shellcheck disable=SC2206 # 改行だけで分け、glob は set -f で止めている
  lines=($lexed)
  IFS="$old_ifs"
  [ "$noglob" -eq 1 ] || set +f
  # HEREDOCS は、今のコマンドに渡す heredoc の本文（check_words が読む）
  local -a HEREDOCS=()
  local body
  for line in ${lines[@]+"${lines[@]}"}; do
    case "$line" in
      S)
        [ "${#seg[@]}" -gt 0 ] && check_words "$depth" "${seg[@]}"
        seg=()
        HEREDOCS=() ;;
      H"$TAB"*)
        body="${line#H"$TAB"}"
        HEREDOCS+=("${body//$US/$NL}") ;;
      *) seg+=("${line#W"$TAB"}") ;;
    esac
  done
  [ "${#seg[@]}" -gt 0 ] && check_words "$depth" "${seg[@]}"
  return 0
}

MAX_COMMAND_CHARS=65536
if [ "${#CMD}" -gt "$MAX_COMMAND_CHARS" ]; then
  add_ask "コマンドが大きすぎて検査できません（${#CMD} 文字。上限 ${MAX_COMMAND_CHARS}）"
else
  check_text "$CMD" 0
fi

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
