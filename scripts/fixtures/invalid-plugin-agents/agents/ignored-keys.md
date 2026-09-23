---
name: ignored-keys
description: 負例 fixture。プラグイン agent では無視されるキーと、許可していない model を持つ。
model: gpt-5 # 完全 ID でも alias でもない
permissionMode: acceptEdits
mcpServers:
  - example
hooks:
  PreToolUse: []
tools: Read
---

ignored-key と model-invalid を発火させる。
