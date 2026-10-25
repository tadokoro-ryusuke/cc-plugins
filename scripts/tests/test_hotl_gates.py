"""配布するデリバリーゲートのオフライン契約テスト。モデルや評価対象は一切呼ばない。"""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch


ASSETS = Path(__file__).resolve().parents[2] / "hotl-engineering/skills/hotl-engineering/assets"
VERDICT_GATE = ASSETS / "scripts/check_review_verdicts.py"


def load_eval_runner():
    """anthropic SDK をスタブに差し替えて run_evals.py を読み込む。"""
    fake_sdk = types.ModuleType("anthropic")
    fake_sdk.AnthropicBedrock = lambda **kwargs: None
    spec = importlib.util.spec_from_file_location("hotl_evals", ASSETS / "evals/run_evals.py")
    runner = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"anthropic": fake_sdk, "hotl_evals": runner}):
        spec.loader.exec_module(runner)
    return runner


class ReviewGateTests(unittest.TestCase):
    def run_gate(self, light, deep=None, **overrides):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for tier, verdict in (("light", light), ("deep", deep)):
                if verdict is not None:
                    folder = root / ("ai-review-verdict-" + tier)
                    folder.mkdir()
                    (folder / "verdict.json").write_text(verdict)
            env = {**os.environ, "VERDICT_DIR": directory, "ENFORCE": "true",
                   "CLASSIFY_RESULT": "success", "TIER2": "false", "IS_DRAFT": "false",
                   "REVIEW_RESULT": "success", "DEEP_RESULT": "skipped",
                   "LIGHT_DOWNLOAD": "success", "DEEP_DOWNLOAD": "success" if deep is not None else "skipped",
                   "EXPECTED_SHA": "a" * 40, **overrides}
            return subprocess.run([sys.executable, str(VERDICT_GATE)], env=env,
                                  capture_output=True, text=True, timeout=5)

    def verdict(self, **overrides):
        return json.dumps({"critical": 0, "high": 0, "head_sha": "a" * 40, **overrides})

    def test_valid_light_review_passes(self):
        result = self.run_gate(self.verdict())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_malformed_or_wrong_revision_cannot_pass(self):
        for verdict in (None, "not json", "{}", "[]", self.verdict(critical=-1),
                        self.verdict(critical=True), self.verdict(high="0"),
                        self.verdict(head_sha="b" * 40)):
            with self.subTest(verdict=verdict):
                result = self.run_gate(verdict)
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_critical_and_required_job_failures_block(self):
        for overrides in ({"CLASSIFY_RESULT": "failure"}, {"REVIEW_RESULT": "cancelled"},
                          {"TIER2": "true"}, {"TIER2": ""}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.run_gate(self.verdict(), **overrides).returncode, 1)
        self.assertEqual(self.run_gate(self.verdict(critical=1)).returncode, 1)

    def test_deep_review_requires_success_and_its_own_valid_verdict(self):
        result = self.run_gate(self.verdict(), self.verdict(), TIER2="true", DEEP_RESULT="success")
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_gate(self.verdict(), TIER2="true", DEEP_RESULT="success")
        self.assertEqual(result.returncode, 1)

    def test_failed_artifact_download_blocks_even_with_a_valid_verdict(self):
        # download-artifact v8 は展開した後に digest の不一致をエラーにする。continue-on-error の step なので、
        # ファイルが残っていても取得の結果を validator に渡して不完全な証拠として扱う
        for overrides in ({"LIGHT_DOWNLOAD": "failure"}, {"LIGHT_DOWNLOAD": ""}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.run_gate(self.verdict(), **overrides).returncode, 1)
        result = self.run_gate(self.verdict(), self.verdict(), TIER2="true", DEEP_RESULT="success",
                               DEEP_DOWNLOAD="failure")
        self.assertEqual(result.returncode, 1)

    def test_observation_reports_failure_without_enforcing(self):
        result = self.run_gate(None, ENFORCE="false")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("INCOMPLETE", result.stdout)


class EvalGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = load_eval_runner()

    THRESHOLDS = {"must_pass_rate": 1, "must_not_violations": 0, "recall_at_5_drop_allowed": 0.05,
                  "judge_axis_pass_rate_floor": 0.5, "judge_axis_pass_rate_drop_allowed": 0.1}

    def run_evals(self, cases, target, judge=None, revision=None, missing_baseline=False,
                  baseline=None, thresholds=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "cases.jsonl").write_text("\n".join(json.dumps(c) for c in cases))
            (root / "thresholds.json").write_text(json.dumps({
                "smoke": thresholds or self.THRESHOLDS, "judge": {"votes": 3, "pass_score": 4}}))
            args = ["evals", "--dataset", str(root / "cases.jsonl"), "--thresholds",
                    str(root / "thresholds.json"), "--out", str(root / "out")]
            if revision:
                args += ["--expected-revision", revision]
            if missing_baseline:
                args += ["--baseline", str(root / "missing-baseline.json")]
            if baseline is not None:
                (root / "baseline.json").write_text(json.dumps({"summary": baseline}))
                args += ["--baseline", str(root / "baseline.json")]
            scores = {axis: {"score": 5, "reason": "fixture"} for axis in self.runner.AXES}
            with patch.object(sys, "argv", args), patch.object(self.runner, "call_target", side_effect=target), \
                 patch.object(self.runner, "eval_l2", side_effect=judge, return_value=scores), \
                 patch.object(self.runner, "JUDGE_MODEL", "fixture-judge-model"), \
                 contextlib.redirect_stdout(io.StringIO()):
                result = self.runner.main()
            return result, json.loads((root / "out/results.json").read_text())

    def test_judge_model_is_required(self):
        # 既定のモデル ID を持たない(退役するモデルに黙って依存しない)。未設定なら評価を始めない
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            args = ["evals", "--dataset", str(root / "missing.jsonl"), "--thresholds",
                    str(root / "missing.json"), "--out", str(root / "out")]
            with patch.object(sys, "argv", args), patch.object(self.runner, "JUDGE_MODEL", ""), \
                 patch("sys.stderr", new_callable=io.StringIO) as stderr:
                self.assertEqual(self.runner.main(), 2)
            self.assertIn("JUDGE_MODEL", stderr.getvalue())
            self.assertFalse((root / "out").exists())

    def test_cli_without_judge_model_exits_before_evaluating(self):
        # import 時の既定値も含めて確かめるため、環境変数を外した別プロセスで CLI として実行する
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "anthropic.py").write_text("def AnthropicBedrock(**kwargs):\n    return None\n")
            env = {key: value for key, value in os.environ.items() if key != "JUDGE_MODEL"}
            env["PYTHONPATH"] = str(root)
            result = subprocess.run(
                [sys.executable, str(ASSETS / "evals/run_evals.py"), "--dataset", str(root / "missing.jsonl"),
                 "--thresholds", str(root / "missing.json"), "--out", str(root / "out")],
                env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn("JUDGE_MODEL", result.stderr)
            self.assertFalse((root / "out").exists())

    def cases(self):
        return [{"id": "must", "category": "answer", "query": "fixture", "suite": ["smoke"], "must_pass": True},
                {"id": "ordinary", "category": "answer", "query": "fixture", "suite": ["smoke"]}]

    def test_target_error_cannot_disappear_from_a_passing_mean(self):
        code, data = self.run_evals(self.cases(), [{"answer": "ok"}, RuntimeError("fixture error")])
        self.assertEqual(code, 1)
        self.assertEqual(data["summary"]["infrastructure_failed_ids"], ["ordinary"])

    def test_judge_error_blocks_and_is_recorded(self):
        scores = {axis: {"score": 5} for axis in self.runner.AXES}
        code, data = self.run_evals(self.cases(), [{"answer": "ok"}] * 2,
                                   judge=[scores, ValueError("invalid judge")])
        self.assertEqual(code, 1)
        self.assertEqual(data["summary"]["infrastructure_failed_ids"], ["ordinary"])

    def test_empty_suite_fails_with_report(self):
        code, data = self.run_evals([], [])
        self.assertEqual(code, 1)
        self.assertEqual(data["summary"]["n_cases"], 0)

    def test_complete_suite_can_pass(self):
        code, data = self.run_evals(self.cases(), [{"answer": "ok"}] * 2)
        self.assertEqual(code, 0)
        self.assertEqual(data["summary"]["n_cases"], 2)

    def test_explicit_missing_baseline_cannot_silently_disable_comparison(self):
        with self.assertRaises(FileNotFoundError):
            self.run_evals(self.cases(), [{"answer": "ok"}] * 2, missing_baseline=True)

    def test_staging_result_must_match_expected_revision(self):
        for actual, expected_code in (("old", 1), (None, 1), ("candidate", 0)):
            with self.subTest(actual=actual):
                code, _ = self.run_evals(self.cases(), [{"answer": "ok", "revision": actual}] * 2,
                                         revision="candidate")
                self.assertEqual(code, expected_code)

    def scores(self, **axes):
        return {axis: {"score": axes.get(axis, 5), "reason": "fixture"} for axis in self.runner.AXES}

    def ordinary_cases(self, n):
        return [{"id": f"case-{i}", "category": "answer", "query": "fixture", "suite": ["smoke"]}
                for i in range(n)]

    def test_each_axis_is_gated_separately_not_as_a_sum(self):
        # llm-evals の正本: 観点は合算しない。合計 12/15 でも、1軸が全件で合格線未満なら落とす
        code, data = self.run_evals(self.ordinary_cases(2), [{"answer": "ok"}] * 2,
                                    judge=[self.scores(completeness=2)] * 2)
        self.assertEqual(code, 1)
        rates = data["summary"]["judge_axis_pass_rate"]
        self.assertEqual(rates, {"correctness": 1.0, "faithfulness": 1.0, "completeness": 0.0})
        self.assertNotIn("judge_total_mean", data["summary"])

    def test_case_below_the_pass_line_on_any_axis_is_listed_with_the_axis(self):
        code, data = self.run_evals(self.ordinary_cases(2), [{"answer": "ok"}] * 2,
                                    judge=[self.scores(), self.scores(faithfulness=3)])
        self.assertEqual(code, 0)  # 合格率 50% は下限 50% を満たす
        failed = [r for r in data["results"] if r["failed"]]
        self.assertEqual([r["id"] for r in failed], ["case-1"])
        self.assertIn("faithfulness", failed[0]["fail_reason"])
        self.assertEqual(failed[0]["judge_pass"],
                         {"correctness": True, "faithfulness": False, "completeness": True})

    def test_must_pass_case_requires_every_axis_at_the_pass_line(self):
        cases = [{"id": "must", "category": "answer", "query": "fixture", "suite": ["smoke"], "must_pass": True}]
        code, data = self.run_evals(cases, [{"answer": "ok"}], judge=[self.scores(correctness=3)])
        self.assertEqual(code, 1)
        self.assertEqual(data["summary"]["must_pass_failed_ids"], ["must"])

    def test_axis_pass_rate_regression_against_baseline_blocks(self):
        baseline = {"recall_at_5_mean": None, "judge_pass_score": 4,
                    "judge_axis_pass_rate": {axis: 1.0 for axis in self.runner.AXES}}
        code, _ = self.run_evals(self.ordinary_cases(2), [{"answer": "ok"}] * 2,
                                 judge=[self.scores(), self.scores(correctness=1)], baseline=baseline)
        self.assertEqual(code, 1)
        code, _ = self.run_evals(self.ordinary_cases(2), [{"answer": "ok"}] * 2, baseline=baseline)
        self.assertEqual(code, 0)

    def test_regression_boundary_tolerates_float_rounding(self):
        # 0.8 - 0.1 は浮動小数点で 0.7000000000000001 になる。許容幅ちょうどの低下(0.7)を回帰にしない
        thresholds = {**self.THRESHOLDS, "judge_axis_pass_rate_drop_allowed": 0.1}
        judges = [self.scores(correctness=2) if i < 3 else self.scores() for i in range(10)]
        code, data = self.run_evals(self.ordinary_cases(10), [{"answer": "ok"}] * 10, judge=judges,
                                    baseline=self.baseline(correctness=0.8), thresholds=thresholds)
        self.assertEqual(data["summary"]["judge_axis_pass_rate"]["correctness"], 0.7)
        self.assertEqual(code, 0)

    def test_baseline_from_the_summed_score_gate_is_rejected(self):
        # 2.1.0 より前の baseline(judge_total_mean だけ)で比較を黙って飛ばさない
        old = {"recall_at_5_mean": 0.9, "judge_total_mean": 13.0}
        with self.assertRaisesRegex(ValueError, "regenerate"):
            self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}], baseline=old)

    def test_baseline_recall_must_be_a_finite_fraction_or_absent(self):
        # recall の対象が無い suite の baseline は None。それ以外の不正値は回帰比較を黙って無効にする
        for bad in (float("nan"), float("-inf"), -0.1, 1.5, True, "0.9"):
            with self.subTest(bad=bad), self.assertRaisesRegex(ValueError, "recall"):
                self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}],
                               baseline={**self.baseline(), "recall_at_5_mean": bad})
        code, _ = self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}],
                                 baseline={**self.baseline(), "recall_at_5_mean": None})
        self.assertEqual(code, 0)

    def test_baseline_with_a_different_pass_line_is_rejected(self):
        other = {"recall_at_5_mean": None, "judge_pass_score": 3,
                 "judge_axis_pass_rate": {axis: 1.0 for axis in self.runner.AXES}}
        with self.assertRaisesRegex(ValueError, "pass_score"):
            self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}], baseline=other)

    def test_legacy_summed_score_thresholds_are_rejected(self):
        legacy = {"must_pass_rate": 1, "must_not_violations": 0, "recall_at_5_drop_allowed": 0.05,
                  "judge_total_drop_allowed": 1.0, "judge_total_floor": 10.5}
        with self.assertRaisesRegex(ValueError, "judge_total_floor"):
            self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}], thresholds=legacy)

    def baseline(self, **rates):
        return {"recall_at_5_mean": None, "judge_pass_score": 4,
                "judge_axis_pass_rate": {axis: rates.get(axis, 1.0) for axis in self.runner.AXES}}

    def test_baseline_rates_must_be_finite_fractions(self):
        # null や NaN の軸があると、その軸の回帰比較が黙って飛ばされる。評価を始める前に止める
        for bad in (None, float("nan"), float("inf"), -0.1, 1.5, True, "1.0"):
            with self.subTest(bad=bad), self.assertRaisesRegex(ValueError, "baseline"):
                self.run_evals(self.ordinary_cases(1), [{"answer": "ok"}],
                               baseline=self.baseline(faithfulness=bad))

    def test_rate_thresholds_must_be_finite_fractions(self):
        # NaN の下限や許容幅は、どの比較も偽にしてゲートを開けてしまう
        for key in ("judge_axis_pass_rate_floor", "judge_axis_pass_rate_drop_allowed",
                    "recall_at_5_drop_allowed", "must_pass_rate"):
            for bad in (float("nan"), float("inf"), -0.1, 1.1, "0.8", True, None):
                with self.subTest(key=key, bad=bad), self.assertRaisesRegex(ValueError, key):
                    self.runner.validate_thresholds({**self.THRESHOLDS, key: bad})
        for bad in (-1, 0.5, True, "0", float("nan")):
            with self.subTest(must_not_violations=bad), self.assertRaisesRegex(ValueError, "must_not_violations"):
                self.runner.validate_thresholds({**self.THRESHOLDS, "must_not_violations": bad})

    def test_score_at_the_pass_line_passes_and_below_fails(self):
        code, data = self.run_evals(self.ordinary_cases(2), [{"answer": "ok"}] * 2,
                                    judge=[self.scores(correctness=4), self.scores(correctness=3.5)])
        self.assertEqual([r["judge_pass"]["correctness"] for r in data["results"]], [True, False])
        self.assertEqual(data["summary"]["judge_axis_pass_rate"]["correctness"], 0.5)

    def test_pass_line_comes_from_the_judge_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "cases.jsonl").write_text(json.dumps(self.ordinary_cases(1)[0]))
            (root / "thresholds.json").write_text(json.dumps({
                "smoke": self.THRESHOLDS, "judge": {"votes": 3, "pass_score": 3}}))
            args = ["evals", "--dataset", str(root / "cases.jsonl"), "--thresholds",
                    str(root / "thresholds.json"), "--out", str(root / "out")]
            with patch.object(sys, "argv", args), \
                 patch.object(self.runner, "call_target", side_effect=[{"answer": "ok"}]), \
                 patch.object(self.runner, "eval_l2", side_effect=[self.scores(completeness=3)]), \
                 patch.object(self.runner, "JUDGE_MODEL", "fixture-judge-model"), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(self.runner.main(), 0)
            data = json.loads((root / "out/results.json").read_text())
        self.assertEqual(data["summary"]["judge_pass_score"], 3)
        self.assertTrue(data["results"][0]["judge_pass"]["completeness"])

    def test_even_vote_medians_are_compared_with_the_pass_line(self):
        # 票数が偶数なら中央値は x.5 になる。3.5 は合格線 4 に届かず、4.5 は届く
        for votes, expected in (([3, 4], False), ([4, 5], True)):
            contents = [types.SimpleNamespace(content=[types.SimpleNamespace(type="text", text=json.dumps({
                axis: {"score": score, "reason": "fixture"} for axis in self.runner.AXES}))]) for score in votes]
            client = types.SimpleNamespace(messages=types.SimpleNamespace(create=Mock(side_effect=contents)))
            judge = self.runner.eval_l2(client, self.cases()[0], {}, "rubric", {"votes": 2})
            with self.subTest(votes=votes):
                self.assertEqual(judge["correctness"]["score"] >= 4, expected)

    def test_regression_uses_the_allowed_drop_on_every_axis(self):
        # 絶対下限(50%)は満たしたまま、baseline 100% からの低下幅だけを動かす。許容幅は 10 ポイント
        thresholds = {**self.THRESHOLDS, "judge_axis_pass_rate_drop_allowed": 0.1}
        for axis in self.runner.AXES:
            for failing, expected in ((0, 0), (1, 0), (2, 1)):  # 10件中の不合格数: 0%・10%(境界)・20% の低下
                judges = [self.scores(**{axis: 2}) if i < failing else self.scores() for i in range(10)]
                with self.subTest(axis=axis, failing=failing):
                    code, _ = self.run_evals(self.ordinary_cases(10), [{"answer": "ok"}] * 10, judge=judges,
                                             baseline=self.baseline(), thresholds=thresholds)
                    self.assertEqual(code, expected)

    def test_shipped_thresholds_are_valid_for_every_suite(self):
        shipped = json.loads((ASSETS / "evals/thresholds.json").read_text())
        for suite in ("smoke", "full"):
            with self.subTest(suite=suite):
                self.runner.validate_thresholds(shipped[suite])
        self.assertEqual(shipped["judge"]["pass_score"], 4)

    def test_invalid_judge_scores_and_incomplete_votes_are_rejected(self):
        for values in ([5], [5, 5, 99], [5, 5, True], [5, 5, 5]):
            contents = [types.SimpleNamespace(content=[types.SimpleNamespace(type="text", text=json.dumps({
                axis: {"score": score, "reason": "fixture"} for axis in self.runner.AXES}))]) for score in values]
            client = types.SimpleNamespace(messages=types.SimpleNamespace(create=Mock(side_effect=contents)))
            with self.subTest(values=values):
                if values == [5, 5, 5]:
                    self.assertEqual(self.runner.eval_l2(client, self.cases()[0], {}, "rubric", {})["correctness"]["score"], 5)
                else:
                    with self.assertRaises(ValueError):
                        self.runner.eval_l2(client, self.cases()[0], {}, "rubric", {})


class JudgeSamplingTests(unittest.TestCase):
    """judge には sampling パラメータ(temperature / top_p / top_k)を送らない。

    anthropic SDK 1.0.0(2026-08-20)以降の messages.create はこれらの引数を受け付けず、
    送ると TypeError で全票が失敗する。thresholds.json に残っていても送らず、無視したことを知らせる。
    JUDGE_MODEL は import 時に確定するため patch.object で差し替える。
    """

    MODELS = ("apac.anthropic.claude-sonnet-4-5-20250929-v1:0",
              "anthropic.claude-haiku-4-5-20251001-v1:0",
              "anthropic.claude-opus-4-7",
              "arn:aws:bedrock:ap-northeast-1:000000000000:application-inference-profile/fixture")
    SAMPLING = {"temperature": 0, "top_p": 0.9, "top_k": 5}

    @classmethod
    def setUpClass(cls):
        cls.runner = load_eval_runner()

    def judge_params(self, model, cfg):
        vote = json.dumps({axis: {"score": 5, "reason": "fixture"} for axis in self.runner.AXES})
        message = types.SimpleNamespace(content=[types.SimpleNamespace(type="text", text=vote)])
        create = Mock(return_value=message)
        client = types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
        case = {"id": "fixture", "category": "answer", "query": "fixture"}
        with patch.object(self.runner, "JUDGE_MODEL", model):
            self.runner.eval_l2(client, case, {}, "rubric", cfg)
        self.assertEqual(create.call_count, cfg.get("votes", 3))
        return create.call_args.kwargs

    def test_sampling_parameters_are_never_sent(self):
        for model in self.MODELS:
            with self.subTest(model=model):
                params = self.judge_params(model, dict(self.SAMPLING))
                self.assertFalse(set(self.SAMPLING) & set(params))
                self.assertIn("max_tokens", params)

    def test_configured_sampling_parameters_are_reported_as_ignored(self):
        self.assertEqual(self.runner.ignored_sampling_keys({"votes": 3, **self.SAMPLING}),
                         ["temperature", "top_p", "top_k"])
        self.assertEqual(self.runner.ignored_sampling_keys({"votes": 3}), [])

    def test_judge_failure_reports_the_sdk_error_message(self):
        # 型名だけでは SDK の破壊的変更(引数の削除など)を追えないため、メッセージも出す
        error = TypeError("create() got an unexpected keyword argument 'temperature'")
        client = types.SimpleNamespace(messages=types.SimpleNamespace(create=Mock(side_effect=error)))
        case = {"id": "fixture", "category": "answer", "query": "fixture"}
        with patch("sys.stderr", new_callable=io.StringIO) as stderr, self.assertRaises(ValueError):
            self.runner.eval_l2(client, case, {}, "rubric", {"votes": 1})
        self.assertIn("unexpected keyword argument 'temperature'", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
