# Claude Code での実行ノート（ai-search-visibility）

このファイルは cc-plugins が所有する。SKILL.md は codex-plugins の正本からの翻案で、同じスキルの他の references・assets・scripts は英語原文のコピー。判断規則・完了条件・証拠の区分の正本はそちらにあり、ここには Claude Code のツール環境に固有の扱いだけを書く。

## スキルの相互参照

- 同じプラグインのスキルは `indie-product-marketing:<skill>` の名前で参照する。
- AI の回答をチャネルとして追うかどうか、何を activation と定着の指標にするかは、`indie-product-marketing:indie-product-marketing` で決める。
- LP の設計・実装・ローカライズは `indie-product-marketing:global-landing-design` が担当する。
- references が「`indie-product-marketing` skill の `references/ethics-and-compliance.md`」と書いている箇所は、[../../indie-product-marketing/references/ethics-and-compliance.md](../../indie-product-marketing/references/ethics-and-compliance.md) を指す。

## Web の証拠

- WebFetch は、小型モデルによるページの要約を返す。運営者の文書の文言、数値、条番号、規約の文言は、生のソース（curl で取得した本文、ブラウザ MCP のページテキスト）で照合する。照合できなければ、台帳の該当行に「要約経由・未照合」と書く。
- JavaScript で描画されるページは、curl では本文が取れない（例: Bing Webmaster Guidelines）。ブラウザ MCP で描画後のテキストを読む。
- 自動の取得を拒否するサイト（例: Reddit の規約とヘルプ）は、別の取得手段で回り込まない。ユーザーに開いて確かめてもらうか、未照合と記録する。
- WebSearch は US-only で動く。日本の規制は、`off-site-rules.md` に載っている消費者庁の URL を直接取得して、現行の文言を確かめる。
- `engine-eligibility.md` の各行は取得日つきの記録である。判断がその行に依るときは、運営者のページを取り直し、URL と取得日を証拠台帳に記録する。

## 適格性の確認

- `robots.txt`、HTTP ヘッダ（`X-Robots-Tag`）、ページの meta robots は、curl で読める。
- User-Agent をクローラの名前にして取得しても、CDN や WAF は送信元の IP で判定することがあるので、「クローラが通る」ことの証明にはならない。参考として扱い、確実な確認は CDN のルールかサーバーのログで行う。
- ユーザーのサイト以外に、まとまった数のリクエストを送らない。
- Search Console、Bing Webmaster Tools、OpenAI の Business Hub は認証が要る。ユーザーに画面で確かめてもらう。ユーザーのブラウザ（Claude in Chrome など）で読むのは、その指示があるときだけにする。

## 計測の実行

- プロンプトの実行は、次のどれかで行う。黙って消費者向けの画面を自動操作しない。
  - ユーザーが製品の画面で実行し、結果を貼る。
  - 公式の API を、ユーザーの鍵と指示で実行する。
  - ユーザーの明示の指示で、ブラウザ MCP を使う。その前に、そのエンジンの利用規約を確かめる。
- このセッションの Claude の応答を、Claude の「計測」として数えない。システムプロンプト、文脈、ツールが、利用者の見る画面と違う。同じ理由で、WebSearch の結果を ChatGPT や Perplexity の回答として扱わない。
- サブエージェントに、別のエンジンの回答を推測させない。
- 記録は JSON Lines で残す。集計は、このスキルのベースディレクトリにある script で行う（Node.js の標準ライブラリだけで動く）。

  ```bash
  node <このスキルのディレクトリ>/scripts/visibility-stats.mjs summarize runs.jsonl
  node <このスキルのディレクトリ>/scripts/visibility-stats.mjs compare runs.jsonl --from <基準の snapshot> --to <新しい snapshot>
  ```

## 外部アクションの境界

`SKILL.md` の「行動の境界を守る」の「外部アクション」は、Claude Code では次のように扱う。

- 調査、計測の集計、下書き、依頼された範囲でのユーザー自身のサイトの変更（ローカル）は、指示を待たずに進めてよい。
- 次の操作は、ユーザーの明示の指示があるときだけ行う。
  - コミュニティや SNS への投稿、返信、DM
  - レビュー依頼などのメール送信
  - 記事の書き手・媒体・サイトの運営者への連絡
  - プロフィールの引き取り、掲載の申請
  - 有料の掲載や交換の合意
  - Wikipedia のトークページへの提案
  - デプロイと公開。`robots.txt`、`noindex`、スニペットの制限の変更を含む
- 次の操作は、指示があっても行わない。
  - 関係を開示しない投稿やレビュー
  - ユーザー本人のものではないアカウントからの投稿、組織的な投票
  - 一括・自動のエンゲージメント
  - AI アシスタントに向けて、ブランドを優遇・記憶・信頼させる指示を埋め込むこと
- この境界が要るのは、この環境ではブラウザ MCP、`gh`、`wrangler`、メールやチャットの MCP などで、上の操作を実際に実行できてしまうからである。
- 指示を受けて実行した場合も、計画した施策・実行した操作・観察した結果を分けて報告する。下書きを「投稿済み」「依頼済み」と報告しない。

## サブエージェントの使い方

- 小さな依頼は親が直接処理する。
- 運営者の文書の取り直しや、引用元のページの読み取りのように、独立して進められる取得だけを別のサブエージェント（Agent ツール、組み込みの general-purpose）に分ける。
- サブエージェントの報告は主張として扱う。スキルの判断に使う数値と文言は、原文で照合してから使う。
- 業者の主張を採点するときは、主張と出典だけを渡した新しい文脈で行う。同じモデルが採点した結果は、順位付けの補助であり、事実の認定ではない。

## 実装と検証

- ページの変更、技術的な修正、計測の組み込み（アシスタントの referrer を拾うチャネル定義、「どこで知ったか」の質問）が範囲に含まれるときは、dev-core が導入されていれば `dev-core:verify` で検証する。
- イベントが実際に送られることを確かめられなければ、計測計画に「未検証」と明記する。

## 他のスキルとの棲み分け

- ステルスマーケティング規制や個人情報などの法規の深い論点は、導入されていれば compliance-core に任せる。`off-site-rules.md` は事前チェックリストであり、法的助言ではない。
- 他のプラグインの SEO 監査のスキルと併用してよい。AI の回答についての主張は、`evidence-base.md` の判定に照らす。
