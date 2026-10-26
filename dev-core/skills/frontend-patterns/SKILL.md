---
name: frontend-patterns
description: "Webフロントエンドのコンポーネント設計、状態管理、フォーム、データフェッチ、アクセシビリティの実装、性能（Core Web Vitals）、テストの書き方のパターンガイド。原則はフレームワーク非依存で、取得手段はレンダリングモデル（SPA / SSR / Server Components / Tauri の WebView）に合わせて選ぶ。ライブラリ例は React/Vue 中心で、React 19 の Actions・useOptimistic と React Compiler も扱う。UIコンポーネント・ページ・フォーム・ダイアログの実装/設計/レビュー時に使用する。"
---

# Frontend Patterns

Web フロントエンドの実装パターン。原則（コンポジション・状態の置き場所・検証と認可の分担・4状態・取得手段の選び方）はフレームワーク非依存で、ライブラリ例は React/Vue 中心。Svelte/Solid 等や Tauri の WebView 側にも原則は適用できる。

まず、対象のフロントエンドの既存の規約・依存・レンダリングモデルに従う。このスキルは、フレームワークの移行やプロダクトの作り直しを求めない。

- ライブラリの選定は、プロジェクトの `.claude/dev-core.local.md`、AGENTS.md、package.json などの依存定義で確かめる。
- フレームワーク固有の API（React hooks、Vue Composition API など）は、公式ドキュメント、または利用できるドキュメント用 MCP で確かめる。
- なぜ: 既存のスタックに合わない一般論を持ち込むと、依存の追加や書き換えが依頼の範囲を超える。

## コンポーネント設計

### コンポジションパターン

凝集した振る舞いと安定したインターフェースを単位にして、小さなコンポーネントを組み合わせる。1コンポーネント = 1責任。

```
Card
├── CardHeader  # タイトル表示
├── CardBody    # コンテンツ
└── CardFooter  # アクション
```

### Props 設計

- 型安全な Props 定義（TypeScript / PropType）
- `variant`, `size` 等はユニオン型で制限
- オプショナルな Props にはデフォルト値
- children / slots で合成可能に

### 分割の判断

- 行数だけを理由に分割しない。凝集度・状態の所有・再利用・テストしやすさのどれかが良くなるときに分ける。
- 行数はレビューのシグナルとして扱う（目安は `dev-core:best-practices` の §3「サイズ」）。
- 振る舞いのロジックはカスタムフック / Composable に抽出し、表示と分けてテストできるようにする。
- なぜ: 行数で機械的に割ると、状態とイベントが複数のファイルに散って追いにくくなる。

## 状態管理

### 原則

- **ローカルステート優先**: コンポーネント内で完結する状態はローカルで管理
- **リフトアップは最小限**: 共有が必要な場合のみ、必要な所まで親に移動
- **グローバルストアは慎重に**: 認証状態、テーマ等の本当にグローバルなもののみ
- **サーバーのデータはストアに写さない**: 取得した層（ルーターの loader やクエリライブラリ）のキャッシュを正にする（「データフェッチ」節）

### 推奨ライブラリ

プロジェクトで選定済みならそれに従う。新しく選ぶときの例:

- **Vue 3**: Pinia（公式推奨）
- **React**: Zustand（軽量）、Jotai（アトミック）

## フォーム実装

### 検証と認可の分担

- **スキーマで検証する**: Zod / Valibot / Yup など、プロジェクトで使っているものでスキーマを定義する。クライアントとサーバーで同じ規則を共有できるなら共有するが、サーバー専用のロジック（権限の判定や内部の制約）をクライアントのバンドルに出さない。
- **検証と認可の正本はサーバー側**: クライアントの検証は使い勝手のため。ボタンや項目を隠しても、権限を強制したことにはならない。
  - なぜ: リクエストはブラウザの画面を通さずに直接送れるので、クライアント側の制御は迂回できる。
- **エラー表示**: 項目ごとにインラインで、直し方が分かる文で出す。入力欄との関連付けは「アクセシビリティの実装」節。サーバーのエラーは文言ではなくエラーコードで分岐する（エラーの契約は `dev-core:interface-contract-design`）。
- **失敗しても入力を残す**: 送信に失敗しても、直せば再送できる入力は消さない。
  - なぜ: 長いフォームの入力が失敗で消えると、ユーザーはやり直すか離脱する。

```typescript
import { z } from "zod";

// Zod 4 の書き方。v3 系のプロジェクトでは z.string().email() を使う
// （v4 でも動くが deprecated）
const UserSchema = z.object({
  email: z.email(),
  name: z.string().min(2).max(50),
});
```

Zod 4 では文字列の形式（email・uuid・url など）がトップレベルの API に移り、`z.string().email()` などのメソッド形式は deprecated になった（出典: https://zod.dev/v4/changelog 、2026-10-26 確認）。プロジェクトの Zod のメジャー版に合わせて書く。

### フォームライブラリ

- プロジェクトで選定済みならそれに従う。例: Vue 3 は VeeValidate、React は react-hook-form、または React 19 の `<form action>` と `useActionState`（「React 19 と React Compiler」節）。
- スキーマとの接続には各ライブラリのリゾルバ / アダプタを使い、プロジェクトの Zod のメジャー版に対応しているかを確かめる。

## データフェッチ

### 原則

- **4状態**: ローディング / 空（0件）/ エラー / データあり のうち、該当するものをすべて設計する。空の表示を忘れない。
- **キャッシュと再検証を持つ層は1つ**: ルーターの loader とクエリライブラリの両方で、同じデータを取らない。
  - なぜ: 二重に取ると、リクエストが増えるうえに、2つのキャッシュが別々に古くなる。
- **キャッシュするライブラリの例**: SWR / TanStack Query（Vue では `@tanstack/vue-query`。旧称 Vue Query。出典: https://tanstack.com/query/latest/docs/framework/vue/overview 、2026-10-26 確認）。導入済みのものを使い、一般論を満たすためだけに依存を足さない。

### 取得手段はレンダリングモデルときっかけで選ぶ

| 状況 | 手段 |
|------|------|
| SSR / Server Components を使うフレームワークで、ルートのデータを取る | サーバー側（Server Component、またはルーターの loader） |
| SPA / Tauri の WebView で、ルートのデータを取る | ルーターの loader（あれば）か、既存のクエリライブラリ |
| ユーザー操作がきっかけ | イベントハンドラー（変更なら Action / ミューテーション） |
| キャッシュするクライアントのデータ | 既存のクエリライブラリ |

- SPA や Tauri のプロジェクトに、SSR やリクエストごとのサーバー側取得を前提にした書き方を持ち込まない。Tauri は静的な Web ホストとして動き、SSR のようなサーバー前提の方式をネイティブにはサポートしない（出典: https://v2.tauri.app/start/frontend/ 、2026-10-26 確認）。
- なぜ: レンダリングモデルを変える書き換えは、依頼の範囲を超えて、ビルドと配布の仕組みまで変えてしまう。

### データフェッチ用 useEffect を避ける（React）

`useEffect` でのデータフェッチは、レースコンディション・二重フェッチ・クリーンアップ漏れの温床。上の表の手段が使えるならそちらを優先する。effect で取るしかないときは、クリーンアップで古い応答を捨てる（または中断する）ことを必須にする（出典: https://react.dev/learn/synchronizing-with-effects 、2026-10-26 確認）。

```tsx
// ❌ 悪い例：クリーンアップが無い。id が変わると、古い応答が後から上書きしうる
useEffect(() => {
  fetchUser(id).then(setUser);
}, [id]);

// ✅ effect で取るなら：古い応答を捨てる
useEffect(() => {
  let ignore = false;
  fetchUser(id).then((user) => {
    if (!ignore) setUser(user);
  });
  return () => {
    ignore = true;
  };
}, [id]);

// ✅ ユーザー操作がきっかけなら：イベントハンドラー
async function handleRefresh() {
  setUser(await fetchUser(id));
}

// ✅ キャッシュするクライアントのデータ：既存のクエリライブラリ（キャッシュ・重複排除・再検証込み）
const { data: user } = useQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });

// ✅ SSR / Server Components のフレームワークを使っている場合だけ：サーバー側で取る
async function UserPage({ id }: { id: string }) {
  const user = await fetchUser(id);
  return <Profile user={user} />;
}
```

既存の effect による取得を別の手段に置き換えると、ローディングの出方・取得の時機・キャッシュが変わる。置き換えは依頼の範囲にあるときだけ行い、それ以外ではクリーンアップの欠落を直すか、報告に挙げるにとどめる。

### 楽観的更新

サーバーの応答を待たずに画面を変えるなら、先に次の2つを決める。

- **失敗時の復旧**: 元の表示に戻し、何が保存されなかったかをユーザーに伝える。
- **サーバー応答との突き合わせ**: 成功したら、サーバーの応答（採番された ID、サーバー側で補正された値）で置き換えるか、再検証する。
- なぜ: 失敗を戻さないと、ユーザーは保存されていない状態を正しいと思い込む。

実装の例:

- React 19 の `useOptimistic` は、Action の実行中だけ楽観的な値を表示する。Action が終わると元の state の表示に戻るので、親の state を成功時だけ更新していれば、失敗時は元の値に戻る。エラーは catch して表示する（出典: https://react.dev/reference/react/useOptimistic 、2026-10-26 確認）。
- TanStack Query では、失敗時にキャッシュを再取得して真の値に戻すか、`onMutate` で変更前の値を控えて `onError` で戻し、`onSettled` で再検証する（出典: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates 、2026-10-26 確認）。

## React 19 と React Compiler

プロジェクトの React が 19 以上のときだけ使う。React 19 は 2024-12-05 に安定版になった（出典: https://react.dev/blog/2024/12/05/react-19 、2026-10-26 確認）。

- **Actions**: 送信やデータの変更は Action（非同期の Transition を使う関数）にまとめる。`<form action={fn}>` と `useActionState` で、送信中の状態・エラー・結果を扱う。
- **フォームのリセット**: `<form action>` は、action 関数が成功すると非制御の入力欄をリセットする（出典: https://react.dev/reference/react-dom/components/form 、2026-10-26 確認）。検証エラーを例外ではなく戻り値で返す設計では、入力が消えうる。送信値も一緒に返して `defaultValue` に戻すか、制御コンポーネントにして、「失敗しても入力を残す」を満たす。
- **楽観的更新**: `useOptimistic`（「楽観的更新」節）。

React Compiler 1.0 は 2025-10-07 に安定版になった。導入しているプロジェクトでは、公式の推奨に従う（出典: https://react.dev/blog/2025/10/07/react-compiler-1 、2026-10-26 確認）。

- 新しいコードのメモ化はコンパイラに任せる。`useMemo` / `useCallback` は、精密な制御が要るところの escape hatch として使う（例: effect の依存にする値が、意味のない変化で effect を再実行させないようにする）。
- 既存の `useMemo` / `useCallback` は残す。外すとコンパイル結果が変わりうるので、外すなら十分にテストしてから。

コンパイラを導入していないプロジェクトでは、メモ化は計測で効果を確かめたところだけに入れる（次節）。

## アクセシビリティの実装

ここには実装の側で守ることだけを書く。WCAG 2.2 AA の最低ライン（8項目）と axe などによる機械検証は、導入されていれば `design-core:design-review` の Step 6 に従う。色・余白・コントラストは、導入されていれば `design-core:ui-visual-defaults` のトークンを使う。

- **ネイティブ要素を優先する**: `<button>`、`<a href>`、`<label>`、`<dialog>` など、必要な意味と振る舞いを持つ HTML 要素があるなら、ARIA の role で作り直さない（First Rule of ARIA Use。出典: https://www.w3.org/TR/using-aria/ 、2026-10-26 確認）。
  - なぜ: ネイティブ要素は、キーボード操作・フォーカス・読み上げを最初から備えている。
- **ダイアログのフォーカス**: 開いたらダイアログの中へフォーカスを移す。閉じたら、原則としてダイアログを開いた要素へ戻す。その要素が無くなった場合や、次の作業の流れが明らかな場合は、流れとして自然な要素へ移す（WAI-ARIA APG。出典: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ 、2026-10-26 確認）。
- **ルート遷移**: クライアント側のルート遷移では、フレームワークに通知の仕組みが無ければ、遷移先の見出しやメイン領域へフォーカスを移すか、遷移を live region で通知する。
  - なぜ: ページの再読み込みが起きないので、スクリーンリーダーの利用者に遷移が伝わらないことがある。
- **入力エラーの関連付け**: 検証に失敗した入力欄に `aria-invalid="true"` を付け、エラーの文を `aria-describedby` で関連付ける。`aria-invalid` は検証の前に true にしない（WCAG 技法 ARIA21 / ARIA1。出典: https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21 、https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA1 、2026-10-26 確認）。送信に失敗したら、最初のエラー欄かエラーの要約へフォーカスを移す。
- **非同期の状態変化を通知する**: 「保存しました」「検索結果 N 件」「読み込みに失敗しました」などは、フォーカスを奪わずに live region（`role="status"`、急ぎのエラーは `role="alert"`）で伝える（WCAG 2.2 達成基準 4.1.3。出典: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html 、2026-10-26 確認）。
  - live region の要素は、通知する前から（空のまま）DOM に置いておく。要素を差し込むのと同時に中身を入れると、読み上げられないことがある（出典: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions 、2026-10-26 確認）。
- **動きを減らす設定に従う**: `prefers-reduced-motion: reduce` のときは、必須でないアニメーションを止めるか減らす（出典: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion 、2026-10-26 確認）。
- **状態が変わっても操作を壊さない**: ローディングや再描画の間も、キーボード操作とフォーカスの位置を保つ（フォーカスのある要素を消さない、など）。

## パフォーマンス最適化

### 計測してから最適化する

- 対象の経路を計測してから、メモ化・仮想スクロール・分割読み込みなどの複雑さを足す。
  - なぜ: 計測していない最適化は効果が分からず、複雑さだけが残る。
- 公開 Web ページでは、指標に Core Web Vitals を使う。良好の基準は LCP 2.5 秒以下、INP 200 ms 以下、CLS 0.1 以下で、ページ読み込みの 75 パーセンタイル（モバイルとデスクトップを分けて）で判定する。INP は 2024 年に FID に代わって Core Web Vitals になった（出典: https://web.dev/articles/vitals 、2026-10-26 確認）。
- 判定は実ユーザーの計測（CrUX や RUM などのフィールドデータ）で行う。ラボ計測の INP は、計測中に行った操作によって値が変わる。操作を伴わないラボ計測では、Total Blocking Time（TBT）を INP の代理指標にできるが、INP の代わりにはならない（出典: https://web.dev/articles/inp 、2026-10-26 確認）。
- Tauri の WebView や社内向けの SPA のように、フィールドデータが集まらない環境では、同じ観点（表示の速さ・操作への応答・レイアウトのずれ）をラボ計測と長いタスクの計測で確かめる。

### 具体策

- **LCP**: LCP になる画像を遅延読み込みしない（`loading="lazy"` を付けない）。必要なら `fetchpriority="high"` で優先度を上げる（出典: https://web.dev/articles/optimize-lcp 、2026-10-26 確認）。ビューポートの外の画像は遅延読み込みする。
- **CLS**: 画像と動画に `width` / `height` を指定するか、CSS の `aspect-ratio` で場所を確保する。後から差し込む埋め込みや広告の場所も確保する（出典: https://web.dev/articles/optimize-cls 、2026-10-26 確認）。
- **Web フォント**: `font-display` を明示して、フォントの読み込み中の表示を選ぶ。値によって LCP・FCP・レイアウトのずれへの影響が変わるので、決め打ちせず計測して選ぶ（出典: https://web.dev/articles/font-best-practices 、2026-10-26 確認）。
- **INP**: 50 ms を超える長いタスクを分割し、メインスレッドに処理を返す（yield）。急がない処理は、画面の更新の後ろに回す（出典: https://web.dev/articles/optimize-long-tasks 、2026-10-26 確認）。
- **遅延読み込み**: ルート単位、重いコンポーネント単位。
- **仮想スクロール**: 大量のリストで、計測で効果が出るとき。
- **画像**: 適切なサイズと形式で配信する。next/image 等のフレームワークの画像機能があれば使う。

## テスト

- 変更した振る舞いは、プロジェクトのテストで覆う。テストの書き方の正本は `dev-core:best-practices` の references/testing.md で、要素の探し方（role とアクセシブルな名前を優先し、test id はチームが決めたテスト用の契約として使う）は同書の §9 に従う。
- 何を単体・コンポーネント・E2E のどこで確かめるか（配分）は `dev-core:test-design`、テストの実行と証拠の報告は `dev-core:verify` に従う。
- jsdom などで動かすコンポーネントテストが通っても、実ブラウザ・端末・本番での動作を確かめたことにはならない。レイアウト、フォーカスの移動、実際のネットワークに依存する振る舞いは、E2E か手動で確かめる。
