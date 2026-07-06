# 共有スキルのセットアップ（Claude Code ⟷ Codex）

dev-core が配布する開発原則スキル（TDD / FSD / Clean Architecture / DDD 等）を
Claude Code と Codex の双方から **同一の実体** で参照するためのセットアップ手順。

スキル本文の実体（Single Source of Truth, 以下 SSoT）は常に `dev-core/skills/<skill>` の
1 箇所だけに置く。コピーして二重管理しない。

Codex に認識させる経路は **2 つあり、別物** として扱う。両者は仕組みも成果物も異なる。

| 経路 | 仕組み | Codex が skill を見る場所 |
|------|--------|--------------------------|
| A: plugin 配布 | `.codex-plugin/plugin.json` を install 単位として配布 | install 後の bundled skills |
| B: 共有ディレクトリ | repo-local skill discovery（CWD → repo root 走査） | 利用者プロジェクトの `.agents/skills/<skill>` |

> **重要**: drift チェック（`scripts/check-skills-drift.mjs`）は「マニフェスト形式 /
> 参照パス / インデックス整合」という **静的検証** のみを行う。
> 「Codex が実際に skill を認識するか」は CI（Codex CLI 非搭載）では検証できない。
> 各経路の実認識は、本書末尾の **手動確認ログ** に証跡を残して受け入れる。

---

## 経路A: plugin install（bundled skills）

`.codex-plugin/plugin.json` を持つこのプラグイン（dev-core）を Codex 側で plugin として
install すると、`skills: "./skills/"` で参照される dev-core の bundled skills が
Codex から使えるようになる。

**推奨**: Codex への配布は、兄弟リポジトリ
[tadokoro-ryusuke/codex-plugins](https://github.com/tadokoro-ryusuke/codex-plugins)
（Codex ネイティブ・マーケットプレイス。skills は英語翻案）を使う。

```bash
codex plugin marketplace add tadokoro-ryusuke/codex-plugins
codex plugin add dev-core@codex-plugins
```

install 後は **新しい Codex スレッド**を開始し、`/skills` 一覧または skill selector で
各スキルが表示されることを確認する（経路Aの機構自体は hotl-engineering で実機確認済み:
2026-07-05。末尾の手動確認ログ参照。dev-core 固有の認識確認は install 時に行うこと）。

> **キャッシュに注意**: Codex は install 時にプラグインをキャッシュへスナップショットする。
> marketplace 側を更新しても自動反映されないため、更新後は
> `codex plugin add <plugin>@codex-plugins` で再インストールし、新スレッドを開始する。

なお、cc-plugins 側の dev-core も `.codex-plugin/plugin.json`（`skills: "./skills/"`）を
持つため、この cc-plugins を直接 marketplace 登録して install することも機構上は可能だが、
スキル本文が日本語のままになる。英語環境・チーム配布には codex-plugins を使うこと。

---

## 経路B: 共有ディレクトリでの symlink 共有

利用者プロジェクトのリポジトリ内で、Codex の repo-local skill discovery が走査する
現行パス `.agents/skills`（複数形）に、SSoT を指す **relative symlink** を張る。
このリポジトリには `scripts/setup-shared-skills.sh` を同梱している。

### symlink の向き（明文化）

- SSoT（実体）: `dev-core/skills/<skill>`
- リンク（参照）: 利用者プロジェクトの `.agents/skills/<skill>` → SSoT への relative symlink
- `.agents/skills` 側は **実体を複製しない**。常に SSoT を指すだけ。

### 使い方

利用者プロジェクトのルートで実行する。

```bash
# 1) まず dry-run で、張られる symlink を確認する（何も作らない）
bash /path/to/cc-plugins/scripts/setup-shared-skills.sh /path/to/cc-plugins/dev-core/skills --dry-run

# 2) 問題なければ本実行する
bash /path/to/cc-plugins/scripts/setup-shared-skills.sh /path/to/cc-plugins/dev-core/skills
```

SSoT の場所は次の優先順位で解決される（ハードコードしない）:

1. 第1引数 `SSOT_DIR`
2. 環境変数 `SHARED_SKILLS_SSOT`
3. スクリプト位置からの相対デフォルト（`<repo>/scripts/` から見た `../dev-core/skills`）

```bash
# 環境変数で SSoT を指定する例
SHARED_SKILLS_SSOT=/path/to/cc-plugins/dev-core/skills \
  bash /path/to/cc-plugins/scripts/setup-shared-skills.sh --dry-run
```

### 冪等性

- 既存の `.agents/skills/<skill>` が **既に正しい SSoT** を指す symlink なら no-op（再実行安全）。
- 別の先を指している、または symlink でない実体がある場合は **警告して skip** する（破壊しない）。

### 確認

実行後、リンクの解決先が SSoT を指していることを確認する。

```bash
ls -l .agents/skills
readlink .agents/skills/best-practices   # 解決先が dev-core/skills/best-practices であること
```

その後、Codex の repo-local discovery で skill が認識されることを実環境で確認し、
手動確認ログに記録する。

---

## Windows フォールバック（@AGENTS.md import 方式）

Windows で Developer Mode / 管理者権限が無いなど、symlink を作成できない環境では
symlink 経路（経路B）が使えない。その場合は **`@AGENTS.md` import 方式** にフォールバックする。

- dev-core はスキルインデックスの正本として `AGENTS.md` を持つ。
- 利用者プロジェクトの `CLAUDE.md` / `AGENTS.md` の冒頭から dev-core の `AGENTS.md` を
  `@AGENTS.md` 形式で import すれば、symlink 無しでも知識インデックスを共有できる。
- import 方式は symlink より移植性が高く、Windows でも動作する。

`setup-shared-skills.sh` は symlink 作成に失敗した場合、このフォールバックを案内する
メッセージを出力する。

---

## Codex 権限設定

Claude Code の `settings.json` にある `permissions.allow` / `permissions.deny` を
Codex へ寄せる場合は、`config.toml` の permission profiles と `.rules` の
`prefix_rule()` に分けて設定する。

詳細: [`codex-permissions.md`](./codex-permissions.md)

---

## 手動確認ログ（経路A / 経路B の実 Codex 認識）

drift が緑でも「Codex が実際に skill を認識するか」は経路ごとに手動確認が必要。
確認のたびに以下のテンプレートを複製して証跡を残す。

```text
### 確認ログ: <経路A or 経路B> / <確認日 YYYY-MM-DD>

- 経路: [ A: plugin install / B: 共有ディレクトリ symlink ]
- marketplace / SSoT path:  <経路Aなら marketplace path、経路Bなら SSoT と .agents/skills の場所>
- install 方式:             <経路Aの install コマンド / 経路Bは setup-shared-skills.sh の実行内容>
- Codex restart 有無:       [ あり / なし ]
- 確認方法:                 [ /skills 一覧 / skill selector / その他 ]
- 認識できた skill 名一覧:  <実際に Codex に表示された skill 名を列挙>
- 結果:                     [ OK / NG ]
- 備考:                     <NG の場合の原因・対処、環境（OS / Codex バージョン）など>
```

### 確認ログ: 経路A / 2026-07-05

- 経路: A: plugin install
- marketplace / SSoT path:  marketplace=~/work/codex-plugins（ローカル clone を `codex plugin marketplace add` で登録）
- install 方式:             `codex plugin add hotl-engineering@codex-plugins`
- Codex restart 有無:       なし（`codex exec` の新スレッドで確認）
- 確認方法:                 `codex exec` に skill 一覧を回答させる discovery プロンプト
- 認識できた skill 名一覧:  hotl-engineering（`hotl-engineering:hotl-engineering`）
- 結果:                     OK
- 備考:                     macOS。install 時キャッシュのため marketplace 更新後は再インストール + 新スレッドが必要

### 記入例（テンプレートの使い方の例。実際の確認結果に置き換える）

```text
### 確認ログ: 経路B / 2026-05-27

- 経路: B: 共有ディレクトリ symlink
- marketplace / SSoT path:  SSoT=/path/to/dev-core/skills, link=<project>/.agents/skills
- install 方式:             bash setup-shared-skills.sh /path/to/dev-core/skills
- Codex restart 有無:       なし
- 確認方法:                 /skills 一覧
- 認識できた skill 名一覧:  best-practices, verify, codex-collab, ...
- 結果:                     OK
- 備考:                     WSL2 上で確認。relative symlink が正しく解決された。
```
