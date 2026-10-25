"""配布する eval runner が、eval-gate.yml で固定した版の anthropic SDK で実際に動くことを確かめる。

ネットワークには出ない。SDK の HTTP 層を httpx.MockTransport に差し替え、judge の呼び出し経路
(引数の受理とリクエストの直列化)をスタブなしで通す。SDK の引数契約が変わると、ここで落ちる。
CI(hotl-gates.yml)は固定した版の SDK を入れ、HOTL_REQUIRE_SDK=1 で実行する。
ローカルで SDK が無い場合は skip する。
"""

import importlib.util
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

    def test_default_judge_config_is_accepted_by_the_pinned_sdk(self):
        cfg = json.loads((ASSETS / "evals/thresholds.json").read_text())["judge"]
        vote = json.dumps({axis: {"score": 5, "reason": "fixture"} for axis in self.runner.AXES})
        requests = []

        def handler(request):
            requests.append(json.loads(request.content))
            return httpx.Response(200, json={
                "id": "msg_fixture", "type": "message", "role": "assistant",
                "model": self.runner.JUDGE_MODEL,
                "content": [{"type": "text", "text": vote}],
                "stop_reason": "end_turn", "stop_sequence": None,
                "usage": {"input_tokens": 1, "output_tokens": 1},
            })

        client = anthropic.AnthropicBedrock(
            aws_region="ap-northeast-1", aws_access_key="fixture", aws_secret_key="fixture",
            http_client=httpx.Client(transport=httpx.MockTransport(handler)))
        case = {"id": "fixture", "category": "answer", "query": "fixture"}

        result = self.runner.eval_l2(client, case, {}, "rubric", cfg)

        self.assertEqual(len(requests), cfg["votes"])
        self.assertEqual({axis: result[axis]["score"] for axis in self.runner.AXES},
                         {axis: 5 for axis in self.runner.AXES})
        # 既定の judge(旧世代)は Bedrock で API 2026-10-21 に対応しない(Bedrock legacy ページ)。
        # SDK 2.x はこの版を送るので、judge を 4.7 以降へ移すまで SDK の major を上げない
        self.assertEqual({request.get("anthropic_version") for request in requests}, {"bedrock-2023-05-31"})


if __name__ == "__main__":
    unittest.main()
