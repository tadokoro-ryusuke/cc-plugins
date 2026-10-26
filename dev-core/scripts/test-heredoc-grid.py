#!/usr/bin/env python3
"""heredoc の区切り語の扱いを、bash 自身の動作を正解にして危険コマンドのフックと突き合わせる。
test-block-dangerous-commands.sh から呼ばれる（python3 がある環境だけ）。

各テンプレートから2つの文字列を作る:
  - 正解: OP の位置に無害な `echo EXEC""UTED_MARK` を置いて bash で実行し、EXECUTED_MARK が出たら
    「OP は実行される」とする（heredoc の本文として表示された場合は EXEC""UTED_MARK のままなので数えない）
  - フック: OP の位置に危険な操作を置いてフックに渡し、正解が「実行される」ときだけ block を期待する
危険な操作の文字列は bash に渡さない。
使い方: python3 test-heredoc-grid.py <hook.sh> [<hook.sh> ...]（食い違いがあれば終了コード 1）
"""
import json
import os
import subprocess
import sys
import tempfile

SAFE = 'echo EXEC""UTED_MARK'
DANGEROUS = "rm -rf " + "/"
TAB = "\t"

# (書き方, 本文を終える行, 本文の行の前置き)
DELIMS = [
    ("EOF", "EOF", ""),
    ("'EOF'", "EOF", ""),
    ('"EOF"', "EOF", ""),
    ("\\EOF", "EOF", ""),
    ('E"O"F', "EOF", ""),
    ("'A)B'", "A)B", ""),
    ("'A B'", "A B", ""),
    ('"A\\$B"', "A$B", ""),
    ('"A\\\\B"', "A\\B", ""),
    ('"A\\"B"', 'A"B', ""),
    ('"A\\`B"', "A`B", ""),
    ("-EOF", "EOF", TAB),
    ("-'EOF'", "EOF", TAB),
]


def decoy(spelling):
    # 引用符だけを素朴に外した、本当の区切り語とは違うかもしれない行
    text = spelling.lstrip("-")
    for q in ("'", '"'):
        text = text.replace(q, "")
    return text


def scripts(op):
    for spelling, term, indent in DELIMS:
        layouts = {
            "after": [f"cat <<{spelling}", f"{indent}hello", f"{indent}{term}", op],
            "inside": [f"cat <<{spelling}", f"{indent}{op}", f"{indent}{term}"],
            "decoy": [f"cat <<{spelling}", f"{indent}{decoy(spelling)}", f"{indent}{op}", f"{indent}{term}"],
        }
        for layout, lines in layouts.items():
            body = "\n".join(lines)
            yield (spelling, layout, "bare"), body + "\n"
            yield (spelling, layout, "subst"), "echo $(" + body + "\n)\n"


def executed(script):
    with tempfile.TemporaryDirectory() as cwd:
        proc = subprocess.run(["bash", "-c", script], cwd=cwd, capture_output=True, text=True, timeout=10)
    return "EXECUTED_MARK" in proc.stdout


def hook_result(hook, command):
    proc = subprocess.run(["bash", hook], input=json.dumps({"tool_input": {"command": command}}),
                          capture_output=True, text=True, timeout=30)
    if proc.returncode == 2:
        return "block"
    if '"ask"' in proc.stdout:
        return "ask"
    return "pass" if proc.returncode == 0 and not proc.stdout else f"exit{proc.returncode}"


truth = {key: executed(script) for key, script in scripts(SAFE)}
failed = False
for hook in sys.argv[1:]:
    mismatches = []
    for key, command in scripts(DANGEROUS):
        got = hook_result(hook, command)
        want = "block" if truth[key] else "pass"
        if got != want:
            mismatches.append((key, want, got))
    print(f"{os.path.basename(hook)}: {len(truth) - len(mismatches)}/{len(truth)} 一致")
    for key, want, got in mismatches:
        print(f"  {key}: 期待 {want}、実際 {got}")
    failed = failed or bool(mismatches)
sys.exit(1 if failed else 0)
