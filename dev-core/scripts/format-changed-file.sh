#!/usr/bin/env bash
# PostToolUse(Write|Edit) フック: 編集されたファイルを Prettier で自動フォーマットする。
# プロジェクトに Prettier が設定されている場合のみ実行する
# （未設定のプロジェクトで npx が勝手に prettier をダウンロードするのを防ぐ）。
# フォーマット失敗はメインフローを止めない（常に exit 0）。
set -u

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

# 対象拡張子のみ
printf '%s' "$FILE" | grep -qE '\.(ts|tsx|js|jsx|json|css|md|vue|php)$' || exit 0

# プロジェクトに Prettier 設定があるか確認（カレント = プロジェクトルート前提）
has_prettier=false
for cfg in .prettierrc .prettierrc.json .prettierrc.js .prettierrc.cjs .prettierrc.mjs .prettierrc.yaml .prettierrc.yml prettier.config.js prettier.config.cjs prettier.config.mjs; do
  [ -f "$cfg" ] && has_prettier=true && break
done
if [ "$has_prettier" = false ] && [ -f package.json ]; then
  grep -q '"prettier"' package.json && has_prettier=true
fi

[ "$has_prettier" = true ] || exit 0

npx --no-install prettier --write "$FILE" >/dev/null 2>&1
exit 0
