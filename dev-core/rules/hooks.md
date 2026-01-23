# Hooks Usage Rules

## フックイベント

### PreToolUse

ツール実行前に発火。検証や前処理に使用。

### PostToolUse

ツール実行後に発火。自動フォーマットや警告に使用。

### Stop

セッション終了時に発火。最終監査や学習に使用。

### PreCompact

コンテキスト圧縮前に発火。状態保存に使用。

## dev-core の自動化フック

### PostToolUse: Write|Edit

- Prettier で自動フォーマット
- TypeScript エラー警告
- console.log 追加警告

### Stop

- console.log 残存チェック
- TODO コメント報告
- 未コミット変更確認
- テスト状態確認

### PreCompact

- 作業状態の要約保存
- 次のアクションの記録
- 重要コンテキストの保持

## フック設計原則

1. **軽量に保つ**: フックは高速に実行される必要がある
2. **副作用を最小化**: 予期しない変更を避ける
3. **失敗を許容**: フック失敗がメインフローを止めない
4. **ログを出力**: デバッグのために実行状況を記録

## カスタムフック追加

`hooks/hooks.json` を編集：

```json
{
  "description": "プラグインのフック設定",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "危険なコマンドでないか確認してください"
          }
        ]
      }
    ]
  }
}
```

**重要**: トップレベルに `"hooks"` キーが必須です。
