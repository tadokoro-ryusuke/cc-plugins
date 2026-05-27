#!/usr/bin/env bash
#
# setup-shared-skills.sh
#
# dev-core が配布するスキル（SSoT）を、利用者プロジェクトの Codex repo-local
# skill discovery 経路（.agents/skills/<skill>）から参照できるように
# relative symlink を作成する（経路B）。
#
# 設計（契約）:
#   - SSoT は dev-core/skills/<skill>（このリポジトリ/プラグインが配布する実体）。
#     .agents/skills 側は実体を複製・コピーしない。常に SSoT を指す symlink にする。
#   - 各スキルについて <project>/.agents/skills/<skill> を SSoT への
#     relative symlink として作成する。
#   - SSoT の場所はハードコーディングせず、第1引数または環境変数 SHARED_SKILLS_SSOT
#     で受け取る。未指定時はスクリプト自身の位置からの相対デフォルトを使う。
#   - --dry-run: 実際には作らず、実行する `ln -s` 相当の内容を表示する。
#   - 冪等性: 既存の .agents/skills/<skill> が既に正しい SSoT を指す symlink なら no-op。
#     違う先を指していれば警告して skip する（破壊しない）。
#   - symlink 作成に失敗した場合（Windows で Developer Mode/管理者権限が無い等）は
#     @AGENTS.md import 方式へのフォールバックを案内する。
#
# 使い方:
#   利用者プロジェクトのルートで実行する想定。
#     bash setup-shared-skills.sh [SSOT_DIR] [--dry-run]
#     SHARED_SKILLS_SSOT=/path/to/dev-core/skills bash setup-shared-skills.sh --dry-run
#
set -euo pipefail

# ---- 定数 ------------------------------------------------------------------

# Codex の repo-local skill discovery が走査する現行パス（複数形）。ハードコードはここ1箇所のみ。
readonly SHARED_SKILLS_DIRNAME=".agents/skills"

# 環境変数で SSoT を上書きできるようにする（未設定なら空）。
readonly SSOT_FROM_ENV="${SHARED_SKILLS_SSOT:-}"

# ---- 引数パース ------------------------------------------------------------

DRY_RUN=0
SSOT_FROM_ARG=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    -h | --help)
      cat <<'USAGE'
Usage: setup-shared-skills.sh [SSOT_DIR] [--dry-run]

  SSOT_DIR    dev-core/skills の場所（SSoT）。省略時は環境変数 SHARED_SKILLS_SSOT、
              それも無ければスクリプト位置からの相対デフォルトを使う。
  --dry-run   実際には symlink を作らず、実行する ln -s 相当の内容のみ表示する。

利用者プロジェクトのルートで実行すると、各スキルについて
<project>/.agents/skills/<skill> を SSoT への relative symlink として作成する。
USAGE
      exit 0
      ;;
    -*)
      echo "error: 未知のオプション: $arg" >&2
      exit 2
      ;;
    *)
      if [ -n "$SSOT_FROM_ARG" ]; then
        echo "error: SSOT_DIR は1つだけ指定できる（重複: $arg）" >&2
        exit 2
      fi
      SSOT_FROM_ARG="$arg"
      ;;
  esac
done

# ---- SSoT の解決 -----------------------------------------------------------

# スクリプト自身の絶対ディレクトリ。デフォルト SSoT の起点に使う。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_SKILLS_DOC="${SCRIPT_DIR}/../docs/codex-interop/shared-skills-setup.md"

# 優先順位: 引数 > 環境変数 > スクリプト位置からの相対デフォルト。
if [ -n "$SSOT_FROM_ARG" ]; then
  ssot_raw="$SSOT_FROM_ARG"
elif [ -n "$SSOT_FROM_ENV" ]; then
  ssot_raw="$SSOT_FROM_ENV"
else
  # このスクリプトは <repo>/scripts/ にあり、SSoT は <repo>/dev-core/skills。
  ssot_raw="${SCRIPT_DIR}/../dev-core/skills"
fi

if [ ! -d "$ssot_raw" ]; then
  echo "error: SSoT ディレクトリが見つからない: $ssot_raw" >&2
  echo "       第1引数または環境変数 SHARED_SKILLS_SSOT で dev-core/skills の場所を指定してください。" >&2
  exit 1
fi

# SSoT を絶対パスに正規化（relative symlink 計算の基準）。
SSOT_DIR="$(cd "$ssot_raw" && pwd)"

# symlink を張る先（利用者プロジェクトのルート = カレントディレクトリ）。
PROJECT_ROOT="$(pwd)"
TARGET_BASE="${PROJECT_ROOT}/${SHARED_SKILLS_DIRNAME}"

echo "SSoT (skills 実体): $SSOT_DIR"
echo "リンク作成先      : $TARGET_BASE/<skill>"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "(dry-run: 実際には作成しません)"
fi
echo ""

# ---- フォールバック案内 ----------------------------------------------------

# symlink が使えない環境向けの案内を出力する。
print_symlink_fallback() {
  cat >&2 <<FALLBACK

----------------------------------------------------------------------
symlink を作成できませんでした（Windows で Developer Mode/管理者権限が
無い等、symlink 不可の環境の可能性があります）。

フォールバック: @AGENTS.md import 方式を使ってください。
  利用者プロジェクトの CLAUDE.md / AGENTS.md から dev-core の AGENTS.md を
  import することで、symlink 無しでも知識インデックスを共有できます。
  詳細は次のドキュメントの「Windows フォールバック」を参照してください。
  ${SHARED_SKILLS_DOC}
----------------------------------------------------------------------
FALLBACK
}

# ---- 相対パス計算 ----------------------------------------------------------

# from（リンクが置かれるディレクトリ）から to（SSoT 内のスキル実体）への相対パスを返す。
# realpath --relative-to があれば使い、無ければ Python3 でフォールバックする。
compute_relative_path() {
  local from="$1"
  local to="$2"
  if realpath --relative-to="$from" "$to" 2>/dev/null; then
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import os,sys; print(os.path.relpath(sys.argv[2], sys.argv[1]))' "$from" "$to"
    return 0
  fi
  # 最後の手段: 絶対パスをそのまま返す（relative ではないが動作はする）。
  echo "$to"
}

# ---- メイン処理 ------------------------------------------------------------

created=0
skipped=0
warned=0

# SSoT 直下の各スキルディレクトリについて symlink を張る。
for skill_path in "$SSOT_DIR"/*/; do
  [ -d "$skill_path" ] || continue
  skill_name="$(basename "$skill_path")"

  link_path="${TARGET_BASE}/${skill_name}"
  # link が置かれる親ディレクトリから SSoT のスキル実体への relative パス。
  rel_target="$(compute_relative_path "$TARGET_BASE" "${SSOT_DIR}/${skill_name}")"

  # 冪等性チェック: 既存 symlink が正しい SSoT を指していれば no-op。
  # readlink -f でリンクの最終解決先（絶対パス）を求め、SSoT のスキル実体と比較する。
  if [ -L "$link_path" ]; then
    current_target="$(readlink "$link_path")"
    resolved_current="$(readlink -f "$link_path" 2>/dev/null || true)"
    expected_target="${SSOT_DIR}/${skill_name}"
    if [ -n "$resolved_current" ] && [ "$resolved_current" = "$expected_target" ]; then
      echo "ok   : ${SHARED_SKILLS_DIRNAME}/${skill_name} は既に正しい SSoT を指しています（no-op）"
      skipped=$((skipped + 1))
      continue
    fi
    echo "warn : ${SHARED_SKILLS_DIRNAME}/${skill_name} は別の先を指しています（現在: ${current_target}）。手動で確認してください。skip します。" >&2
    warned=$((warned + 1))
    continue
  fi

  if [ -e "$link_path" ]; then
    echo "warn : ${SHARED_SKILLS_DIRNAME}/${skill_name} は symlink でない実体が存在します。skip します。" >&2
    warned=$((warned + 1))
    continue
  fi

  echo "link : ${SHARED_SKILLS_DIRNAME}/${skill_name} -> ${rel_target}"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "       (dry-run) ln -sfn \"${rel_target}\" \"${link_path}\""
    created=$((created + 1))
    continue
  fi

  # 親ディレクトリを用意してから relative symlink を作成する。
  mkdir -p "$TARGET_BASE"
  if ! ln -sfn "$rel_target" "$link_path"; then
    print_symlink_fallback
    exit 1
  fi
  created=$((created + 1))
done

echo ""
echo "完了: 作成=${created} / no-op=${skipped} / 警告=${warned}"
