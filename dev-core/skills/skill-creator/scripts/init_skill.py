#!/usr/bin/env python3
"""
スキル初期化スクリプト

Usage:
    init_skill.py <skill-name> --path <path>

Examples:
    init_skill.py pdf-processor --path ./skills
    init_skill.py commit-message --path /home/user/my-skills
"""

import sys
from pathlib import Path

SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: 機能説明 + 「〇〇して」「△△を作成」などの具体的トリガーフレーズ。例: PDFからテキスト・表を抽出。「PDFからテキスト抽出」「PDF結合」と言われた時に使用。]
---

# {skill_title}

## クイックスタート

[TODO: 最も一般的な使用例を1つ示す]

## 使用方法

[TODO: 主要な機能・ワークフローを記述]

## 例

[TODO: 具体的な入出力例を2-3個追加]
"""

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
{skill_name} 用サンプルスクリプト

このファイルは削除するか、実際の処理に置き換えてください。
"""

import argparse

def main():
    parser = argparse.ArgumentParser(description='{skill_title}')
    parser.add_argument('input', help='入力ファイル')
    parser.add_argument('--output', '-o', help='出力ファイル')

    args = parser.parse_args()

    # TODO: 実際の処理を実装
    print(f"処理中: {{args.input}}")

if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# {skill_title} リファレンス

[TODO: 詳細な参照情報をここに追加するか、このファイルを削除]

## 目次
- セクション1
- セクション2
- セクション3

## セクション1

...
"""


def title_case(skill_name: str) -> str:
    """skill-name → Skill Name"""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name: str, path: str) -> Path | None:
    """スキルディレクトリを初期化"""
    skill_dir = Path(path).resolve() / skill_name

    if skill_dir.exists():
        print(f"エラー: ディレクトリが既に存在します: {skill_dir}")
        return None

    try:
        skill_dir.mkdir(parents=True)
        print(f"作成: {skill_dir}")
    except Exception as e:
        print(f"エラー: ディレクトリ作成失敗: {e}")
        return None

    skill_title = title_case(skill_name)

    # SKILL.md
    skill_md = skill_dir / 'SKILL.md'
    skill_md.write_text(SKILL_TEMPLATE.format(
        skill_name=skill_name,
        skill_title=skill_title
    ))
    print("作成: SKILL.md")

    # scripts/
    scripts_dir = skill_dir / 'scripts'
    scripts_dir.mkdir()
    example_script = scripts_dir / 'example.py'
    example_script.write_text(EXAMPLE_SCRIPT.format(
        skill_name=skill_name,
        skill_title=skill_title
    ))
    example_script.chmod(0o755)
    print("作成: scripts/example.py")

    # references/
    refs_dir = skill_dir / 'references'
    refs_dir.mkdir()
    example_ref = refs_dir / 'reference.md'
    example_ref.write_text(EXAMPLE_REFERENCE.format(skill_title=skill_title))
    print("作成: references/reference.md")

    # assets/
    assets_dir = skill_dir / 'assets'
    assets_dir.mkdir()
    (assets_dir / '.gitkeep').touch()
    print("作成: assets/")

    print(f"\n完了: '{skill_name}' を {skill_dir} に作成しました")
    print("\n次のステップ:")
    print("1. SKILL.md の description を具体的なトリガーフレーズ付きで記述")
    print("2. SKILL.md の本文を完成")
    print("3. 不要なサンプルファイルを削除")
    print("4. python scripts/validate_skill.py で検証")

    return skill_dir


def main():
    if len(sys.argv) < 4 or sys.argv[2] != '--path':
        print("Usage: init_skill.py <skill-name> --path <path>")
        print("\n例:")
        print("  init_skill.py pdf-processor --path ./skills")
        print("  init_skill.py commit-message --path /home/user/skills")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]

    # 名前の検証
    if not skill_name.replace('-', '').isalnum():
        print("エラー: スキル名は英小文字、数字、ハイフンのみ使用可能")
        sys.exit(1)

    if len(skill_name) > 64:
        print("エラー: スキル名は64文字以内")
        sys.exit(1)

    result = init_skill(skill_name, path)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
