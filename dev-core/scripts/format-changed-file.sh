#!/usr/bin/env bash
# PostToolUse(Write|Edit) フック: 編集されたファイルを言語ごとのフォーマッタで自動フォーマットする。
# プロジェクトに該当フォーマッタが設定・導入されている場合のみ実行する
# （未設定のプロジェクトで npx が勝手に prettier をダウンロードするのを防ぐ）。
# フォーマット失敗はメインフローを止めない（常に exit 0）。
set -u

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

case "$FILE" in
  # --- Prettier 系 (JS/TS/Web) ---
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.vue|*.php)
    has_prettier=false
    for cfg in .prettierrc .prettierrc.json .prettierrc.js .prettierrc.cjs .prettierrc.mjs .prettierrc.yaml .prettierrc.yml prettier.config.js prettier.config.cjs prettier.config.mjs; do
      [ -f "$cfg" ] && has_prettier=true && break
    done
    if [ "$has_prettier" = false ] && [ -f package.json ]; then
      grep -q '"prettier"' package.json && has_prettier=true
    fi
    [ "$has_prettier" = true ] || exit 0
    npx --no-install prettier --write "$FILE" >/dev/null 2>&1
    ;;

  # --- Rust: cargo fmt（edition を Cargo.toml から解決させる） ---
  *.rs)
    [ -f Cargo.toml ] || exit 0
    command -v cargo >/dev/null 2>&1 || exit 0
    cargo fmt -- "$FILE" >/dev/null 2>&1
    ;;

  # --- Python: ruff format（プロジェクトに ruff 設定がある場合のみ） ---
  *.py)
    has_ruff=false
    [ -f ruff.toml ] || [ -f .ruff.toml ] && has_ruff=true
    if [ "$has_ruff" = false ] && [ -f pyproject.toml ]; then
      grep -q '\[tool\.ruff' pyproject.toml && has_ruff=true
    fi
    [ "$has_ruff" = true ] || exit 0
    if [ -f uv.lock ] && command -v uv >/dev/null 2>&1; then
      uv run --no-sync ruff format "$FILE" >/dev/null 2>&1
    elif command -v ruff >/dev/null 2>&1; then
      ruff format "$FILE" >/dev/null 2>&1
    fi
    ;;

  # --- Go: gofmt（Go ツールチェーン標準・全 Go プロジェクトで安全） ---
  *.go)
    command -v gofmt >/dev/null 2>&1 || exit 0
    gofmt -w "$FILE" >/dev/null 2>&1
    ;;
esac

exit 0
