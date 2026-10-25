# 依存の取り込みと GitHub Actions のサプライチェーン対策（詳細）

cicd-release-design Step 2 の詳細。原則は SKILL.md に置き、ここには版や日付で変わる事実だけを置く。

- **確認日: 2026-10-26**。設定名・既定値・日付はすぐ変わる。案件に適用する前に、各出典で現行の値を確かめる。
- 脆弱性の CI ゲート基準（どの重大度で落とすか・例外の扱い）の正本は dev-core:security-by-design Step 5。本ファイルは扱わない。

## 1. 新着版のクールダウン

原則: 新着版は 3〜14 日待ってから取り込む。必ず「セキュリティ修正は即時に取り込む例外経路」とセットにする。
なぜ: 乗っ取られた版は公開直後に広がり、その後に検知・削除されることが多い。待つだけにすると、修正版まで遅れる。

| ツール | 既定で効くか | 設定 | 例外経路 |
|---|---|---|---|
| Dependabot version updates | **既定で効く**。公開から3日待つ（2026-07-14 から） | `dependabot.yml` の `cooldown` で期間変更・無効化 | security updates は待たずにすぐ PR を作る |
| pnpm 11 以降 | **既定で効く**。11.0.0（2026-04-28）で `minimumReleaseAge` が既定 1440 分（1日）になった。2026-10-26 時点の公式ドキュメント（pnpm 12 系が現行）でも既定は 1440 分 | `pnpm-workspace.yaml` の `minimumReleaseAge` で延ばす。0 で無効 | `minimumReleaseAgeExclude`。`pnpm audit --fix` は修正版をここへ自動で足す |
| npm 10（Node 22 同梱は 10.9.9） | 効かない | `--before`（日付指定）のみ。日数指定の設定は無い | — |
| npm 11（Node 24 同梱は 11.19.1、Node 26 同梱は 11.20.0） | **明示設定が要る**（`min-release-age` の既定は null） | `.npmrc` の `min-release-age`（日数。11.10.0 以降） | `min-release-age-exclude`（11.17.0 以降） |
| npm 12 | **明示設定が要る**（既定は null） | 同上 | 同上 |
| Renovate | プリセット次第。`config:best-practices` は npm に3日（`security:minimumReleaseAgeNpm`）を含む | `minimumReleaseAge` | `packageRules` で個別に変える |
| uv | **明示設定が要る**（`exclude-newer` の既定は無し） | `exclude-newer`。日時のほか `7 days` や `P7D` のような期間も書ける | `exclude-newer-package` で個別に `false`（対象外）にする |
| pip | **明示設定が要る** | `--uploaded-prior-to`（26.0 で追加。26.1 から `P3D` のような期間も書ける） | — |

- 待機は修正版の取り込みも止めうる。npm は `min-release-age` のせいで `npm audit fix` が修正版を入れられないとき、警告して非0で終了する。例外経路を先に用意する。
- Dependabot の security updates が即時でも、パッケージマネージャ側の待機で install が止まらないかを確かめる。

## 2. install script（ライフサイクルスクリプト）

原則: 依存の install script は拒否を既定にし、必要なものだけ許可リストに載せる。ネイティブビルドが要るパッケージ（node-gyp を使うものなど）は個別に許可する。
なぜ: postinstall などは install した瞬間に任意のコードを実行できる。CI では secrets やトークンにも届く。

| ツール | 既定で拒否するか | 設定 |
|---|---|---|
| pnpm | **既定で拒否**。10.0.0（2025-01-07）から依存のライフサイクルスクリプトを実行しない。11.0.0 で `strictDepBuilds` が既定 true になり、`allowBuilds` に無い build script があるとエラーにする | 許可は `allowBuilds`（11.0.0 で旧設定 `onlyBuiltDependencies` などを置き換えた） |
| npm 12 | **既定で拒否**。12.0.0（2026-07-08）から、ルートの `allowScripts` で許可していない依存のスクリプトをブロックする | `npm install-scripts approve` で承認を記録し、`npm rebuild` で実行する。`strict-allow-scripts=true` で、未レビューがあると install を失敗にする |
| npm 11 | **拒否しない**。`allowScripts` はあるが、未レビューのスクリプトは通知付きで実行される | `strict-allow-scripts=true`（未レビューがあると失敗）か `ignore-scripts=true` |
| npm 10 | **拒否しない** | `ignore-scripts=true` |

- `ignore-scripts=true` は依存だけでなく、自分の package.json のライフサイクルスクリプトや、`npm run` の pre/post スクリプトも止める。ビルド手順が壊れないか確かめる。
- npm 12 は git 依存と URL 指定の tarball 依存も既定で拒否する（`allow-git` / `allow-remote` の既定が `none`）。使うなら `.npmrc` で明示的に許可する。

## 3. lockfile と frozen install

- lockfile はコミット必須にする。CI は lockfile を書き換えないインストールにする: `npm ci` / `pnpm install --frozen-lockfile` / `uv sync --locked`。
  なぜ: CI が lockfile 外の版を解決すると、レビューしていない依存が入る。
- npm 12 は `npm-shrinkwrap.json` を読まなくなった。使っている案件は `package-lock.json` に改名する。

## 4. パッケージの公開（Trusted Publishing）

パッケージを公開する案件では、publish を Trusted Publishing（OIDC）にし、長期の publish トークンを残さない。

- **npm**: Trusted Publishing は npm CLI 11.5.1 以降が要る。GitHub Actions / GitLab CI から公開すると provenance が既定で付く。classic token は 2025-12-09 に全廃された。granular token の write 権限は最長 90 日。
- **PyPI**: Trusted Publishing では CI の OIDC トークンを、15 分だけ有効な API トークンに交換する。`pypa/gh-action-pypi-publish` は Trusted Publishing のとき、デジタル attestation を既定で生成してアップロードする。

## 5. GitHub Actions

- **SHA ピンの強制**: allowed actions policy のチェックボックスで、SHA ピンを enterprise / organization / repository の単位で強制できる（2025-08-15 から）。pin していない action を使う workflow は失敗する。同じポリシーで、`!` を付けた項目は特定の action や版をブロックする。
- **pin の機械化**: pin と更新は手作業にしない。例: Renovate の `helpers:pinGitHubActionDigests`（`config:best-practices` に含まれる）。
- **workflow lockfile**: `.github/workflows/actions.lock` に、action とその推移的な依存、再利用 workflow の commit を記録する（`gh actions-lock` 拡張で作る）。2026-10-14 に public preview になった。採用は任意。lock しても依存そのものが安全かは判定しないので、lock する前に中身をレビューする。
- **pull_request_target / workflow_run**: 特権のあるトリガーで、ベースリポジトリの secrets・書き込み権限・main ブランチと同じキャッシュを使える。fork の PR を checkout すると乗っ取られる。原則使わない。使うなら fork の head を checkout しない、secrets と書き込み権限を渡さない。
- **execution protections**（2026-09-17 GA）: 誰が（actor rule）、どのイベントで（event rule）workflow を起動できるかを許可リストで決める。workflow ファイル単位で絞れ、evaluate mode で影響を先に見られる。REST API で enterprise / organization / repository の単位で管理できる。
  - GitHub は pull_request_target を無効にする既定ルールを入れたが、対象は event policy の無い **public リポジトリだけ**。private / internal には効かない。受託で多い private リポジトリでは event rule を自分で設定する。
  - public リポジトリでの自動強制の予定日は 2026-12-02（2026-10-21 に更新された日付）。
- **非信頼値は env 経由で渡す**: `${{ github.event.pull_request.title }}` などを `run:` に直接埋め込まず、中間の環境変数にしてから参照する。`run:` に式を直接書くと、値がシェルスクリプトの一部として組み込まれ、スクリプトインジェクションになるため。
- **静的検査**: workflow を actionlint / zizmor で検査する。新しく入れるときは警告のみで始め、誤検知を確かめてから必須チェックにする。
- **Immutable Releases**（2025-10-28 GA）: 有効にすると、公開後のリリースのアセットと Git タグを変更・削除できなくなり、リリースの attestation も付く。GitHub Releases でバイナリを配布する案件（Tauri など）で有効化を検討する。

## 出典（確認日 2026-10-26）

- Dependabot の既定クールダウン: https://github.blog/changelog/2026-07-14-dependabot-version-updates-introduce-default-package-cooldown/
- pnpm 11.0.0: https://github.com/pnpm/pnpm/releases/tag/v11.0.0 / pnpm 10.0.0: https://github.com/pnpm/pnpm/releases/tag/v10.0.0 / 公式ドキュメント: https://pnpm.io/supply-chain-security
- npm 12.0.0: https://github.com/npm/cli/releases/tag/v12.0.0 / npm 11.10.0（`min-release-age`）: https://github.com/npm/cli/releases/tag/v11.10.0 / npm 11.17.0（`min-release-age-exclude`）: https://github.com/npm/cli/releases/tag/v11.17.0
- npm の設定（11 / 12）: https://docs.npmjs.com/cli/v11/using-npm/config / https://docs.npmjs.com/cli/v12/using-npm/config
- Node 同梱の npm の版: https://nodejs.org/dist/index.json
- Renovate: https://docs.renovatebot.com/configuration-options/#minimumreleaseage / https://docs.renovatebot.com/presets-config/#configbest-practices
- uv: https://docs.astral.sh/uv/reference/settings/#exclude-newer
- pip: https://pip.pypa.io/en/stable/news/
- npm Trusted Publishing: https://docs.npmjs.com/trusted-publishers / classic token の全廃: https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
- PyPI Trusted Publishing: https://docs.pypi.org/trusted-publishers/ / attestation の既定: https://github.com/pypa/gh-action-pypi-publish
- SHA ピンの強制: https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/
- workflow lockfile: https://github.blog/changelog/2026-10-14-github-actions-workflow-lockfiles-in-public-preview/
- execution protections: https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/
- 非信頼値と pull_request_target: https://docs.github.com/en/actions/reference/security/secure-use
- Immutable Releases: https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/
