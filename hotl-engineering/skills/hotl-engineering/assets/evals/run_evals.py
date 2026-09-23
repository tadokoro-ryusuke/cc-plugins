#!/usr/bin/env python3
"""
run_evals.py — 検索QAエージェント eval ハーネス

L1: 決定的チェック(recall@5, MRR, must_not, refusal)
L2: LLM-as-judge(Bedrock 東京 / temperature 0 ※受け付けるモデルのみ / 3票中央値)
ゲート判定: thresholds.json + baseline 比較 → exit code

使い方:
    python evals/run_evals.py \
        --dataset evals/golden/golden.sample.jsonl \
        --suite smoke --thresholds evals/thresholds.json \
        --baseline evals/baseline.json --out evals/out

環境変数:
    TARGET_ENDPOINT  評価対象(staging)のベースURL
    TARGET_API_KEY   同 API キー
    JUDGE_MODEL      Bedrock inference profile ID(既定: Sonnet 東京)
    AWS_REGION       ap-northeast-1
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from anthropic import AnthropicBedrock

JUDGE_MODEL = os.environ.get(
    "JUDGE_MODEL", "apac.anthropic.claude-sonnet-4-5-20250929-v1:0"
)
RUBRIC_PATH = Path(__file__).parent / "judge_rubric.md"
AXES = ("correctness", "faithfulness", "completeness")

# temperature を受け付ける judge モデル系列の許可リスト(Claude 3 系 / Haiku 4.5 /
# Sonnet・Opus 4.6 以前)。Opus 4.7 以降・Sonnet 5 以降などは temperature を送ると
# 400 になるため、一致しない(未知・新しい)モデルには送らない。
# max_tokens は Messages API の必須項目なので常に送る
_SAMPLING_MODEL_RE = re.compile(
    r"claude-(?:3-|haiku-4-5|(?:sonnet|opus)-4-(?:[0-6](?![0-9])|[0-9]{8}))"
)


def judge_accepts_sampling(model: str) -> bool:
    return _SAMPLING_MODEL_RE.search(model) is not None


# ---------------------------------------------------------------------------
# 対象システム呼び出し(インターフェースが違う場合はここだけ差し替える)
# ---------------------------------------------------------------------------
def call_target(query: str, user_context: dict) -> dict:
    """評価対象 API を呼ぶ。戻り: {"answer": str, "retrieved_docs": [{"doc_id":..}]}"""
    endpoint = os.environ["TARGET_ENDPOINT"].rstrip("/") + "/query"
    payload = json.dumps(
        {"query": query, "user_id": user_context.get("user_id")}
    ).encode()
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ.get('TARGET_API_KEY', '')}",
        },
        method="POST",
    )
    for attempt in range(3):  # 一時障害へのリトライ
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read())
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            print(f"  retry ({e})", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


# ---------------------------------------------------------------------------
# L1: 決定的チェック
# ---------------------------------------------------------------------------
@dataclass
class L1Result:
    recall_at_5: float | None
    mrr: float | None
    must_not_violations: list[str] = field(default_factory=list)
    refusal_expected: bool = False
    hard_fail: bool = False
    hard_fail_reason: str = ""


def eval_l1(case: dict, response: dict) -> L1Result:
    retrieved = [d.get("doc_id") for d in response.get("retrieved_docs", [])]
    expected = case.get("expected_doc_ids") or []
    answer = response.get("answer", "")

    # recall@5 / MRR(expected が空 = no-answer/permission 系は対象外)
    recall = mrr = None
    if expected:
        top5 = retrieved[:5]
        recall = sum(1 for d in expected if d in top5) / len(expected)
        ranks = [retrieved.index(d) + 1 for d in expected if d in retrieved]
        mrr = (1.0 / min(ranks)) if ranks else 0.0

    # must_not: 回答と検索結果の両方を検査(権限漏れは検索結果に出た時点でNG)
    violations = []
    haystack = answer + "\n" + "\n".join(map(str, retrieved))
    for pattern in case.get("must_not_include") or []:
        if re.search(pattern, haystack):
            violations.append(pattern)

    res = L1Result(recall_at_5=recall, mrr=mrr, must_not_violations=violations)
    if violations:
        res.hard_fail = True
        res.hard_fail_reason = f"must_not violation: {violations}"
    return res


# ---------------------------------------------------------------------------
# L2: LLM-as-judge(3票中央値)
# ---------------------------------------------------------------------------
def make_judge_prompt(case: dict, response: dict, rubric: str) -> str:
    docs = json.dumps(response.get("retrieved_docs", []), ensure_ascii=False)[:8000]
    return f"""あなたは検索型QAシステムの評価者です。以下のルーブリックに厳密に従い採点してください。

<rubric>
{rubric}
</rubric>

<case category="{case['category']}">
<query>{case['query']}</query>
<must_include_facts>{json.dumps(case.get('must_include_facts') or [], ensure_ascii=False)}</must_include_facts>
<reference_answer>{case.get('reference_answer') or '(なし)'}</reference_answer>
</case>

<retrieved_docs>{docs}</retrieved_docs>

<answer_under_evaluation>
{response.get('answer', '')}
</answer_under_evaluation>

ルーブリック指定の JSON のみを出力してください。"""


def eval_l2(
    client: AnthropicBedrock, case: dict, response: dict, rubric: str, cfg: dict
) -> dict:
    prompt = make_judge_prompt(case, response, rubric)
    votes: list[dict] = []
    vote_count = cfg.get("votes", 3)
    if type(vote_count) is not int or vote_count < 1:
        raise ValueError("judge votes must be a positive integer")
    params: dict = {
        "model": JUDGE_MODEL,
        "max_tokens": int(cfg.get("max_tokens", 1024)),
        "messages": [{"role": "user", "content": prompt}],
    }
    # temperature は cfg にあり、かつ judge モデルが受け付ける場合だけ送る
    if "temperature" in cfg and judge_accepts_sampling(JUDGE_MODEL):
        params["temperature"] = float(cfg["temperature"])
    for _ in range(vote_count):
        try:
            msg = client.messages.create(**params)
        except Exception as e:  # noqa: BLE001 — judge 1票の失敗で suite 全体を止めない
            print(f"  judge vote failed ({type(e).__name__})", file=sys.stderr)
            continue
        text = "".join(b.text for b in msg.content if b.type == "text")
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            continue
        try:
            vote = json.loads(m.group(0))
            if not isinstance(vote, dict):
                continue
            if not all(isinstance(vote.get(axis), dict)
                       and type(vote[axis].get("score")) is int
                       and 1 <= vote[axis]["score"] <= 5 for axis in AXES):
                continue
            votes.append(vote)
        except json.JSONDecodeError:
            continue

    # 票の欠落・不正を品質スコア(0点)に化けさせない。呼び出し側でインフラ失敗として扱う
    if len(votes) != vote_count:
        raise ValueError("incomplete or invalid judge votes")

    result = {}
    for axis in AXES:
        scores = [int(v.get(axis, {}).get("score", 0)) for v in votes]
        med = statistics.median(scores)
        reasons = [v.get(axis, {}).get("reason", "") for v in votes]
        result[axis] = {"score": med, "reason": reasons[0], "votes": scores}
    return result


# ---------------------------------------------------------------------------
# ゲート判定
# ---------------------------------------------------------------------------
def gate(summary: dict, thresholds: dict, baseline: dict | None) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if summary["n_cases"] == 0:
        failures.append("対象ケースが0件")
    if summary["infrastructure_failed_ids"]:
        failures.append(f"評価が未完了(target/judge エラー): {summary['infrastructure_failed_ids']}")

    if summary["must_pass_rate"] < thresholds["must_pass_rate"]:
        failures.append(
            f"must-pass ケース不合格: {summary['must_pass_failed_ids']}"
        )
    if summary["must_not_violations"] > thresholds["must_not_violations"]:
        failures.append(f"must_not violation {summary['must_not_violations']} 件")
    if summary["judge_total_mean"] < thresholds["judge_total_floor"]:
        failures.append(
            f"judge 平均 {summary['judge_total_mean']:.2f} < 絶対下限 {thresholds['judge_total_floor']}"
        )

    if baseline:
        b_recall = baseline.get("recall_at_5_mean")
        b_judge = baseline.get("judge_total_mean")
        if (
            b_recall is not None
            and summary["recall_at_5_mean"] is not None
            and summary["recall_at_5_mean"] < b_recall - thresholds["recall_at_5_drop_allowed"]
        ):
            failures.append(
                f"recall@5 回帰: {summary['recall_at_5_mean']:.3f} < baseline {b_recall:.3f} - {thresholds['recall_at_5_drop_allowed']}"
            )
        if b_judge is not None and summary["judge_total_mean"] < b_judge - thresholds["judge_total_drop_allowed"]:
            failures.append(
                f"judge 回帰: {summary['judge_total_mean']:.2f} < baseline {b_judge:.2f} - {thresholds['judge_total_drop_allowed']}"
            )
    return (len(failures) == 0), failures


# ---------------------------------------------------------------------------
# レポート生成(CP4 で人間が読むもの)
# ---------------------------------------------------------------------------
def write_report(out: Path, summary: dict, results: list[dict], ok: bool, failures: list[str], baseline: dict | None) -> None:
    lines = [
        f"## Eval レポート — {'✅ PASS' if ok else '❌ FAIL'}",
        "",
        f"- suite: `{summary['suite']}` / cases: {summary['n_cases']} / judge: `{JUDGE_MODEL}`",
        f"- must-pass: {summary['must_pass_rate']:.0%}  |  must_not violation: {summary['must_not_violations']} 件",
        f"- recall@5 平均: {fmt(summary['recall_at_5_mean'])}"
        + (f"(baseline {fmt(baseline.get('recall_at_5_mean'))})" if baseline else ""),
        f"- judge 総合平均: {summary['judge_total_mean']:.2f} / 15"
        + (f"(baseline {baseline.get('judge_total_mean', 0):.2f})" if baseline else ""),
        "",
    ]
    if failures:
        lines += ["### ゲート不合格の理由", *[f"- {f}" for f in failures], ""]

    fails = [r for r in results if r["failed"]]
    if fails:
        lines.append("### 失敗ケース(人間が見るべき差分)")
        lines.append("| id | category | 理由 | judge (c/f/cp) |")
        lines.append("|---|---|---|---|")
        for r in fails:
            j = r.get("judge") or {}
            js = "/".join(str(j.get(a, {}).get("score", "-")) for a in AXES)
            lines.append(
                f"| {r['id']} | {r['category']} | {r['fail_reason'][:80]} | {js} |"
            )
        lines.append("")
    lines.append(
        "> 判定基準: evals/thresholds.json / 採点基準: evals/judge_rubric.md"
    )
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")


def fmt(v):
    return f"{v:.3f}" if isinstance(v, (int, float)) else "n/a"


# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--suite", choices=["smoke", "full"], default="smoke")
    ap.add_argument("--thresholds", required=True)
    ap.add_argument("--baseline", default=None)
    ap.add_argument("--out", default="evals/out")
    ap.add_argument("--expected-revision", help="対象の全レスポンスがこのデプロイ済み revision を示すことを要求する")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    all_thresholds = json.loads(Path(args.thresholds).read_text())
    thresholds = all_thresholds[args.suite]
    judge_cfg = all_thresholds.get("judge", {})
    rubric = RUBRIC_PATH.read_text(encoding="utf-8")

    # --baseline を明示したのにファイルが無い・壊れている場合は比較を黙って無効化しない
    baseline = None
    if args.baseline:
        baseline = json.loads(Path(args.baseline).read_text())["summary"]
        if not isinstance(baseline, dict) or not baseline:
            raise ValueError("baseline summary is missing or invalid")

    cases = [
        json.loads(line)
        for line in Path(args.dataset).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    cases = [c for c in cases if args.suite in c.get("suite", ["full"])]
    print(f"suite={args.suite}, cases={len(cases)}")

    client = AnthropicBedrock(
        aws_region=os.environ.get("AWS_REGION", "ap-northeast-1")
    )

    results: list[dict] = []
    for case in cases:
        print(f"[{case['id']}]")
        row: dict = {"id": case["id"], "category": case["category"],
                     "must_pass": case.get("must_pass", False),
                     "failed": False, "fail_reason": ""}
        try:
            response = call_target(case["query"], case.get("user_context") or {})
            if args.expected_revision and response.get("revision") != args.expected_revision:
                raise ValueError("target revision mismatch")
        except Exception as e:  # noqa: BLE001
            row.update(failed=True, infrastructure_error=True,
                       fail_reason=f"target error or revision mismatch: {type(e).__name__}")
            results.append(row)
            continue

        l1 = eval_l1(case, response)
        row.update(recall_at_5=l1.recall_at_5, mrr=l1.mrr,
                   must_not_violations=l1.must_not_violations)
        if l1.hard_fail:
            row.update(failed=True, fail_reason=l1.hard_fail_reason)
            results.append(row)
            continue  # L1 hard fail に judge コストは使わない

        try:
            judge = eval_l2(client, case, response, rubric, judge_cfg)
        except Exception as e:  # noqa: BLE001 — 未完了の実行でもレポートを残す
            row.update(failed=True, infrastructure_error=True,
                       fail_reason=f"judge error: {type(e).__name__}")
            results.append(row)
            continue
        total = sum(judge[a]["score"] for a in AXES)
        row.update(judge=judge, judge_total=total)

        # ケース単位の合否: must_pass は judge 全軸 4 以上を要求
        if case.get("must_pass") and any(judge[a]["score"] < 4 for a in AXES):
            row.update(failed=True,
                       fail_reason=f"must-pass case below bar (total={total})")
        elif total < 8:  # 明白な品質不良は個別 fail として可視化
            row.update(failed=True, fail_reason=f"low judge total ({total})")
        results.append(row)

    # --- 集計 ---
    recalls = [r["recall_at_5"] for r in results if r.get("recall_at_5") is not None]
    totals = [r["judge_total"] for r in results if "judge_total" in r]
    mp = [r for r in results if r["must_pass"]]
    mp_failed = [r["id"] for r in mp if r["failed"]]
    summary = {
        "suite": args.suite,
        "n_cases": len(results),
        "expected_revision": args.expected_revision,
        "infrastructure_failed_ids": [r["id"] for r in results if r.get("infrastructure_error")],
        "recall_at_5_mean": statistics.mean(recalls) if recalls else None,
        "judge_total_mean": statistics.mean(totals) if totals else 0.0,
        "must_pass_rate": 1.0 - (len(mp_failed) / len(mp)) if mp else 1.0,
        "must_pass_failed_ids": mp_failed,
        "must_not_violations": sum(len(r.get("must_not_violations") or []) for r in results),
    }

    ok, failures = gate(summary, thresholds, baseline)
    (out / "results.json").write_text(
        json.dumps({"summary": summary, "results": results},
                   ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    write_report(out, summary, results, ok, failures, baseline)
    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    print("GATE:", "PASS ✅" if ok else f"FAIL ❌ {failures}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
