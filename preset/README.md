# Ultra 模式 · Agent 预设

这是 `dsh-ultra` 的预设半边：一份 `@deepseek-ai/dsh-agent-preset` 声明，`config.plugins` 等于
标准模式的完整工具列表加上 `dsh-ultra`（`alwaysOn: true`）。

选择该预设创建的新任务会：

- 拿到标准模式的全套工具（终端、文件、搜索、计划、压缩、子代理、workflow 等）；
- 常驻 Ultra 编排协议；
- 请求 `reasoningEffort` 为 `max`；
- 可用 `ultra_reference` 拉取完整编排手册。

## 安装

完整步骤见仓库根目录 [README](../README.md)。要点：

1. 仓库 clone 到 `~/.dsh/plugins/dsh-ultra`；
2. profile `dependencies` 加 `"dsh-ultra": "file:../../plugins/dsh-ultra"`，`pnpm install`；
3. 把本目录 `cordis.patch.yml` 的内容追加到 `~/.dsh/profiles/<profile>/cordis.patch.yml`；
4. 重启或等 profile patch 热加载；
5. 设置 → Agent 预设 → 自定义 → **Ultra 模式**。

不要同时安装根目录的插件行：两者都会注册 `ultra`，造成重复。
