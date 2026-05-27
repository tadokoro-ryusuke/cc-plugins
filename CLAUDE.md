@AGENTS.md

<!-- 知識の本体は AGENTS.md（および dev-core の各 SKILL.md）にあります。
     このファイルは Claude Code 固有の薄い補足のみを置き、知識を重複させません。 -->

# Claude Code 固有の補足

- Skills は必要時に **自動ロード**される。明示的な指定は不要。
- 破壊的操作（削除・上書き・force push 等）は実行前に確認を取る。
- 詳細な開発原則・パターンは dev-core の各 SKILL.md（`dev-core/skills/<skill>/SKILL.md`）を参照する。本ファイルに知識本体を複製しない。
