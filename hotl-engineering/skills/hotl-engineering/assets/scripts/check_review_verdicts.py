#!/usr/bin/env python3
"""必須の AI レビュー成果物(verdict)を検証する。Phase 1 はエラーを観測のみ、Phase 2 で強制する。"""

import json
import os
from pathlib import Path
import re


def main():
    errors = []
    critical = 0
    expected_sha = os.environ.get("EXPECTED_SHA", "")
    tier2 = os.environ.get("TIER2", "")
    if os.environ.get("IS_DRAFT") == "true":
        print("SKIP: draft PR のためスキップ(Ready for review 時にレビュー必須)")
        return 0
    if os.environ.get("CLASSIFY_RESULT") != "success" or tier2 not in ("true", "false"):
        errors.append("classify が未実行または失敗")
    if not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        errors.append("期待する PR revision が未設定または不正")
    tiers = [("light", "REVIEW_RESULT")]
    if tier2 == "true":
        tiers.append(("deep", "DEEP_RESULT"))
    root = Path(os.environ.get("VERDICT_DIR", "verdicts"))
    for tier, result_key in tiers:
        if os.environ.get(result_key) != "success":
            errors.append(f"{tier}: job が success でない")
        path = root / f"ai-review-verdict-{tier}" / "verdict.json"
        try:
            verdict = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(verdict, dict):
                raise ValueError("JSON オブジェクトではない")
            for field in ("critical", "high"):
                if type(verdict.get(field)) is not int or verdict[field] < 0:
                    raise ValueError(f"{field} は非負整数であること")
            if verdict.get("head_sha") != expected_sha:
                raise ValueError("verdict が PR revision と一致しない")
            critical += verdict["critical"]
        except (OSError, ValueError) as error:
            errors.append(f"{tier}: verdict が欠落または不正({type(error).__name__})")
    if critical:
        errors.append(f"CRITICAL 指摘 {critical} 件")
    enforce = os.environ.get("ENFORCE") == "true"
    if errors:
        print("INCOMPLETE/FAIL: " + "; ".join(errors))
        print("強制モード" if enforce else "観測のみ(承認エビデンスではない)")
    else:
        print(f"PASS: 必須 verdict {len(tiers)} 件を {expected_sha} について検証済み")
    return 1 if errors and enforce else 0


if __name__ == "__main__":
    raise SystemExit(main())
