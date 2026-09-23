# Claude Code での実行ノート（indie-product-marketing）

このファイルは cc-plugins が所有する。SKILL.md は codex-plugins の正本からの翻案で、同じスキルの他の references と assets は英語原文のコピー。判断規則・完了条件・証拠の区分の正本はそちらにあり、ここには Claude Code のツール環境に固有の扱いだけを書く。

## スキルの相互参照

- 同じプラグインのスキルは `indie-product-marketing:<skill>` の名前で参照する。
- アイデアや顧客課題が未確定なら `indie-product-marketing:indie-idea-discovery` を使う。
- LP の設計・実装・ローカライズ・検証は `indie-product-marketing:global-landing-design` が担当する。LP の画面幅・キーボード操作・言語切り替えの確認も、そちらの手順に従う。

## Web の証拠

- WebFetch は、小型モデルによるページの要約を返す。数値・引用・価格・規約の文言は、生のソース（ブラウザ MCP のページテキスト、curl で取得した本文など）で照合する。
- 照合できなければ、台帳の該当行に「要約経由・未照合」と書く。要約だけで得た数値・引用・価格・規約の文言は、照合するまで `SKILL.md` の「観察事実」（直接検証した公開情報）に入れない。
- WebSearch は US-only で動く。日本市場の情報は、既知の一次 URL を直接取得する。`ethics-and-compliance.md` に載っている消費者庁・個人情報保護委員会・各プラットフォームの規約も、直接取得して現行の文言を確かめる。
- 取得したソースには、URL と取得日を記録する。

## 外部アクションの境界

`SKILL.md` の「承認された作業は検証まで進める」と「キャンペーンを推奨または実行する前に」の「実行」は、Claude Code では次の範囲に限る。

- 下書き・設計・ローカルでの準備は、指示を待たずに進めてよい。広告文、投稿文、メール文面、実験カード、計測計画、ローカルで動く LP がこれに当たる。
- 次の操作は、ユーザーの明示の指示があるときだけ行う。
  - 広告の出稿、予算の消化、課金
  - 公開投稿、DM、リプライ、いいね
  - Product Hunt などへの掲載
  - ウェイトリストの登録者などへのメール送信
  - 決済の設定と有効化（予約注文・デポジットを含む）
  - デプロイ、DNS の切り替え、インデックスの公開（robots の変更を含む）
  - Artifact の公開リンク化
- 一括・自動のエンゲージメント（自動いいね、一括 DM、無差別なリプライ、フォローの増減など）は、指示があっても行わない。`ethics-and-compliance.md` の Platform automation 節と同じ線である。
- この境界が要るのは、この環境ではブラウザ MCP（Playwright / Claude in Chrome）、`gh`、`wrangler`、クラウドの MCP などで、上の操作を実際に実行できてしまうからである。
- 指示を受けて実行した場合も、計画した施策・実行した操作・観察した結果を分けて報告する。ローカルでの準備を「出稿済み」「公開済み」「デプロイ済み」と報告しない。

## サブエージェントの使い方

- 小さな依頼は親が直接処理する。
- 種類の違うソース（レビュー、コミュニティ、価格ページなど）から証拠を集めるときのように、独立性が効く作業だけを別々のサブエージェント（Agent ツール、組み込みの general-purpose）に分ける。
- チャネル候補やポジショニング案を採点するときは、正規化したカードと証拠台帳だけを渡した新しい文脈で行い、候補を作った文脈では採点しない。
- 同じモデルが採点した結果は、順位付けの補助であり、市場の事実の認定ではない。

## 計測の実装と検証

- `SKILL.md` の「実装が範囲に含まれるときは、計測を組み込む」に当たる作業では、dev-core が導入されていれば `dev-core:verify` で検証する。
- イベントが実際に送られることを確かめられなければ、計測計画に「未検証」と明記する。

## dev-core への接続

- 需要検証を通ったコンセプトは、`/dev-core:task` に渡して MVP の計画にする（dev-core が導入されている場合）。
- 渡す内容は、`indie-product-marketing:indie-idea-discovery` の validation-handoff（[../../indie-idea-discovery/assets/validation-handoff.md](../../indie-idea-discovery/assets/validation-handoff.md)）に、本スキルでの検証結果（実験カードの判定、計測計画、未検証の前提）を加えたものにする。
- dev-core が導入されていなければ、同じ内容を実装計画の入力としてそのまま渡す。

## 他のスキルとの棲み分け

- LP のスタイルは、`ui-ux-pro-max:ui-ux-pro-max` と `frontend-design:frontend-design` を参照の補助に使う。審査とトークンの確定は、導入されていれば `design-core:design-review` と `design-core:ui-visual-defaults` が担う。
- ステルスマーケティング規制、個人情報、トラッキング同意などの法規の深い論点は、導入されていれば compliance-core（`compliance-core:privacy-data-compliance` など）に任せる。`ethics-and-compliance.md` は事前チェックリストであり、法的助言ではない。
- 受託開発の営業・提案・見積には使わない。
