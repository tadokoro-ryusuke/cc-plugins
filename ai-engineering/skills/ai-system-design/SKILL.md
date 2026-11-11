---
name: ai-system-design
description: "LLM/AIエージェントを含むシステムの方式設計スキル。エージェント構成（ワークフローvsエージェント、シングルvsマルチエージェント）、モデルと effort（推論量）の選定、ツール設計・MCP、ガードレール（プロンプトインジェクション対策・停止条件・権限分離）、RAG/メモリ設計、コンテキスト予算、CLAUDE.md/AGENTS.md/システムプロンプトなどのコンテキスト設計（コンテキストエンジニアリング）の相談・設計・レビュー時に必ず使用する。「AIエージェントを作りたい」「RAGの精度が出ない」「マルチエージェントにすべきか」「ツールのdescriptionをどう書くか」のような軽い相談でも使う。"
---

# AI System Design（LLM/エージェントを含むシステムの方式設計）

**鉄則: まず最も単純な構成を探す。エージェントはワークフローで足りないときだけ。**
（出典: Anthropic「Building Effective AI Agents」）

LLM を含むシステムの方式設計を、以下の Step 順に進める。途中の Step から相談された場合も、Step 1〜2 の判定を先に確認してから答えること。なぜなら、上位の構成判断が誤っていると下位のツール・RAG 設計の最適化が全て無駄になるため。

## Step 1: 方式判定 — ワークフロー vs エージェント

最初に必ず問う: **「タスクの分岐は事前に列挙できるか?」**

- 列挙できる → **ワークフロー**（コードで制御フローを固定し、LLM は各ステップの変換だけを担う）
- 列挙できない → **エージェント**（LLM が自らツールを選び、ループして判断する）

なぜなら、エージェント化するほど能力は上がるが、コスト・レイテンシ・誤動作リスクが複利で増えるため。エージェント型は評価工数を厚く見込むこと（工数・金額の判断は自組織の見積・価格判断プロセスへ）。

ワークフローで組む場合は Anthropic の 5 パターンから選ぶ:

| パターン | 使いどころ |
|---|---|
| Prompt Chaining | タスクを直列の固定ステップに分解できるとき |
| Routing | 入力を分類して専用処理に振り分けられるとき |
| Parallelization | 独立サブタスクの並列実行、または多数決/合議で品質を上げたいとき |
| Orchestrator-Workers | サブタスクが動的に決まり、中央が分解・委譲・統合するとき |
| Evaluator-Optimizer | 明確な評価基準があり、生成→評価→修正のループが効くとき |

フレームワーク導入より LLM API 直叩き（数行のコード）から始める。なぜなら、抽象化レイヤはデバッグを難しくし、単純な構成で足りるケースを覆い隠すため。

## Step 2: シングル vs マルチエージェント

**シングルエージェントから始める**（Anthropic / OpenAI 両公式ガイドの共通推奨）。

マルチへの移行は、次の**実測**があってからにする:

- [ ] コンテキスト溢れが実際に起きている（会話・調査結果がウィンドウに収まらない）
- [ ] ツール過多による選択ミスが実際に観測されている

推測での事前分割は禁止。なぜなら、マルチ化はコンテキスト共有の分断・デバッグ困難・トークン消費の大幅増（Anthropic の実測で単体チャット比 約15倍・目安）を最初から背負うため。

マルチが有効なのは**並列に分割できる読み取り中心のタスク**（調査・検索など）に限る。密に相互依存するタスク（同一コードベースの編集など）には不向き（出典: Anthropic「How we built our multi-agent research system」）。

マルチにする場合:
- 型は「マネージャー型」（中央が子をツールとして呼ぶ）か「分散ハンドオフ型」（対等に制御移譲）から選ぶ（出典: OpenAI「A Practical Guide to Building Agents」）
- サブエージェントには**目的・出力形式・使用ツール・タスク境界**を明示的に与える。なぜなら、境界が曖昧だと子同士が重複作業や矛盾した変更をするため

### モデルと effort の選定

推論量の設定（effort / reasoning effort）は、モデル名と並ぶ設計軸として扱う。同じモデルでも effort によって品質・コスト・レイテンシが変わるため、モデル名だけでは構成が決まらない。

- **effort は省略せず、リクエストに明示して記録する**。API の既定 effort はモデルで違う（例: 2026-11-12 確認では、Fable 5.2 と Sonnet 5.5 は high、Opus 5.5 と Haiku 5.5 は medium）。省略したまま比べると、別の level どうしを比べることになる
- **思考量は文章ではなく effort で操作する**。「考えすぎるな」のような文は、新しいモデルでは効かないことがある（例: Fable 5.2 の medium 以上）。思考を減らしたいなら effort を下げる。thinking は max_tokens に数えられるので、高い effort では max_tokens に余裕を取る
- **最上位モデルを既定にしない**。迷ったら Opus 系から始める。effort を上げても eval が足りないときだけ、上位のモデル（例: Fable 系。2026-11-12 確認では Fable 5.2 の単価は Opus 5.5 の 2 倍）を比較に加える
- **カスケードを組む前に、同じモデルで effort を sweep する**。小さいモデルへ振り分ける構成（カスケード・ルーター）は、振り分けの誤りと運用の複雑さを背負う。同じモデルを低い effort で回すだけで足りることがある
- **1つのモデルで足りる作業では、オーケストレーションは割高になりやすい**。オーケストレーターと子の構成が得をしやすいのは、定型作業が大量にあるときと、1つのコンテキストに収まらないときである。テストなどの失敗シグナルがあるなら、低い effort で全件を回し、失敗した分だけ effort を上げて再実行する構成も候補になる
- **サブエージェントは親のプロンプトキャッシュを使えない**。文脈の先頭が親と異なるため、子を立てるたびにシステムプロンプトと渡した文脈を新たに読み込む費用がかかる。分割の利得がこの費用を上回るかで判断する。子が既定でどのモデルと effort で動くかも確かめる
- **無人のループでは、テキストだけの応答終了（end_turn）を完了とみなさない**。長いタスクの途中で、進捗報告だけを返して止まるモデルがある。完了はテスト・スキーマ・状態などの完了条件で判定し、自動で続けさせる回数には上限を置く（停止条件 → Step 7）
- **固定値ではなく、eval で決める**。モデルと effort の組み合わせは代表的なタスクの評価セットで比較してから決め、計測日と一緒に記録する。モデルが更新されると較正も変わるため、更新時に測り直す（評価設計 → ai-engineering:llm-evals 参照）
- **モデルは性能だけでなく、提供の条件でも絞られる**。データ保持（30 日保持が必須で ZDR では使えないモデルがある）、提供基盤とエンドポイント、処理リージョン、その基盤で使えない機能を、構成図のモデル選定に書く（成果物テンプレ 1）
  - 例（2026-11-12 確認）: Fable 5.2 は 30 日保持が必須で、Claude API では ZDR の組織から呼ぶと 400 になる。Bedrock では bedrock-runtime の `global.` と `us.` の推論プロファイルでだけ提供される
  - 可用性・リージョン・推論プロファイルは、ライブの公式ドキュメントと各クラウドのモデルカードで確かめる。保持条件と顧客への説明 → compliance-core:genai-ip-clearance Step 5

**モデルの挙動に合わせたプロンプト側の対処**（完了条件・停止条件・承認ゲートの代わりではなく、その補助）:

- その挙動を観察したときに、1 つずつ足す。足すたびに効果とトークン費用を測る
- **早期停止**: 長い多段の作業の途中でターンを終えるモデルがある（例: Fable 5.2 は low・medium で起きやすい）。公式の「Finishing work」の文は、普通の障害（エラー・タイムアウト・空の結果）は診断して乗り越え、意図的なブロッカーは越えずに報告する、という区別を書いたものである。足すのは、停止を観察したときか、low・medium で無人のエージェント作業を回すときに限る。出力は増え（公式の試験で約 3 割）、確認を求める回数も減る。そのため、危険・不可逆な操作の確認はハーネス側に残す（文面 → 出典の Prompting Claude Fable 5.2）
- **委譲の増加**: プロンプト・スキル・agent 定義が委譲を促すと、子を多く立てるモデルがある。まず委譲を促す行を見直す。それでも多いときだけ、子を立てるツールの説明に、子のコストと委譲が見合う場面を書く
- **進捗が見えない**: ツール呼び出しの合間の進捗を thinking block で返すモデルがある（例: Fable 5.2）。display の既定（omitted）では中身が空なので、text だけを描画する UI は無言に見える。人が見守る構成では、display を summarized（または beta の updates）にして描画する
- **承認ルール**: プロンプトに書いた承認ルールは、モデルが文字どおりに適用する。書き方 → human-in-the-loop-design Step 4。禁止と例外の書き方 → dev-core:conventions-as-guardrails Step 3

## Step 3: ツール設計

ツール設計は「エージェント向け UX 設計」として行う（出典: Anthropic「Writing Effective Tools for Agents」）。

- [ ] **少数の統合されたツール > 多数の細粒度 API ラッパ**。なぜなら、ツールが多いほど選択ミスが増え、コンテキストをツール定義が圧迫するため
- [ ] **search 型 > list_all 型**。なぜなら、全件返却はコンテキストを浪費し、エージェントに絞り込み作業を強いるため
- [ ] **description がツールの UX**。エージェントは説明文だけでツールを選ぶ。何をするか・いつ使うか・引数の意味・使ってはいけない場面を書く
- [ ] 応答は簡潔な形式にする（concise/detailed の切替を用意する）。なぜなら、応答トークンもコンテキスト予算を消費するため
- [ ] エラー応答は「次に何をすべきか」が分かる文面にする。なぜなら、エージェントはエラーメッセージを読んでリトライ戦略を決めるため
- [ ] 権限は **deny-by-default（最小権限）**。まず読取専用/書込の別を付け、書込系は4軸（可逆性・金銭影響・対外性・データ機微度）で格付けして権限マトリクス（正本 → human-in-the-loop-design）に落とす
- [ ] ツール接続の標準は MCP（Model Context Protocol）を第一候補にする
- [ ] MCP を使うなら、設計書に**対象 MCP リビジョン**と、使う機能の状態（Active / Deprecated）を書く。設計時に、そのリビジョンの changelog と非推奨機能の一覧（`https://modelcontextprotocol.io/specification/<リビジョン>/deprecated`）を確認する。なぜなら、MCP は後方互換を破る変更を日付付きのリビジョン（YYYY-MM-DD）で出すため、版を書かないと、どの前提で作ったかが後から分からなくなるため

MCP 2026-07-28 リビジョンの要点（2026-10-26 確認。この日時点の current。出典: https://modelcontextprotocol.io/specification/versioning 、 https://modelcontextprotocol.io/specification/2026-07-28/changelog ）:

- **ステートレス化**: initialize のハンドシェイクと、プロトコルのセッション（`Mcp-Session-Id`）が廃止された。呼び出しをまたぐ状態が要るときは、サーバーが発行するハンドルを通常のツール引数で渡す
- **非推奨**: Roots・Sampling・Logging・動的クライアント登録（DCR）。新規実装では採用しない。ただし非推奨一覧では、削除されうるのは早くても「2027-07-28 以降に出るリビジョン」からとされ、既存の連携をすぐ壊す必要はない。移行先は、Roots ならツール引数・リソース URI・サーバー設定、Sampling なら LLM の API を直接呼ぶ、Logging なら stderr（stdio のとき）か OpenTelemetry
- **リモート MCP の認可**: クライアント登録は、仕様の推奨順（SHOULD）に従う。事前登録した情報があればそれを使い、なければ Client ID Metadata Documents（CIMD）、DCR は CIMD に対応しない認可サーバー向けの後方互換の代替（使うなら `application_type` を指定する）、どれも無ければ利用者に入力を求める。認可レスポンスに `iss` があれば、記録した issuer と照合してから認可コードを引き換える（RFC 9207）。サーバーは自分宛てに発行されたトークンだけを受け付け、ほかのトークンを受け取ったり中継したりしない
- **トレース**: OpenTelemetry のトレースコンテキストは `_meta` の `traceparent` で伝える（監査ログ側 → human-in-the-loop-design Step 8）
- **旧リビジョンとの互換**: SDK やクライアントの対応には時間差がある。相手が 2025-11-25 以前（initialize 型）のときの互換経路と、`server/discover` による版の選択を確かめる。既存の連携を新リビジョン前提で急いで書き直さない

運用ループ: プロトタイプ → 評価でツール選択ミスを観測 → description を修正、を回す。ツール改善はエージェント自身にやらせてよい（Anthropic 公式推奨）。

## Step 4: コンテキスト予算設計

コンテキストウィンドウを「有限で劣化する資源」として扱う（出典: Anthropic「Effective Context Engineering for AI Agents」）。

**常駐 vs just-in-time の判断基準は「毎ターン必要か」**:

- 毎ターン必要（規約・検証コマンド・出力形式）→ 常駐（システムプロンプト / CLAUDE.md）
- 参照時のみ必要（詳細知識・手順書・API 仕様）→ just-in-time 取得（skills/references、検索、ファイル読込）

なぜなら、常駐は再現性が高い代わりにトークンを恒常消費して context rot（長時間タスクでの性能劣化）を早め、JIT は軽い代わりに取得漏れリスクがあるため。

長時間タスクには 3 戦略を組み合わせる:

1. **Compaction** — 会話履歴を要約圧縮して続行する
2. **Structured note-taking** — 決定事項・進捗をコンテキスト外のファイルに書き出す（ファイルこそが長期記憶）
3. **サブエージェント分離** — 大量読み取りを伴う調査を子に逃がし、親のコンテキストを守る

**会話履歴を自前で組み立てるなら、append-only を既定にする**（Claude API を直接呼ぶ構成）。なぜなら、現行の Claude モデルには preserved thinking があり、thinking block はそれより前の system・tools・履歴に結びつくため。それらを書き換えたあとで thinking block を送り返すと、400 になる（The block is bound to a different conversation）。

- 強制の範囲はモデルとアカウントで違う。例（2026-11-12 確認）: Fable 5.2 と Mythos 5.2 は全アカウント。Opus 5.5・Sonnet 5.5・Haiku 5.5・Fable 5.1 は、2026-08-31 以降に作ったアカウントで既定で強制される。範囲は出典の Preserved thinking のページで確かめる
- 400 を招く操作の例: 直近だけ残して前を要約で差し替える圧縮、古いターンのローリング切り捨て、古いツール結果の刈り込み、リクエストごとの system の作り直し、会話の途中での tools の差し替え
- 圧縮は、サーバー側の compaction か context editing を使う。system と tools はセッション中固定する。変えるときは新しい会話で行うか、会話の途中の system message・ツール変更（beta）として追記する。MCP connector を使うなら、ツール一覧を固定する
- `prefix_mismatch_behavior` の `drop_block`（beta）は 400 を避けるが、推論が捨てられて出力トークンが増えうる。直すまでのつなぎにとどめる
- Claude Code・Agent SDK・Managed Agents が履歴を管理する場合は対象外

システムプロンプトは「高度（altitude）」を調整する: ハードコードされた分岐の羅列（低すぎ）と曖昧な指示（高すぎ）の中間、**明確なヒューリスティクス + 判断余地**の粒度で書く。few-shot はルールの羅列より「多様で正準的な例」を選ぶ。

設計結果はコンテキスト予算表（後述テンプレ）に落とす。

## Step 5: RAG / メモリ設計（必要な場合のみ）

まず RAG が本当に必要かを判定する:

- コーパスが更新される・出典明示が要る → RAG
- コーパスが小さく静的 → 全部コンテキストに載せる方が単純で強い
- 文体・形式の一貫性だけが目的 → ファインチューニング（最後の手段）

RAG を作る場合は**段階論**で進める: **Naive → Advanced → Modular**。

1. **Naive**: 素朴な「埋め込み + top-k」で開始する
2. **Advanced**: 精度不足が実測されたら、クエリ変換（HyDE・クエリ分解）→ ハイブリッド検索（BM25 + ベクトル。固有名詞・型番が多いコーパスで有効）→ リランキング、の順に足す
3. **Modular**: GraphRAG 等の構成変更は最後

出発点ヒューリスティクス（目安・要実測）:

- **前処理 × チャンク戦略で精度の大半（7〜8割）が決まる**。埋め込みモデル選定に先に時間を使わない
- チャンクは 400 トークン・オーバーラップ 15% から開始し、Context Recall が低ければ大きく、Precision が低ければ小さくする
- **golden set（評価データセット 30 件〜）を先に作る**。なぜなら、評価がないと改善が全て感覚頼みになるため。評価設計の詳細 → ai-engineering:llm-evals 参照

メモリ設計は保存先と更新則を分類して決める（CoALA の枠組み）: 作業記憶（コンテキスト内）/ エピソード記憶（過去のやりとり）/ 意味記憶（事実知識）/ 手続き記憶（スキル・手順）。短期/長期それぞれの保存先・スキーマ・書き込み/参照ルールをメモリ設計書に明記する。

## Step 6: CLAUDE.md / AGENTS.md などコンテキストファイル設計

**中身の書き方の正本（何を書き何を書かないか・薄く保つ・コピーよりポインタ・二重管理禁止）→ dev-core:conventions-as-guardrails Step 3 参照。** ここでは AI システム設計側で追加になる観点だけを扱う。

- [ ] **60〜300 行**に収める（超える分は rules/ や references/ へ）。なぜなら、千行超のファイルは読まれず守られず、「守られない指示はコンテキストの負債」になるため
- [ ] **育成型運用**。空に近い状態から始め、「AI が毎回間違えること」が出るたびに追記し、定期的に削る
- [ ] システムプロンプト・指示書はバージョン管理対象のコード資産として Git 管理し、変更は評価とセットで行う。なぜなら、評価なしの変更は「秘伝のタレ化」して回帰に気づけなくなるため

規約を lint・hooks で機械的ゲートにする設計 → dev-core:conventions-as-guardrails 参照。

## Step 7: ガードレール設計

ガードレールは 4 層で設計する。「プロンプトで指示」だけで済ませてはならない。なぜなら、指示はプロンプトインジェクションで上書きされ得るため、決定的（コードで強制される）な層が必須:

1. **入力フィルタ** — モデレーション、信頼できない入力（Web・メール・顧客文書・Issue/PR コメント・ログ・MCP ツールの description と応答）のマーキング、レート制限
2. **出力検証** — スキーマ検証、対外送信前のチェック、機微情報の漏えい検査、拒否の分岐（下記）
3. **停止条件** — 最大ターン数・トークン予算・タイムアウト・同一エラー 3 回で停止。**最初から入れる**。なぜなら、停止条件のないループは暴走時に止める手段がないため。完了の判定は、モデルが応答を終えたことではなく完了条件で行う（→ Step 2「モデルと effort の選定」）
4. **権限分離** — 信頼できない入力を読んだコンテキストから書込系・対外送信系ツールを呼ばせない。実行分離は OS サンドボックス / コンテナ・VM / ネットワーク egress 制御の 3 層で考え、deny-by-default とする

**拒否の分岐**（出力検証の一部）: 安全分類器を持つモデルは、拒否を HTTP 200 で返す。例（2026-11-12 確認）: Claude の現行モデル（Fable 系・Opus 5 以降・Sonnet 5.5・Haiku 5.5 など）は `stop_reason: "refusal"` と `stop_details.category` を返す。

- content を読む前に stop_reason で分岐する。拒否を正常な応答として扱わない
- cyber や bio に近い業務（脆弱性診断・セキュリティツールなど）の案件では、正当な依頼でも拒否されうる。fallback の方式を設計書に書く。方式は server-side fallback・SDK middleware・自前の再試行のどれか
- 方式に対応する基盤とモデルは、公式の対応表で確認日付きで確かめる。例（2026-11-12 確認）: Bedrock は server-side fallback に対応しない。Haiku 5.5 には server-side fallback が無い
- fallback 先のモデルと、fallback 先には前の推論（thinking block）が引き継がれないことも書く
- 推論を本文や reasoning フィールドに書き出させる指示は置かない。reasoning_extraction として拒否されうる。この拒否は fallback されない

権限分離はセッション単位で確かめる。次の 3 つを 1 つのセッションにそろえない（出典: Meta「Agents Rule of Two: A Practical Approach to AI Agent Security」2025-10-31。1 セッションで満たしてよいのは 3 つのうち 2 つまで、という規則）:

- **A**: 信頼できない入力を読む（入力フィルタの例に挙げたもの）
- **B**: 機微データ・重要なシステムに触れる
- **C**: 状態を変える・外部へ送る

上の権限分離（A のコンテキストに C を持たせない）を守っていれば、3 つはそろわない。A と C がどうしても両方要るタスクは、自律実行させずに次のどちらかにする。なぜなら、注入された指示はセッション内のどのツールにも届き、B があればその被害が機微データやシステムに及ぶため。

- セッションを分ける: A を読む子には B と C を渡さず、決めた形式の結果だけを親に返させる。親は信頼できない原文を読まずに C を実行する
- 行動の前に人間が承認する（in-the-loop。設計 → human-in-the-loop-design Step 2）

書込・送信のツールを持たない A と B のセッションでも、URL を開く・画像を表示するなど外部に届く読取の経路があれば、機微データを URL に載せて持ち出されうる。A と B を同居させるなら、そうした経路がないことを確かめる。

脅威の語彙として以下でセルフチェックする（2026-10-26 に版を確認。版は変わるので、使う前に一次ソースで確かめる。URL は出典節）:

- [ ] **OWASP GenAI LLM Top 10 2026**（2026-08 公開）— モデルをアプリの部品として使うときの語彙。2025 版からの主な変化: Excessive Agency（過剰な代理権限）が 3 位に上がった。System Prompt Leakage は Hidden Context Exposure に名前が変わり、範囲が広がった。1 位 Prompt Injection・2 位 Sensitive Information Disclosure は変わらない
- [ ] **OWASP Top 10 for Agentic Applications for 2026**（2025-12-09 公開）— プランニング・ツール使用・アイデンティティ・メモリ・エージェント間通信のリスク
- 使い分け（LLM Top 10 2026 の Preface による）: モデルを部品として使うなら LLM Top 10、ツールを呼び、セッションをまたぐ記憶を持ち、下流に作用する行為者として使うなら Agentic Top 10 と組み合わせる
- [ ] 検証要件が要るときは **OWASP AISVS 1.01**（2026-10-09）。エージェントの実行は C9、MCP は C10（MCP 2026-07-28 リビジョンを参照）を見る。要件は版付きで引く（例: v1.01-C9.2.1）。AISVS は同じレベルの ASVS 検証を前提にする。契約に検証レベルを書く方法 → dev-core:security-by-design

高リスクツール（不可逆・金銭影響・対外送信・機微データ）の呼び出しにだけ人間の承認を挟む layered defense にする（出典: OpenAI「A Practical Guide to Building Agents」）。例外は上の A と C が同居するセッションで、そこでは格付けの低い書込・送信も承認の対象にする。承認ゲート・エスカレーション・監査ログの設計 → human-in-the-loop-design 参照。

## 成果物テンプレ

設計結果は以下 4 点に落とす。顧客納品用の体裁 → dev-core:external-design-deliverables 参照。

**1. エージェント構成図**

```
- 方式: ワークフロー(パターン名) / エージェント / ハイブリッド
- 構成: シングル / マルチ(マネージャー型 or ハンドオフ型)
- モデル選定: 各ノードのモデルと effort(明示した値)、選定理由(コスト/レイテンシ/精度)と比較に使った eval、確認日
  - 提供基盤とエンドポイント: Claude API / Claude Platform on AWS / Bedrock(bedrock-runtime か bedrock-mantle か、推論プロファイル) / Google Cloud / Foundry
  - データ保持: 30日保持が要るか / ZDR で使えるか
  - 処理リージョン: 国内処理が要るか
  - その基盤で使えない機能: server-side fallback・advisor・Batch など
- 拒否時の扱い: stop_reason の分岐 / fallback の方式(server-side・SDK middleware・自前)と fallback 先
- データフロー: 入力 → [各ノード] → 出力(信頼できない入力の流入点を明記)
- セッションごとの A/B/C: 信頼できない入力・機微データ/重要システム・状態変更/外部送信のどれを持つか
- MCP: 対象リビジョン / 使う機能とその状態(Active・Deprecated) / 認可方式(事前登録・CIMD・DCR)
```

**2. ツール仕様書（ツールごと）**

```
- ツール名 / 目的(いつ使うか・いつ使わないか)
- 入出力スキーマ / 応答形式(concise・detailed)
- description 全文(エージェント向け UX として書いたもの)
- エラー応答設計(エラー時にエージェントへ何を伝えるか)
```

**3. 権限マトリクス**

テンプレートの正本は human-in-the-loop-design（4軸格付け + 介在方式 + スコープ条件）を使う。

**4. コンテキスト予算表**

| 情報 | 常駐 or JIT | 置き場所 | 概算トークン | 根拠(毎ターン必要か) |
|---|---|---|---|---|

## 分担線: AI がやること / 人間にしか決められないこと

**AI（このスキルを実行するエージェント）がやること:**

- 方式判定の分析と推奨案の提示（Step 1〜2 の判定材料の整理）
- ツール仕様書・description の下書きと、評価に基づく改善
- チャンク処理・評価スクリプト・ガードレールのコード実装
- コンテキスト予算表・構成図・権限マトリクスのドラフト作成
- OWASP チェックリストによるセルフレビュー

**人間にしか決められないこと（AI は推奨まで。決定を求めること）:**

- **権限マトリクスの承認** — 何を自動化してよいかは事業判断
- **「そもそもエージェント化すべきか」の投資判断** — コスト・リスクを負うのは発注側
- **何をコンテキストに入れないかの取捨選択** — 機微情報・顧客データの線引き
- **コーパスの品質判断** — 顧客の社内文書のどれが正で、どれが古いか
- **コスト・レイテンシ・精度の優先順位** — トレードオフの重み付けは要件そのもの

## 最終チェックリスト

設計完了を宣言する前に確認する:

- [ ] より単純な構成（ワークフロー / シングル）で足りない理由を実測または要件で説明できる
- [ ] 全ツールに description・エラー応答設計・リスク格付けがある
- [ ] 停止条件（ターン数・予算・タイムアウト・同一エラー回数）が入っている
- [ ] 各ノードのモデルと effort を、代表的なタスクの eval で比較して決めている。effort は省略せずに明示している
- [ ] モデル選定に、データ保持・提供基盤とエンドポイント・処理リージョン・その基盤で使えない機能が、確認日付きで書かれている
- [ ] 会話履歴を自前で組み立てる場合、append-only である（system と tools をセッション中固定し、前のターンを書き換えない）
- [ ] 拒否を返すモデルを使う場合、content を読む前に stop_reason で分岐している。拒否時の扱い（fallback の要否、要るなら方式と fallback 先）を決めている
- [ ] 信頼できない入力の流入点と、そこからの権限分離が構成図に描かれている。A・B・C の 3 つがそろうセッションが自律実行になっていない
- [ ] MCP を使う場合、対象リビジョンと使う機能の状態が設計書にあり、新規に Deprecated の機能を採用していない
- [ ] コンテキスト予算表で常駐/JIT の根拠が「毎ターン必要か」で説明されている
- [ ] RAG がある場合、golden set が先に存在する
- [ ] 人間の決定事項（権限承認・投資判断）が未決のまま実装に進んでいない

実装後の検証 → dev-core:verify 参照。実装時の設計原則 → dev-core:best-practices 参照。不具合調査 → dev-core:debug 参照。

## 出典（一次情報）

- Anthropic「Building Effective AI Agents」「Effective Context Engineering for AI Agents」「Writing Effective Tools for Agents」「How we built our multi-agent research system」
- Anthropic API ドキュメント「Effort」「Optimizing for cost and intelligence」「Prompting Claude Opus 5.5」
- Anthropic API ドキュメント（2026-11-12 確認）: 「Prompting Claude Fable 5.2」（https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2 ）、「What's new in Claude Fable 5.2」（https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2 ）、「Preserved thinking」（https://platform.claude.com/docs/en/build-with-claude/preserved-thinking ）、「Refusals and fallback」（https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback ）
- 注: Prompting Claude Opus 5.5 にある「treat that answer as done」の 2 文は、Fable 5.2 に持ち込まない。Prompting Claude Fable 5.2 によると、high でこの 2 文を使うと、前の回答の誤りを指摘しにくくなる
- OpenAI「A Practical Guide to Building Agents」
- OWASP GenAI LLM Top 10 2026（https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/ 。Preface と項目の原文は https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/tree/main/2026/final 。genai.owasp.org/llm-top-10/ は 2025 版の表示が残っているので版の確認に使わない）
- OWASP Top 10 for Agentic Applications for 2026（https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ ）
- OWASP AISVS 1.01（https://github.com/OWASP/AISVS/releases/tag/v1.01 ）
- Meta「Agents Rule of Two: A Practical Approach to AI Agent Security」（https://ai.meta.com/blog/practical-ai-agent-security/ ）
- MCP 公式仕様（https://modelcontextprotocol.io/specification/versioning で current のリビジョンを確かめ、そのリビジョンの changelog と deprecated を読む）/ AGENTS.md 公式仕様（agents.md）
- 上の OWASP・Meta・MCP は 2026-10-26 に一次ソースを開いて確認した。OWASP の版と日付は dev-core:security-by-design Step 6 にも書いてあるので、版を更新するときは両方を揃える
- 12-Factor Agents（humanlayer/12-factor-agents）
