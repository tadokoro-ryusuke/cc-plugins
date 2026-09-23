---
name: dangling-reference
description: 負例 fixture。存在しない agent・skill・workflow を各表記で参照する。
tools: Read
skills:
  - dev-core:no-such-skill
---

- Agent(dev-core:no-such-agent) に委譲する。
- Task(subagent_type: "dev-core:no-such-agent") で委譲する。
- 設定例: `{ subagent_type: "invalid-plugin-agents:no-such-agent" }`
- 手順は `dev-core:no-such-skill` に従う。
- 終わったら `/dev-core:no-such-workflow` を実行する。
- 外部プラグインの `example-external:anything` は検査しない。

ref-missing を発火させる。
