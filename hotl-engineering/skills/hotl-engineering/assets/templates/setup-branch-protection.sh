#!/usr/bin/env bash
# =============================================================================
# setup-branch-protection.sh — main の ruleset を一括設定(Phase 2 で実行)
#
# 設定内容(J-SOX 変更管理統制の技術的実装):
#   - main への直 push / force push / 削除の禁止
#   - PR 必須 + 承認1名以上 + Code Owners レビュー必須(Tier 2 パス)
#   - 新コミットで既存承認を無効化(承認後のすり替え防止)
#   - required status checks: quality-gate(CI 5層の集約)
#     ※ Phase 2 後半で "ai-review" を、エージェント系リポジトリでは "eval" を追加
#
# 前提: gh CLI 認証済み、対象リポジトリの admin 権限
# 使い方: ./setup-branch-protection.sh <owner>/<repo>
# =============================================================================
set -euo pipefail

REPO="${1:?usage: $0 <owner>/<repo>}"

gh api "repos/${REPO}/rulesets" --method POST --input - <<'JSON'
{
  "name": "main-protection (HOTL)",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "automatic_copilot_code_review_enabled": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "quality-gate" }
        ]
      }
    }
  ],
  "bypass_actors": []
}
JSON

echo "✅ ruleset created for ${REPO}"
echo ""
echo "次にやること:"
echo "  1. Phase 2 後半: required_status_checks に 'ai-review' を追加"
echo "     (エージェント系リポジトリは 'eval' も追加)"
echo "  2. Settings > Environments > production に Required reviewers を設定(CP3)"
echo "  3. .github/CODEOWNERS.sample を CODEOWNERS にリネームして有効化"
echo "  4. bypass_actors は空のまま維持すること(緊急時は ruleset を一時無効化し、"
echo "     その操作ログ自体を監査証跡として残す運用にする)"
