"""配布する eval runner が、eval-gate.yml で固定した版の anthropic SDK で実際に動くことを確かめる。

ネットワークには出ない。SDK の HTTP 層を httpx.MockTransport に差し替え、judge の呼び出し経路
(引数の受理とリクエストの直列化)をスタブなしで通す。SDK の引数契約が変わると、ここで落ちる。
CI(hotl-gates.yml)は固定した版の SDK を入れ、HOTL_REQUIRE_SDK=1 で実行する。
ローカルで SDK が無い場合は skip する。
"""

import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

try:
    import anthropic
    # anthropic SDK 1.17 以降は HTTP 層に httpx2 を使う。古い版は httpx
    try:
        import httpx2 as httpx
    except ImportError:
        import httpx
except ImportError:
    anthropic = None


ASSETS = Path(__file__).resolve().parents[2] / "hotl-engineering/skills/hotl-engineering/assets"
SDK_REQUIRED = os.environ.get("HOTL_REQUIRE_SDK") == "1"


def load_runner_with_real_sdk():
    spec = importlib.util.spec_from_file_location("hotl_evals_real_sdk", ASSETS / "evals/run_evals.py")
    runner = importlib.util.module_from_spec(spec)
    # dataclass は定義中のモジュールを sys.modules から引くため、読み込みの間だけ登録する
    with patch.dict(sys.modules, {"hotl_evals_real_sdk": runner}):
        spec.loader.exec_module(runner)
    return runner


@unittest.skipIf(anthropic is None and not SDK_REQUIRED, "anthropic SDK が無い(CI では HOTL_REQUIRE_SDK=1 で必須)")
class JudgeSdkContractTests(unittest.TestCase):
    def setUp(self):
        if anthropic is None:
            self.fail("HOTL_REQUIRE_SDK=1 だが anthropic SDK を import できない")
        self.runner = load_runner_with_real_sdk()

    def judge_with_fixture_reply(self, cfg, content, stop_reason="end_turn"):
        """固定した SDK の Bedrock クライアントで judge を呼び、送った本文を返す。返答は fixture。"""
        requests = []

        def handler(request):
            requests.append(json.loads(request.content))
            return httpx.Response(200, json={
                "id": "msg_fixture", "type": "message", "role": "assistant",
                "model": self.runner.JUDGE_MODEL,
                "content": content,
                "stop_reason": stop_reason, "stop_sequence": None,
                "usage": {"input_tokens": 1, "output_tokens": 1},
            })

        client = anthropic.AnthropicBedrock(
            aws_region="ap-northeast-1", aws_access_key="fixture", aws_secret_key="fixture",
            http_client=httpx.Client(transport=httpx.MockTransport(handler)))
        case = {"id": "fixture", "category": "answer", "query": "fixture"}
        with patch.object(self.runner, "JUDGE_MODEL", "fixture-judge-model"):
            result = self.runner.eval_l2(client, case, {}, "rubric", cfg)
        return result, requests

    def vote_content(self):
        vote = json.dumps({axis: {"score": 5, "reason": "fixture"} for axis in self.runner.AXES})
        return [{"type": "text", "text": vote}]

    def test_default_judge_config_is_accepted_by_the_pinned_sdk(self):
        cfg = json.loads((ASSETS / "evals/thresholds.json").read_text())["judge"]
        result, requests = self.judge_with_fixture_reply(cfg, self.vote_content())

        self.assertEqual(len(requests), cfg["votes"])
        self.assertEqual({axis: result[axis]["score"] for axis in self.runner.AXES},
                         {axis: 5 for axis in self.runner.AXES})
        # judge に 4.6 以前のモデル(Haiku 4.5 など)を選んだ場合、Bedrock では API 2026-10-21 に対応しない。
        # SDK 2.x はこの版を送るので、judge を 4.7 以降へ移すまで SDK の major を上げない
        self.assertEqual({request.get("anthropic_version") for request in requests}, {"bedrock-2023-05-31"})
        # 既定では effort を送らない(モデルの API の既定が効く)
        self.assertFalse([request for request in requests if "output_config" in request])

    def test_configured_effort_reaches_the_bedrock_request_body(self):
        # 固定した SDK の messages.create が output_config を受け付け、Bedrock の本文に載せることを確かめる
        # (2.0.2 では、SDK が受け付けない引数で全票が TypeError になった)
        _, requests = self.judge_with_fixture_reply({"votes": 1, "effort": "high"}, self.vote_content())
        self.assertEqual([request.get("output_config") for request in requests], [{"effort": "high"}])

    def test_a_reply_cut_at_max_tokens_after_thinking_is_reported(self):
        # thinking が既定で有効な judge は、thinking だけで max_tokens に達し、本文の無いまま止まりうる
        content = [{"type": "thinking", "thinking": "", "signature": "fixture"}]
        with patch("sys.stderr", new_callable=io.StringIO) as stderr, self.assertRaises(ValueError):
            self.judge_with_fixture_reply({"votes": 1}, content, stop_reason="max_tokens")
        self.assertIn("stop_reason=max_tokens", stderr.getvalue())
        self.assertIn("judge.max_tokens", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
