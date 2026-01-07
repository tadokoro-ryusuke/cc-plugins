#!/usr/bin/env python3
"""
スキル検証スクリプト

ベストプラクティスに基づいてスキルを検証:
- YAML frontmatter の形式
- description の品質
- SKILL.md の行数
- ディレクトリ構造

Usage:
    validate_skill.py <skill-directory>
"""

import sys
import re
from pathlib import Path

try:
    import yaml
except ImportError:
    print("エラー: PyYAMLが必要です。pip install pyyaml")
    sys.exit(1)


class ValidationResult:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str):
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def validate_skill(skill_path: Path) -> ValidationResult:
    """スキルディレクトリを検証"""
    result = ValidationResult()

    # SKILL.md存在確認
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        result.error("SKILL.md が見つかりません")
        return result

    content = skill_md.read_text()

    # フロントマター確認
    if not content.startswith('---'):
        result.error("YAML frontmatter がありません（---で開始する必要があります）")
        return result

    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        result.error("YAML frontmatter の形式が不正です")
        return result

    # YAML パース
    try:
        frontmatter = yaml.safe_load(match.group(1))
        if not isinstance(frontmatter, dict):
            result.error("frontmatter は辞書形式である必要があります")
            return result
    except yaml.YAMLError as e:
        result.error(f"YAML パースエラー: {e}")
        return result

    # 必須フィールド
    if 'name' not in frontmatter:
        result.error("'name' フィールドがありません")
    if 'description' not in frontmatter:
        result.error("'description' フィールドがありません")

    # 許可されたフィールドのみ
    allowed = {'name', 'description'}
    extra = set(frontmatter.keys()) - allowed
    if extra:
        result.warn(f"余分なフィールド: {', '.join(extra)}（name/descriptionのみ推奨）")

    # name 検証
    name = frontmatter.get('name', '')
    if isinstance(name, str):
        name = name.strip()
        if not re.match(r'^[a-z0-9-]+$', name):
            result.error(f"name '{name}' は小文字、数字、ハイフンのみ使用可能")
        if name.startswith('-') or name.endswith('-') or '--' in name:
            result.error(f"name '{name}' の先頭/末尾にハイフン不可、連続ハイフン不可")
        if len(name) > 64:
            result.error(f"name が長すぎます（{len(name)}文字、最大64文字）")
    else:
        result.error("name は文字列である必要があります")

    # description 検証
    desc = frontmatter.get('description', '')
    if isinstance(desc, str):
        desc = desc.strip()
        if len(desc) > 1024:
            result.error(f"description が長すぎます（{len(desc)}文字、最大1024文字）")
        if '<' in desc or '>' in desc:
            result.error("description に <> は使用できません")

        # ベストプラクティス: トリガーフレーズチェック
        trigger_patterns = ['と言われた時', 'when', '使用', 'use this', 'trigger']
        has_trigger = any(p in desc.lower() for p in trigger_patterns)
        if not has_trigger:
            result.warn("description にトリガーフレーズがありません（「〇〇と言われた時に使用」など推奨）")

        # TODO チェック
        if '[TODO' in desc or 'TODO:' in desc:
            result.error("description に TODO が残っています")
    else:
        result.error("description は文字列である必要があります")

    # SKILL.md 行数チェック
    body = content[match.end():].strip()
    line_count = len(body.split('\n'))
    if line_count > 500:
        result.warn(f"SKILL.md 本文が {line_count} 行です（500行以下推奨）")

    # ディレクトリ構造チェック
    for name in ['README.md', 'CHANGELOG.md', 'INSTALLATION.md']:
        if (skill_path / name).exists():
            result.warn(f"不要なファイル: {name}（スキルには含めないべき）")

    return result


def main():
    if len(sys.argv) != 2:
        print("Usage: validate_skill.py <skill-directory>")
        sys.exit(1)

    skill_path = Path(sys.argv[1])
    if not skill_path.is_dir():
        print(f"エラー: ディレクトリが見つかりません: {skill_path}")
        sys.exit(1)

    print(f"検証中: {skill_path}")
    print()

    result = validate_skill(skill_path)

    if result.errors:
        print("エラー:")
        for e in result.errors:
            print(f"  - {e}")
        print()

    if result.warnings:
        print("警告:")
        for w in result.warnings:
            print(f"  - {w}")
        print()

    if result.is_valid:
        if result.warnings:
            print("検証結果: 有効（警告あり）")
        else:
            print("検証結果: 有効")
        sys.exit(0)
    else:
        print("検証結果: 無効")
        sys.exit(1)


if __name__ == "__main__":
    main()
