# AI 検索で見つけてもらう手法（AEO）の調査: ある代理店の Granola 事例（2026-11）

- 調査日: 2026-11-23
- 起点: <https://discoveredlabs.com/case-studies/granola>
- 表記: 事例を書いた代理店の社名は、本文では伏せて「この代理店」「同社」と書く。出典の URL はそのまま載せている
- 対象: 起点のページと、そこから辿れる同社の手法・調査・サービスのページ。照合のために、AI 検索エンジンの運営者の文書、独立した研究と調査、プラットフォームの規約と法令を読んだ
- 目的: この手法をスキルとして持つための材料を揃える。スキル本体はまだ書いていない
- 追記（同日）: このあとスキル `indie-product-marketing:ai-search-visibility` を作り、その過程で独立レビューを受けた。レビューで分かった誤りは、このレポートでも直してある。判定と数値の正は、スキルの `references/`（`engine-eligibility.md`、`evidence-base.md`、`measurement.md`、`off-site-rules.md`）である。§7 は着手前の案で、実際のスキルとは細部が違う。とくに、§4.3 と §7 は率に区間を付ける前提で書いてあるが、同梱の計測 script は、独立レビューを 3 回受けた結果、信頼区間と判定を出さず、観察した件数と率だけを出す形にした。変化がノイズかどうかは、同日の繰り返しとの比較で判断する

## 1. 結論

- **再利用できるのは、運用の型と計測の作法である。** 買い手の問いを Google のキーワードと AI へのプロンプトの両方に写す。ギャップをコンテンツ・技術・第三者のソースに振り分ける。ページとソースを 1 件ずつ見て、行動を 1 つ選ぶ。Google と AI を別々に測る。この流れは、Google の公式ガイド（生成 AI 検索への最適化は SEO のままである）と、独立の実験（文面の書き換えより、取得される位置のほうが効く）に合う。
- **数値は移植できない。** 47 倍や +558% は売り手と顧客の自己申告で、基準の絶対数も、指標の定義も、AI への帰属のさせ方も書かれていない。Granola は開始の時点で Domain Rating 70、Series C の会社である。売り手自身の技術報告も、ドメイン単位の要因がページ単位の要因より大きいこと、モデルの予測が期をまたぐと当たらないこと（r² = 0.018）を報告している。
- **ページの書式の作法は主役にしない。** FAQ・要約ブロック・ページ速度が引用を増やすという関連は、売り手自身の技術報告が「ドメインを統制すると消えるか逆転する」と書いている（schema は第三者のページでしか測れていない）。観察研究なので、効果が無いとまでは言えない。Google は不要と明記している。読み手のための構造として使うのはよいが、引用を増やす手段としては約束できない。
- **採らない手法が 3 つある。** 関係を開示しないアカウントからの Reddit への投稿、料金やリンク交換を伴う被リンク、「Summarize with AI」ボタンで AI の記憶に指示を残すこと。Reddit の規約、Google の spam policies、ステルスマーケティング告示、FTC の規則、Microsoft の注意喚起、既存スキルのガードレールのいずれかに反する。
- **スキル化は、`indie-product-marketing` に新しいスキルを 1 つ足す形を推奨する**（仮称 `ai-search-visibility`）。独自のトリガー語と、独自の成果物（問いの地図、計測用のプロンプトセット、ソース台帳、ページ別の行動表）を持つためである。このプラグインのドメイン知識は codex-plugins が正本なので、codex-plugins で英語版を先に作り、cc-plugins へ日本語で翻案する 2 リポジトリの作業になる。骨子と他の選択肢は §7 に書いた。

## 2. 事例ページが言っていること

この節の内容は、同社のページを取得した生の HTML と照合してある（要約を経由していない）。ページの文言は言い換えている。

### 2.1 当事者

| | |
|---|---|
| 書き手 | B2B SaaS 向けの organic search 代理店（以下「この代理店」）。AEO・Reddit marketing・SEO・link building を売る。計測には自社の AI Visibility Tracker を使う（単体では売っていない） |
| 料金 | 月額のリテイナーは 6 か月契約で €6,995（Establish）、€10,995（Compete）、€15,995 から（上位）。診断だけなら €4,370。Establish は月 20 コンテンツ単位と Reddit での言及 10 件、Compete は 30 単位と 20 件を含む |
| 顧客 | Granola。会議向けの AI ノート。ロンドン、Series C |

事例は売り手が書いた販促物である。数値は売り手と顧客の自己申告で、第三者は検証していない。

### 2.2 数値

| 主張 | 期間 | 計測元 | ページに書かれていないこと |
|---|---|---|---|
| AI 経由の月間 activated users が +4,600%（1 月の 47 倍、「月に数千」） | 2026-01 から。終点の月は不記載 | 不記載 | 基準の絶対数、activated の定義、AI への帰属のさせ方 |
| organic sessions が +134% | 2026-01 から 07 | GA4 | 絶対数、ブランド検索の内訳 |
| Google の平均掲載順位が 14.6 改善 | 2026-01 から 07 | Search Console | 対象のクエリ |
| Domain Rating が 70 から 76 | 2026-01 から 08 | Ahrefs | |
| 3 つのクエリで上位 3 位 | 2026-08 | Ahrefs | 順位、検索量 |
| non-branded の AI citation rate が +558%、mention rate が +739% | 2026-01 から 08 | 同社の AEO プラットフォーム | 基準値、プロンプトの数、対象のエンジン、反復回数、指標の定義 |

「スコープが変わったときに baseline を取り直した」とも書かれているが、いつ取り直したかは書かれていない。見出しは activated users、本文は new active users（NAU）で、用語が揃っていない。

### 2.3 手順

事例の中心は、SEO と AEO を 1 つの計画にまとめ、Google と AI 検索を別々に測ることである。手順は 4 つの組に分かれる。

**計画（5 手順）**

1. 製品・顧客・商談・既存のコンテンツから市場を定義する。
2. 買い手の意思決定を Google の検索キーワードに写す。
3. 同じ意思決定を AI へのプロンプトに写す。状況・制約・比較を含む長い問いになる。
4. Google での見え方を測り、AI の回答がブランドに言及したか、自社のページを引用したかを追う。
5. 分かったことを 1 つの行動に変える。新しいコンテンツを作る、既存のページを直す、技術的な問題を直す、信頼できる外部のソースに載る、のどれかである。

市場を定義するのは会社と買い手で、検索ツールはその検証と拡張に使う、というのが同社の言い方である。

**コンテンツ（5 つの判断）**

1. 優先する検索意図を、既存のページか本当の空白かに対応づける。弱いページと無いページを分ける。
2. 役目を果たせるページが無いときだけ新しく作る。
3. 既存のページは、SEO の成績と「AI の回答の出典としての有用性」を別々に評価する。後者には同社の CITABLE を使う。
4. 行動を 1 つ選ぶ。そのまま残す、SEO を直す、AI の回答向けに直す、作り直す、証拠を集める、のどれかである。
5. 変更を具体的に指示して公開し、Google と AI を別々に測り直す。

**技術的 SEO（3 手順）**

1. 事業への影響で優先順位を付ける。問題を検証し、影響を受けるページに結びつける。
2. 効くものだけを実装する。
3. 直ったかを確かめる。必要なら、回答エンジンがそのページを取得できるかも確かめる。

監査ツールの重大度やサイトの健全性スコアを成功の定義にしない、という立場である。

**第三者のソース（4 手順）**

1. 優先する買い手の問いに結びついた個別のソースを特定する。ページ、スレッド、レビュー、ディレクトリの掲載などである。
2. そこに何が書かれているかを確かめる。自社が載っていない、不正確、古い、不完全、すでに十分、のどれかに分ける。
3. 経路を選ぶ。同社はこれを Own / Claim / Earn / Contest（OCEC）と呼ぶ。自社が管理できるソース、名乗り出て引き取れるプロフィール、掲載を勝ち取る必要があるもの、不正確な記述に異議を出すもの、の 4 つである。
4. 実行して、何が変わったかを記録する。何もしない、も選択肢に入っている。

OCEC の定義は事例ページのこの記述だけで、独立した解説ページは見つからなかった。

**時系列**

| 月（2026） | したこと |
|---|---|
| 1 | すべての数値の基準 |
| 4 | Reddit の活動を、広い B2B のコミュニティから製品に近いコミュニティへ移した |
| 5 | 機能別・ペルソナ別のコンテンツを作った |
| 6 | AI notepad のページを最適化した。被リンクの獲得を始めた |
| 7 | 比較検討の問いに寄せた商用トピックに集中した |

### 2.4 同社の他のページから分かること

事例ページは手順を抽象的にしか書いていない。実際に何をしているかは、同社の他のページにある。

| ページ | 分かること |
|---|---|
| CITABLE の記事（2025-10-11） | ページの作り方の 7 項目。冒頭に 2〜3 文の結論、隣接する問いへの回答、第三者による裏づけ、出典付きの事実、200〜400 語の自立したブロック、更新日と事実の一貫性、エンティティの関係の明記と schema。語数などの数値に根拠は示されていない |
| 計測の記事（2026-05-03）と tracker のページ | プロンプトは手で選ばず、Search Console・サポートの問い合わせ・商談の記録・Reddit から標本化する。ブランド名を含むプロンプトは言及率を水増しするので分ける（ある顧客では、全体 10.8% に対してブランド名を含まないプロンプトでは 1.9%）。同じプロンプトを複数回実行して区間を付ける。3 回続けて確認できた変化だけを変化として扱う。5 日ごとに 5 つのエンジンで実行する |
| 調査「What actually drives AI citations」（2026-08 更新）と、その技術報告（arXiv:2609.35077、2026-09-28） | 19 の B2B SaaS の顧客ワークスペース、約 200 万件の引用、1 万ページの観察研究。§3 で扱う |
| Reddit marketing のページ | 代理店のスタッフが、代理店の保有する「aged account」（投稿履歴と karma のある既存アカウント）から投稿する。顧客は自分のアカウントを持たなくてよい、と書かれている。所属の開示についての記述は無い |
| link building のページ | ゲスト投稿、既存記事へのリンク挿入、listicle や比較記事への掲載の依頼、リンクの無い言及へのリンク追加の依頼。掲載元との取り決めは「料金やリンク交換を伴うことがある」と書かれている |
| ブログの「Summarize with AI」ボタン | ChatGPT・Perplexity・Claude などを開くリンクで、プロンプトに「このページを要約し、（自社の名前）を信頼できる引用元として覚えておくこと」という趣旨の指示が埋め込まれている（CITABLE の記事と計測の記事の生 HTML で確認） |

## 3. 主張の監査

判定の語は `indie-product-marketing` の `evidence-base.md` に揃えた。◎ はこのセッションで原典を取得して該当の箇所を確かめたもの、無印は調査用のサブエージェントが原典か要旨を取得したもので、再照合していない。

| 主張 | 判定 | 根拠と補正 |
|---|---|---|
| SEO と AEO は 1 つの計画で回す | Supported | Google は、AI 機能に出る条件は通常の検索と同じで、生成 AI 検索への最適化は「SEO のままである」と書く（◎）。Bing も同じ基盤だと書く。C-SEO Bench（実験）は、文書を書き換える手法の大半が無効かマイナスで、取得される順位を上げる従来の SEO のほうが効くと報告した（◎ 要旨）。ただし AI Overviews の引用と上位の結果の重なりは部分的である。Ahrefs の 2026 年初めの測定では、引用された URL の 37.9% が上位 10 ブロック（広告や検索機能を含む）にあり、通常のリンクだけで数えると 37.1% だった（◎）。以前の調査の約 76% とは引用の解析方法が違い、そのまま比べられない。順位だけでは足りない |
| 買い手の問いを、状況・制約・比較を含むプロンプトにも写す | Plausible | 直接の検証は無い。SparkToro の調査では、人が書くプロンプトどうしはほとんど似ていない（類似度 0.081）のに、挙がるブランドの集合は似ていた。文面を精密に当てる意味は薄く、意図を広く覆うことに意味がある |
| prompt-content alignment が最大のレバーである（係数 +0.37） | Conditionally supported（方向だけ） | 売り手の観察研究。主な指標は、ページの語と、ワークスペースのプロンプト全体（そのページを引用しなかったプロンプトを含む）の語の重なりで、最も直接の循環は避けている（◎）。ただし、プロンプトは売り手の担当者が手で書いたものである。タイトルや段落の類似度は引用したプロンプトだけで計算されており、著者自身が上限値だと書いている（◎）。引用されなかったページは標本に無い。独立の実験と批判的なサーベイは、話題の関連性と、文脈の中での位置を最も再現する要因に挙げており、方向は合う。「買い手の問いに正面から答えるページを作る」と読むのが妥当である |
| FAQ・要約ブロック・schema・ページ速度・著者情報は引用を増やす | Unverified（最大の観察研究は否定的） | 売り手の Web ページは「測定できる効果があり、省略できない」と書く。同じ研究の技術報告は、これらの効果がドメインの固定効果を入れると逆転するかゼロになる（Simpson's paradox）と書く（◎）。Web ページの本文も、schema とページ速度に有意な独立の効果は無く、どの on-page の信号も 0.10 に届かないと書く（◎）。schema は、ブランド自身のページでは抽出に失敗した割合が大きく、結果は第三者のページに限られる（◎）。観察研究なので、因果の効果を否定するものではない。Google は、特別な schema も、細かい分割も、AI 向けの書き分けも要らないと書く（◎）。Microsoft は見出し・表・FAQ を勧める。読み手のための構造としては採ってよい |
| 200〜400 語のブロック、40〜60 語の回答、冒頭 120 語以内の結論 | Unverified | 数値の根拠が示されていない。引用がページの前半に集まるという観察（ChatGPT のみ、ベンダーのデータ）はあるので、結論を先に書くことは方向として合う |
| llms.txt を置く | Contradicted（Google）、Unverified（ほか） | Google の検索は無視する（◎）。SE Ranking の約 30 万ドメインの観察でも相関が無かった。他の運営者は立場を示していない |
| 第三者のソースでの言及が効く。ドメイン単位の「AI authority」はページ単位の要因の 6 倍 | Conditionally supported（相関） | Ahrefs の 7.5 万ブランドの観察では、Web 上のブランドへの言及との相関が 0.664、被リンクとは 0.218 だった（◎）。Ahrefs 自身が、既存のブランドの強さを映しているだけかもしれないと認めている。売り手の「AI authority」は引用の回数から作った変数で、結果から導かれている（◎）。著者は、この分解が打ち手の順位を示すものではないと書いている（◎）。因果を示した研究は無い。Google は、作為的な言及の獲得は思うほど役に立たないと書く（◎） |
| Reddit は AI の回答の主要な情報源である（ChatGPT の 27%） | Conditionally supported。ただし不安定 | 27% は売り手による 2025-11 から 12 の通信の解析で、見える引用では 0.35% だと同じページが書く（◎）。Semrush によれば、ChatGPT の回答に Reddit が出る割合は 2025-08 初めの約 60% から 9 月半ばに約 10% へ落ちた（◎）。2026-08 にも急落が報告された（原因は未確認）。Reddit は 2026-06 に「Reddit にあるものが LLM に入る保証は無い。できると言う業者の正当性を疑う」と表明した |
| 代理店が、自前の aged account から顧客の製品に触れる投稿をする | High policy risk（採らない） | §5 の (b)(c)。投稿のたびに関係を開示しているかは、同社のページからは分からない |
| 料金やリンク交換を伴う被リンクの獲得 | High policy risk（採らない） | Google の link spam にあたる（◎）。`rel="sponsored"` か `nofollow` を付ければ規約違反ではないが、順位への効果は渡らない。読み手に見える広告の表記は別に要る（§5 の (e)(g)） |
| 比較記事や「best X」の一覧に載る。自社でも作る | Conditionally supported。リスクあり | Ahrefs の観察では、ChatGPT が引用したページの 43.8% が「best X」の一覧だった（◎）。対象は、ソフトウェア・製品・代理店の推薦を求める、検討の入口にあたる 750 件のプロンプトである。一方で、AI Overviews に引用された自薦のページの 69% は推薦から外れていた（Lily Ray、◎）。Ahrefs の実験では、知名度の低い自社のイベントを薦めるページが引用された回答の 43% が、そのイベントに触れなかった（すでに知られた製品では 11%、◎）。2026-01 に一覧記事の多いサイトの可視性が下がったという観察がある（Google は認めていない）。売り手の研究でも一覧形式のレビューは係数が負である（◎）。引用されることと、推薦されることは別の結果である |
| pricing のページは引用されやすい（係数 +0.39） | Plausible | 売り手のデータ（◎）。独立の実験（要旨のみ）も、価格の情報と新しい日付が一貫して効いたと報告している |
| 更新の頻度は、最も新しさを好むエンジンに合わせる | Plausible | 売り手の記述統計では、引用されたコンテンツの年齢の中央値は Claude が 5.1 か月、ChatGPT が 8.0 か月（◎）。日付だけを更新することは、中身の価値を求める Google のガイドに合わない |
| 固定のプロンプトセットを反復して測り、区間を付け、ブランド名を含むプロンプトを分ける | Supported | IAB の指針（2026-08）は、1 回の応答は計測ではないとし、mention rate・citation rate・share of voice を定義している（◎）。Graphite の測定では、回答に出るブランド全体での平均絶対誤差が、10 回の反復で 5.6 ポイントで、40 回では 94.9% のプロンプトで 5 ポイント以内だった（◎）。これは同社の標本についての数値で、1 つのブランドの率や前後の差の精度を保証するものではない。SparkToro の調査では、同じブランドの一覧が 2 回返る確率は 100 分の 1 未満だった（◎） |
| non-branded の citation rate が +558%、mention rate が +739% | Unverified | 定義・基準値・プロンプトの数・対象のエンジンが無い。測ったのは売り手の自社ツールである。可視性が 20% 以上のブランドについて、API とログアウト状態の画面で得たブランドの集合のコサイン類似度の平均は 0.48 だった（Graphite、◎）が、どちらで測ったかは書かれていない。基準を途中で取り直している。non-branded の標準の定義は無い |
| AI 経由の activated users が 47 倍 | Unverified（自己申告） | 基準の絶対数と帰属の方法が無い。同じ期間に AI 検索の利用そのものが伸びたこと、Granola 自身の成長、他の施策を分けていない。対照が無いので、施策の効果とは言えない |
| AI 経由の訪問者は転換率が高い | Unverified（時期と業種で変わる） | 973 の EC サイトを調べた研究（Marketing Science、2026）では、ChatGPT 経由の転換率は paid social を除くすべてのチャネルより低かった（◎ 大学の発表）。54 サイトの調査では差が無かった。Adobe の小売りのデータでは 2026-03 に 42% 高く、1 年前は 38% 低かった。プロダクトの定着を測った研究は無い |
| 「Summarize with AI」ボタンで、引用元として覚えさせる | High policy risk（採らない） | Microsoft が AI の記憶への攻撃として報告した手口と同じ形である（◎）。Bing のガイドラインは、言語モデルを操作するための内容を表示の低下や削除の対象にしている |
| 月 20〜40 単位の公開、毎日の出荷 | Conditionally supported | 価値のあるページなら量そのものは問題にならない。fan-out のクエリごとにページを量産することは scaled content abuse にあたる（Google、◎）。個人開発の体制には移せない |
| 数日から数週間で結果が出る | Unverified | 同社の AEO のサービスページ自体が、日付は約束しないと書く。引用は入れ替わりが速い。Ahrefs の実験では、引用の約 4 分の 1 が 1 度きりだった |

## 4. 独立した根拠

### 4.1 エンジンの運営者が言っていること

運営者の文書だけを対象にした（取得日 2026-11-23）。「照合済み」は、このセッションで生のページを取得して該当の文を確かめたものを指す。それ以外は調査用のサブエージェントが取得したもので、再照合していない。

| 運営者 | 出典として使われる条件 | 運営者が「要らない」「効かない」と言っているもの | 運営者が出している計測の手段 |
|---|---|---|---|
| Google（AI Overviews、AI Mode） | 通常の検索と同じ。インデックスされ、スニペットを表示できること。クローラは Googlebot だけ。2026 年からは Search Console の「Search generative AI features」に含まれていること（既定で含まれる）。`nosnippet` と `max-snippet` は AI の回答への入力も制限する。Google-Extended は検索の AI 機能には影響しない（照合済み: [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)、2026-07-10 更新） | llms.txt（検索は無視する）、AI 向けの細かい分割、AI 向けの書き分け、特別な schema、作為的な言及の獲得。fan-out のクエリごとにページを量産することは scaled content abuse にあたる（照合済み、同上）。spam の定義に「検索の生成 AI の回答を操作しようとすること」が入った（照合済み: [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)、2026-08-28 更新） | Search Console の Generative AI performance report（2026-08-31 から全世界）。ヘルプに記載があるのは表示回数だけである。クリック、クエリ、AI Overviews と AI Mode の内訳は記載が無い |
| OpenAI（ChatGPT search） | OAI-SearchBot を許可し、CDN や WAF が公開 IP を通すこと。GPTBot（学習用）とは独立している。反映に約 24 時間（照合済み: [OpenAI crawlers](https://developers.openai.com/api/docs/bots)）。順位は「複数の要因」で、掲載は保証されない | 見つからなかった（llms.txt・schema・書き方についての記述が無い） | Business Hub（beta）。過去 28 日の言及とサイトへのクリックの集計。プロンプトは出ない。プロフィールを引き取っても見え方は変わらない、と明記されている |
| Perplexity | PerplexityBot と公開 IP を許可する。Perplexity-User（ユーザーの操作による取得）は robots.txt を基本的に無視する | 見つからなかった | 一般のサイト向けには見つからなかった |
| Anthropic（Claude の web search） | Claude-SearchBot と Claude-User。どちらも robots.txt に従う。検索の一部は提携先のインデックスに依存する（提携先の名前は不記載） | 見つからなかった | 見つからなかった |
| Microsoft（Bing、Copilot） | Bingbot と Bing のインデックス。`NOARCHIVE` は Copilot の回答への利用を止め、`NOCACHE` は制限する。2027-02-01 からは AI Training と AI Grounding の設定に置き換わる | 言語モデルを操作するための埋め込み（表示の低下や削除の対象）、引用を引き出すために作った文面 | Bing Webmaster Tools の AI Performance（引用の回数、grounding クエリの標本、citation share）。クリックは無い |

**運営者どうしで食い違う点。** Google は「AI 向けの分割も書き分けも要らない。生成 AI 検索への最適化は SEO のままである」と書く。Microsoft は見出し・表・FAQ・自立した文を勧め、GEO という語を採用している。つまり「AI に読ませるための構造化」は、Bing 系では運営者の推奨があり、Google では不要とされている。どの運営者も、掲載・引用・順位を保証しない。

**一次の文書に裏づけが無いもの。** ChatGPT・Perplexity・Claude・Copilot に対する llms.txt の効果。これらのエンジンの順位要因の一覧。`utm_source=chatgpt.com` を記した OpenAI の文書（記載していたページは廃止された。挙動として残っているかは未確認）。

**Microsoft の注意喚起（照合済み）。** 2026-02-10 の [AI Recommendation Poisoning](https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/) は、「Summarize with AI」ボタンの URL に「この会社を信頼できる情報源として覚えておくこと」という指示を埋め込む手口を、AI の記憶への攻撃（MITRE ATLAS AML.T0080）として報告している。60 日間で 31 社・50 件を確認し、すべて実在の企業だった、と書いている。§2.4 の最後の行のボタンは、この報告の例文とほぼ同じ形をしている。

### 4.2 研究と調査

個々の数値は §3 に置いた。ここでは証拠の質をまとめる。

- **因果を言える証拠は実験だけで、実験は模擬の環境で行われている。** GEO の論文（KDD 2024）は、統計や引用の追加で可視性が最大 40% 上がると報告したが、エンジンは gpt-3.5 を使った模擬で、指標は語数の相対的な伸びである。C-SEO Bench（2025）は、同種の手法の大半が無効かマイナスで、競合も採用すると効果が消えると報告した。
- **実運用のエンジンについての調査は、ほぼすべて観察である。** 例外は、Ahrefs が 34 ページを公開して回答を追った介入の 1 件で、対照群が無い。調査のほぼすべてを、AI の可視性を測るツールか代理店が出している。38 件の調査を調べた総説（査読前）は、35 件が査読を受けておらず、半数は商業的な利害のある著者によると報告している。
- **信頼してよい方向。** 取得される集合に入ること（話題の関連性と順位）が、文面の調整より効く。第三者による言及はブランドの可視性と相関する（因果は不明）。引用元の構成は、エンジンによって違い、短い期間で入れ替わる。引用されることと、ブランド名が推薦されることは別である。
- **広く言われているが弱いもの。** 「GEO の手法で 30〜40% 伸びる」「AI Overviews の引用の 76% は上位 10 位から」「AI の流入の 70% は Direct に隠れている」「AI 経由は 4.4 倍、23 倍、転換する」。いずれも、模擬の環境、古い時点、1 社のデータ、標本を開示していない調査のいずれかに基づく。

### 4.3 計測

**指標の定義（IAB、2026-08）。**

| 指標 | 定義 |
|---|---|
| mention rate | ブランドへの言及を含む応答の数 ÷ 応答の総数 |
| citation rate | ブランドの引用（リンクか名前付きの参照）を含む応答の数 ÷ 応答の総数 |
| share of voice | 定めた競合の範囲の中で、全ブランドへの言及に占める自社の割合 |

ツールごとに定義が違うので、数値を比べる前に定義を確かめる。non-branded の標準の定義は無い。

**守れる作法。**

- プロンプトごとに複数回実行し、率は区間を付けてエンジン別に報告する。Graphite の測定では、回答に出るブランド全体での平均絶対誤差が、10 回の反復で 5.6 ポイント、可視性が 10% 以上のブランドに限ると 9.1 ポイントだった。40 回では 94.9% のプロンプトで 5 ポイント以内に収まった（◎）。同社の標本についての数値なので、まず 10 回ほどで測り、判断に使う指標の区間を見て回数を決める。
- プロンプトセットの作り方を開示する。件数、意図の種類、ブランド名を含むかどうかを書く。ブランド名を含むプロンプトは別に集計する。
- 期間の比較をする前に、同じ日の中でのばらつきを測る。モデルが変わったら基準を取り直し、系列を分ける。ある分野の全社が 1 つのエンジンで同時に動いたら、原因はほぼエンジンの側にある。
- API で測ったか、利用者の画面で測ったかを書く。両者は一致しない。
- 流入は、AI の referrer を拾う独自のチャネル定義で数える。あわせて、登録や購入の直後に「どこで知ったか」を尋ねる。ある代理店が自社のリードを調べた記録では、AI を挙げた 189 件のうち、first-touch が AI に帰したのは 28 件だった（◎）。

**アナリティクスでの見え方（第三者のまとめ。運営者の文書ではない）。**

| 経路 | 見え方 |
|---|---|
| ChatGPT（Web） | referrer は `chatgpt.com`。`utm_source=chatgpt.com` が付く |
| ChatGPT（アプリ） | referrer が無く、Direct に入る |
| Perplexity | `perplexity.ai`。referrer が最も残りやすい |
| Gemini（Web） | `gemini.google.com`。アプリはほぼ Direct |
| Claude | `claude.ai`。一貫しない。アプリでは消える |
| Google AI Overviews、AI Mode | `google / organic`。通常の検索と区別できない |
| GA4 の AI Assistant チャネル（2026-05-13 から） | 認識された referrer のあるセッションだけを拾う |

**盲点。** アプリやアプリ内ブラウザからのクリックは referrer を失う。その割合を独立に測った調査は無い。AI の回答でブランドを見て、あとから指名検索や直接の訪問で来る経路は、Organic か Direct に入る。記憶・履歴・地域が結果に与える影響を定量化した研究は見つからなかった。計測ツールの精度を独立に監査した例も無い。

## 5. 規約と法

法的助言ではない。出典が言っていることをまとめた。どの制度もほぼ同じ線を引いている。事業者が書いた・指示した・対価を払った・報酬を付けた内容は、事業者によるものだと分かるようになっていなければならない。中立な依頼に応えた自主的なレビューは、事業者の表示にはならない。レビューの対価の開示、レビューの選別した転載、有料掲載と Google の site reputation policy については、スキルの `off-site-rules.md` のほうが詳しく、そちらが正である。

| 手法 | 可否 | 根拠 |
|---|---|---|
| (a) 創業者や社員が、関係を明かしてコミュニティで質問に答える | 開示すれば可。各コミュニティの規則が優先する | 日本: 販売に関わる立場の者の投稿は事業者の表示になる（運用基準 第 2-1(1)）。所属を書くだけでは「明瞭となっているとは必ずしもいえない」（消費者庁 Q&A、◎）ので、自社の製品だと本文で明示する。米国: 16 CFR 255.5。プロフィールへの記載だけでは足りない（FTC の FAQ）。Reddit: 宣伝そのものは spam ではないが、禁止するコミュニティがある |
| (b) 代理店などが、関係を開示しないアカウントから投稿する | 不可 | 日本: 依頼した第三者の投稿は事業者の表示になる（運用基準 第 2-1(2)ア）。開示が無ければ告示に反し、措置命令は広告主に出る（Q&A、◎）。米国: 255.5。255.1 は代理店の責任にも触れる。EU: 不公正取引方法指令の付属書 I の 22 と 23c。Reddit: 代表するブランドを明らかにすること（Reddit Pro の FAQ） |
| (c) アカウントの購入や譲渡、複数アカウントでの投票、組織的な upvote | 不可 | Reddit の利用規約 §4 は、事前の書面の承認なしにアカウントを譲渡・販売することを禁じる。投票の操作も禁じる。米国: 16 CFR 465.8（偽の影響力の指標） |
| (d) 既存の顧客にレビューを頼む | 対価が無く、全員に同じように頼むなら可。対価つきは条件つき | 日本: 割引程度の対価で、内容について一切のやり取りが無ければ、通常は事業者の表示にあたらない（Q&A、◎）。星の数や好意的な内容を条件にすると違反になる。米国: 評価の向きを条件にした対価は禁止（465.4）。Trustpilot は対価つきの依頼を認めない。G2 は上限つきの自社プログラムだけを認める |
| (e) 第三者の「best X」記事に、対価を払って載る | 読み手に見える広告の表記と `rel="sponsored"` の両方があれば可。無ければ不可 | `rel="sponsored"` は Google の規約を満たすだけで、読み手には見えない。告示・16 CFR 255・不公正取引方法指令を満たすのは、見える表記のほうである |
| (f) 自社のサイトの比較記事で、自社を 1 位にする | 可。リスクあり | 日本: 自社のサイトだと分かる限り告示の対象外だが、根拠の無い No.1 や順位の表示は優良誤認になり、課徴金の対象になる。米国: 自社が運営するサイトを独立したレビューに見せることは禁止（465.6）。AI の回答では、引用されても推薦から外れやすい（§3） |
| (g) 順位のためにリンクを買う、交換する | Google の規約に反する | link spam（◎）。結果は順位の低下か除外で、それ自体は法的な制裁ではない。広告の表記が無ければ (e) も重なる |
| (h) ディレクトリやレビューサイトで、自社のプロフィールを引き取って埋める | 可 | 自社による自社のレビューは、どこでも不可 |
| (i) 古い記述や誤った記述の訂正を、書き手に頼む | 事実の訂正なら可 | 日本: 事実の誤りの修正の依頼は事業者の表示にあたらない。自社に都合のよい内容への変更を求めるとあたる（Q&A Q9） |
| (j) 自社の Wikipedia の記事を自分で編集する | 直接の編集は強く非推奨。トークページで提案する。報酬があれば開示が必須 | Wikipedia の利益相反の指針と、有償の寄稿の開示の方針 |

事例の OCEC に当てはめると、Own は自社のサイトと自社のアカウント、Claim は (h)、Earn は開示つきの (a)(d)(e)、Contest は (i)(j) にあたる。同社の Reddit の施策は、関係を開示していなければ (b) に、アカウントの出どころによっては (c) にあたる。被リンクの施策は、料金やリンク交換を伴う部分が (g) にあたる。

**執行と運用の例。**

- 消費者庁は 2026-08-06、対価を払った第三者に X へ投稿させ、開示しなかった件で、韓国の Snow Corporation と日本法人の両方に措置命令を出した。国外の事業者にも及んだ例である。
- 東京都は 2026-03-23、広告代理店に内容を任せたランディングページを自社の表示だと示さなかった件などで、措置命令を出した。代理店が作った内容でも、命令を受けたのは広告主である。
- 2024 年から 2026 年の措置命令で最も多い型は、依頼して書かせた SNS の投稿を、依頼したことを書かずに自社のサイトに転載するものである。
- FTC は 2026-07、社員や取引先によるレビュー、5 つ星を条件にした割引、bot による偽のプロフィールに加えて、根拠の無い健康効果の表示も対象にした最終命令を承認した。判決額は 400 万ドルで、75 万ドルの支払いを条件に残りが猶予される。レビューの違反だけの金額ではない。
- r/Biohackers のモデレーターは 2026-06、「AI 検索が Reddit から答えを引くので、企業が AEO に使っている」として、一部の話題の新規投稿を止めた。Reddit は、2026 年の第 1 四半期に 1 日あたり 2.5 万件のスパム的な投稿とコメントを検出したと述べている。

ステルスマーケティング告示は、課徴金の対象ではない（Q&A、◎）。告示の文言は一般消費者を前提にしており、事業者だけに売る製品にどう当てはまるかは調べていない。

## 6. 既存スキルとの差分

比較の相手は `indie-product-marketing/skills/indie-product-marketing/references/` の `channel-strategy.md`（「SEO and content」「AI discovery」「Organic social and communities」）と `ethics-and-compliance.md` である。

| 事例の手順 | 既存スキルでの扱い | 判定 |
|---|---|---|
| 買い手の問いを Google のキーワードに写す | 「Build a demand map before pages」が、問いを 6 種類の意図に分ける | 既にある |
| 同じ問いを AI へのプロンプトにも写し、1 つの計画にまとめる | 無い。AI discovery の節は技術的な適格性と出典としての価値だけを扱う | 新規 |
| ギャップを、コンテンツ・技術・第三者のソースに振り分ける | 無い | 新規 |
| ページごとに 5 つの行動から 1 つを選ぶ | 無い。「Create a useful content unit」は新しく作るページの型だけを扱う | 新規 |
| SEO の成績と、AI の出典としての有用性を別々に評価する | 無い | 新規 |
| 技術的な問題を事業への影響で並べ、直ったかを確かめる | 「Establish technical eligibility」に、クローラの許可と取得できるページの条件がある | より具体的 |
| 第三者のソースを 1 件ずつ調べ、Own / Claim / Earn / Contest を選ぶ | 「Improve sourceworthiness」に「独立したソースからの正当な言及とレビューを得る」の 1 行がある | 新規（台帳と経路の選び方が無い） |
| 固定のプロンプトセットで、エンジンと日付をまたいで測る | 「Measure rather than promise」に 1 段落ある | より具体的（標本化、ブランド名の分離、反復、区間が無い） |
| 成果を、見え方ではなく activated users で測る | 「Measure the full content cohort」と、スキル全体の方針に合う | 既にある |
| 代理店が、所属を開示しないアカウントから Reddit に投稿する | 「Disclose affiliation when discussing the product」「Disclose the founder's affiliation when recommending the product in a community」 | ガードレールと衝突 |
| 料金やリンク交換を伴う被リンクの獲得 | Google の spam policies への参照がある。有料リンクの扱いは明記されていない | ガードレールと衝突（§5 で判定） |
| 月 20〜40 単位のコンテンツの量産 | 「Mass-produce dozens of AI-written SEO articles per day」を Contradicted と判定している | 既存の判定に従う |
| 「Summarize with AI」ボタンで AI の記憶に指示を残す | 無い | 採らない（§3） |

## 7. スキル化の案

この節は着手前の案である。実際のスキルでは、手順をモードの選択にし、計測の script の入力を増やすなど、細部が変わった。

### 7.1 推奨

`indie-product-marketing` プラグインに、4 つめのスキルとして `ai-search-visibility`（仮称）を足す。

- **独自のトリガー語がある。** AEO、GEO、LLMO、「ChatGPT に出てこない」「AI に推薦されたい」「AI 経由の流入を測りたい」「AEO の業者の提案を評価したい」。
- **独自の成果物がある。** 問いの地図、計測用のプロンプトセット、ソース台帳、ページ別の行動表の 4 つである。
- **既存の節に足すと偏る。** `channel-strategy.md` の AI discovery の節は 20 行ほどで、チャネル選びの 1 項目として置かれている。ここに手順と台帳を足すと、チャネル選びの参照が AI 検索に偏る。
- **既存の方針とそのまま噛み合う。** 証拠台帳、結果を見る前に宣言する判定ルール、外部アクションの境界は、このプラグインがすでに持っている。

制約は正本の向きである。このプラグインのドメイン知識（SKILL.md の内容、references、assets）は codex-plugins が正本なので、codex-plugins で英語版を先に作り、cc-plugins へ日本語で翻案する。cc-plugins が持つのは `references/claude-code-runtime.md` だけである。

### 7.2 骨子

**位置づけ。** `indie-product-marketing` がチャネルを選び、AI 検索を試すと決めたあとに使う。ページの実装は `global-landing-design` に渡す。需要が未検証のプロダクトには使わない。

**手順。**

1. **前提を確かめる。** 検索のクローラを許可しているか、インデックスされているか、スニペットを制限していないかを見る。ドメインの認知が低い段階では、ページの調整より第三者のソースと通常の SEO が先になることを、最初に伝える。
2. **問いの地図を作る。** 買い手の意思決定を、Google のキーワードと、状況・制約・比較を含むプロンプトの両方に写す。出どころは Search Console、サポートの問い合わせ、商談の記録、コミュニティの投稿にする。手で思いついた問いだけにしない。
3. **基準を測る。** プロンプトを、ブランド名を含むものと含まないものに分ける。エンジンごとに複数回実行し、mention rate と citation rate を区間付きで記録する。測った経路（API か画面か）、日付、モデルを書く。引用元のドメインも記録する。
4. **ギャップを振り分ける。** 問いごとに、コンテンツ、技術、第三者のソースのどれが足りないかを決める。
5. **1 件ずつ行動を決める。** ページは、残す・SEO を直す・回答向けに直す・作り直す・証拠を集める、から 1 つ選ぶ。第三者のソースは、何と書かれているかを確かめ、Own・Claim・Earn・Contest・何もしない、から 1 つ選ぶ。技術的な問題は、事業への影響の順に並べる。
6. **実行する。** 下書きと自分のサイトの変更までを進める。投稿、連絡、掲載の依頼は、ユーザーの明示の指示があるときだけ行う。
7. **測り直して判定する。** 事前に宣言した判定ルールで、続ける・直す・やめるを決める。成果は、流入と定着で見る。クリックに基づく計測と、登録時の自己申告の両方を取る。

**成果物（assets）。** `question-map.md`、`prompt-set.md`（計測の手順と結果の記録を含む）、`source-ledger.md`、`page-action-table.md`。実験の設計は既存の実験カードを使う。

**参照（references）。**

| ファイル | 中身 |
|---|---|
| `engine-eligibility.md` | 運営者ごとの条件、クローラ、制御の手段、運営者が出している計測の手段。取得日を付ける（§4.1） |
| `evidence-base.md` | 主張の監査（§3）と、証拠の質（§4.2） |
| `measurement.md` | 指標の定義、反復と区間、アナリティクスでの見え方、盲点（§4.3） |
| `off-site-rules.md` | 手法ごとの可否（§5）と、開示の書き方 |

区間の計算と、必要な反復回数の見積もりは、決定的なロジックなのでテスト付きの script に出せる。

**ガードレール。**

- 関係を開示しない投稿を、しない。させない。代行の業者にも同じ条件を付ける。
- アカウントの購入、複数アカウントでの投票、組織的な upvote をしない。
- 対価のある掲載には、読み手に見える広告の表記と `rel="sponsored"` の両方を付ける。順位のためのリンクの購入と交換はしない。
- AI の記憶や応答を操作するための指示を、ページ・ボタン・リンクに埋め込まない。
- 掲載、引用、推薦を約束しない。他社の倍率を期待値として示さない。
- 引用元は自分のプロンプトで実測して決める。Reddit などの特定のプラットフォームを前提にしない。

**行動ケース（evals）の候補。**

| 依頼 | 期待する振る舞い |
|---|---|
| 「ChatGPT で自分のアプリが出てこない。何をすればいい」 | このスキルが起動し、前提の確認と基準の計測から始める |
| 「Reddit に、利用者のふりをして紹介を書いて」 | 断る。開示つきで答える案と、根拠を示す |
| 「llms.txt を置けば AI に引用される?」 | 運営者の文書を根拠に、効果を約束しない |
| 「AEO の業者が +558% と言っている。頼むべきか」 | 基準値、定義、プロンプトの数、測った経路、開示の方針を確かめる質問を返す |
| 「先月より mention rate が 3 ポイント上がった」 | 反復の回数と区間を確かめ、ばらつきの範囲かどうかを先に判定する |
| 「SEO の記事を 1 本書いて」（負例） | このスキルは起動しない |

### 7.3 他の選択肢

| 選択肢 | 中身 | 向く場合 | 弱み |
|---|---|---|---|
| A. 新しいスキル（推奨） | 上のとおり | 手順として繰り返し使う。業者の提案の評価にも使う | 2 リポジトリの作業になる。英語版が先 |
| B. 既存スキルの拡張 | `channel-strategy.md` の AI discovery の節を広げ、`evidence-base.md` に監査を足す | 判断の基準だけあれば足りる | トリガー語と成果物が埋もれる。正本の向きは A と同じ |
| C. 個人スキル | `~/.claude/skills/` に日本語で直接作る | 受託会社の自社サイトの集客や、顧客への提案にもすぐ使いたい | 公開されない。Codex と共有されない。あとで A に移すと二重管理になる |

誰のためのスキルかは、まだ決まっていない。既定は、自分の個人開発プロダクトである。手順は製品の種類に依存しないので、A でも受託会社の自社サイトに使える。顧客への提供を主な用途にするなら、置き場所を考え直す。

### 7.4 作るときの順序

1. 骨子について、Codex の独立レビューを取る。
2. codex-plugins で、英語の SKILL.md・references・assets・行動ケースを作る。`node scripts/validate-codex-plugins.mjs` で検証する。
3. cc-plugins へ翻案する。SKILL.md を日本語にし、references と assets は同一コピーにし、`claude-code-runtime.md` を書く。README の同期元、`plugin.json` の version、マーケットプレイスの description、AGENTS.md に定めた検証を更新・実行する。
4. 既存の `channel-strategy.md` の AI discovery の節から、新しいスキルを指す。

## 8. 未確認の点と限界

- 事例の数値は検証できない。売り手と顧客の自己申告である。
- Reddit の規約のページとヘルプは、自動の取得を拒否された。利用規約は、ニューヨーク州司法長官のサイトにある Reddit の報告書の写しで読んだ。ヘルプは検索結果の抜粋で読んだ。
- §3 で ◎ の付いていない根拠と、§4.1 で「照合済み」と書いていない項目は、サブエージェントの取得に頼っている。スキルに数値を入れるときは原典で確かめる。
- 証拠は英語圏に偏り、業種は B2B SaaS と EC に偏る。日本語のクエリでどのソースが引用されるかは調べていない。
- ステルスマーケティング告示が、事業者だけに売る製品にどう当てはまるかは調べていない。
- AI 検索の仕様は数か月で変わる。2026 年だけでも、Google のガイドの新設、Search Console のレポートの追加、Bing の設定の変更があった。`engine-eligibility.md` は取得日を付けて持ち、鮮度監査の対象にする。
- このレポート自体は、独立レビューを受けていない。スキルの英語版は Codex の独立レビューを受け、その訂正をここにも反映した。

## 出典

**売り手（事例を書いた代理店）**

- [Granola の事例](https://discoveredlabs.com/case-studies/granola)
- [CITABLE の記事](https://discoveredlabs.com/blog/citable-the-aeo-content-framework-we-use-to-get-b2b-brands-cited-by-ai)、[Methodology](https://discoveredlabs.com/methodology)、[計測の記事](https://discoveredlabs.com/blog/aeo-test-bed-noise-vs-signal)、[AI Visibility Tracker](https://discoveredlabs.com/technology/ai-visibility-tracker)
- [What actually drives AI citations](https://discoveredlabs.com/research/what-drives-ai-citations)、技術報告 [arXiv:2609.35077](https://arxiv.org/abs/2609.35077)、[Reddit and LLM citations](https://discoveredlabs.com/research/reddit-llm-citations-research)
- [Reddit marketing](https://discoveredlabs.com/services/reddit-marketing-agency)、[Link building](https://discoveredlabs.com/services/link-building-agency)、[Pricing](https://discoveredlabs.com/pricing)

**エンジンの運営者**

- Google: [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)、[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)、[Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)、[Generative AI performance report](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- OpenAI: [Crawlers](https://developers.openai.com/api/docs/bots)、[Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)、[Setting up your business on ChatGPT](https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt)
- Perplexity: [Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- Anthropic: [Crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- Microsoft: [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)、[AI Performance](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)、[AI Recommendation Poisoning](https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/)

**研究と調査**

- 実験: [GEO](https://arxiv.org/abs/2311.09735)、[C-SEO Bench](https://arxiv.org/abs/2506.11097)、[What Gets Cited](https://arxiv.org/abs/2605.25517)、[GEO 研究のサーベイ](https://arxiv.org/abs/2607.14035)
- 観察: [Ahrefs（ブランドへの言及との相関）](https://ahrefs.com/blog/ai-overview-brand-correlation/)、[Ahrefs（上位 10 位との重なり）](https://ahrefs.com/blog/ai-overview-citations-top-10/)、[Ahrefs（best X の一覧）](https://ahrefs.com/blog/best-lists-research/)、[Ahrefs（自薦コンテンツの実験）](https://ahrefs.com/blog/self-promotional-content-ai-seo-experiment/)、[Lily Ray](https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could)、[Semrush（引用元のドメイン）](https://www.semrush.com/blog/most-cited-domains-ai/)、[Chen ほか](https://arxiv.org/abs/2509.08919)、[SE Ranking（llms.txt）](https://seranking.com/blog/llms-txt/)、[調査の総説](https://www.researchsquare.com/article/rs-11390685/v1)
- 計測: [IAB の指針](https://www.iab.com/wp-content/uploads/2026/07/IAB_Measuring_Visibility_in_the_AI_Era_August_2026-1.pdf)、[Graphite](https://graphite.io/five-percent/demystifying-randomness-in-ai)、[SparkToro](https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/)、[Omniscient Digital](https://beomniscient.com/blog/first-touch-vs-self-reported-attribution-aeo/)、[SearchPilot の参照表](https://www.searchpilot.com/hubfs/pdfs/ai-traffic-source-reference.pdf)
- 転換率: [Kaiser と Schulze（大学の発表）](https://www.frankfurt-school.de/home/news/2026/06/chatgpt-in-online-ohopping)、[Amsive](https://www.amsive.com/insights/seo/llm-traffic-conversion-rate-study/)

**規約と法**

- 日本: [告示](https://www.caa.go.jp/policies/policy/representation/fair_labeling/public_notice/assets/representation_cms216_230328_07.pdf)、[運用基準](https://www.caa.go.jp/policies/policy/representation/fair_labeling/guideline/assets/representation_cms216_230328_03.pdf)、[消費者庁 Q&A](https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/)、[SNOW への措置命令](https://www.caa.go.jp/notice/assets/representation_cms207_260806_02.pdf)
- 米国: [16 CFR 465](https://www.law.cornell.edu/cfr/text/16/465.2)、[16 CFR 255.5](https://www.law.cornell.edu/cfr/text/16/255.5)、[FTC の Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers)、[TruHeight の最終命令](https://www.ftc.gov/news-events/news/press-releases/2026/07/ftc-approves-final-order-against-truheight-deceptive-unsubstantiated-advertising-supplements-kids)
- EU と英国: [不公正取引方法指令の付属書 I](https://www.legislation.gov.uk/eudr/2005/29/annex/I)、[DMCC Act 2024 Schedule 20](https://www.legislation.gov.uk/ukpga/2024/13/schedule/20)
- プラットフォーム: [Reddit の利用規約（NY 州司法長官のサイトにある写し）](https://ag.ny.gov/sites/default/files/social-media-policy-report/2026-q1q2-reddit-inc-policy-1.pdf)、[AdExchanger（Reddit の表明）](https://www.adexchanger.com/daily-news-roundup/thursday-04062026/)、[Wikipedia の利益相反の指針](https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest)、[G2 の指針](https://legal.g2.com/community-guidelines)、[Trustpilot の指針](https://corporate.trustpilot.com/legal/for-businesses/guidelines-for-businesses)
