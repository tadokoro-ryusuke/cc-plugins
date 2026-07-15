#!/usr/bin/env bash

# SessionStart command hook. Stdout becomes session context, so emit only
# allowlisted metadata and never echo plan bodies, commit subjects, or commands.

set -u

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[dev-core] Repository state:"
  branch="$(git branch --show-current 2>/dev/null)"
  safe_branch="$(printf '%s' "${branch:-detached}" | LC_ALL=C tr -cd 'A-Za-z0-9._/-' | cut -c1-120)"
  echo "- branch: ${safe_branch:-detached}"
  dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "- uncommitted changes: ${dirty} file(s)"
  commit_hashes="$(git rev-list --max-count=3 --abbrev-commit HEAD 2>/dev/null | paste -sd ' ' -)"
  if [ -n "$commit_hashes" ]; then
    echo "- recent commit ids: $commit_hashes"
  fi

  plan_state="$(
    find docs/plans -maxdepth 1 -type f -name 'task-*.md' 2>/dev/null \
      | sort \
      | while IFS= read -r plan; do
          status="$(sed -n 's/^- Status:[[:space:]]*//p' "$plan" | head -1)"
          if [ "$status" = "done" ]; then
            continue
          fi
          if [ "$status" != "draft" ] && [ "$status" != "approved" ] \
            && [ "$status" != "planned" ] && [ "$status" != "in-progress" ] \
            && [ "$status" != "blocked" ]; then
            continue
          fi
          safe_plan="$(printf '%s' "$plan" | LC_ALL=C tr -cd 'A-Za-z0-9._/-' | cut -c1-160)"
          [ -n "$safe_plan" ] || continue
          printf '    %s [status: %s]\n' "$safe_plan" "$status"
        done \
      | head -10
  )"
  if [ -n "$plan_state" ]; then
    echo "- resumable plans (open the plan before /dev-core:execute):"
    echo "$plan_state"
  fi
fi

cat <<'EOF'
[dev-core] Session discipline:
- Verify current evidence before marking a completion criterion satisfied.
- Investigate facts, continue with safe reversible defaults, and escalate only material or side-effecting decisions.
- Treat subagent reports as claims until independently verified.
- Persist progress, decisions, evidence, blockers, and one next action in the active plan before stopping or compaction.
- Stop after three similar failed attempts or one no-progress cycle.
EOF
