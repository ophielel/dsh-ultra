# dsh-ultra

> DeepSeek Harness 的 **Ultra 模式**。思想与提示词移植自 Claude Code 2.1.309 的 `ultracode`，机制按 DSH 重写：
> 不靠隐藏参数，而是 **Agent 预设 + 多智能体编排协议 + reasoningEffort 覆盖 + 按需编排手册**。

两种形态，二选一：

| 形态 | 入口 | 适用 |
|---|---|---|
| **Agent 预设**（推荐） | 设置 → Agent 预设 → 自定义 → **Ultra 模式** | 新任务默认进入 Ultra |
| **普通插件** | 会话内 `/ultra [on\|off\|status]` | 临时开关 |

## 效果

选择 Ultra 模式（或 `/ultra on`）后：

- **standing opt-in**：每个实质性任务默认用 `workflow` 做多智能体编排，不再需要每轮请示；
- **推理档位拉满**：请求的 `reasoningEffort` 覆盖为 `max`（DeepSeek 适配器支持 `off / low / high / max`）；
- **协议注入**：系统提示词出现 Ultra 协议——先探查拿工作清单，按维度扇出，每个结论派 2–3 个独立验证者对抗验证（不确定默认判伪），收敛后带证据报告；默认 `pipeline`、不默认 barrier、任何截断必须 `log()`；
- **手册按需加载**：`ultra_reference` 工具常驻注册，第一次写 workflow 脚本前调用一次，拿到脚本 API、schema 规则、`loop-until-dry` / judge panel / completeness critic 模板；
- **状态可恢复**：模式写在会话日志（`ultra/mode` 事件）里，投影折叠出 `{ active }`，resume / fork 后状态与徽标都会恢复；
- **徽标**：Web UI 输入框上方显示 `ULTRA · 编排 + max`（仅开启时）。

关闭后一切恢复默认：`workflow` 回到“用户显式要求才使用”，effort 回到会话设置。

## 安装

### 方式一：Agent 预设（推荐）

```bash
git clone https://github.com/ophielel/dsh-ultra.git ~/.dsh/plugins/dsh-ultra
```

1. 在 `~/.dsh/profiles/<profile>/package.json` 的 `dependencies` 里加：

   ```json
   "dsh-ultra": "file:../../plugins/dsh-ultra"
   ```

2. 在 profile 目录执行 `pnpm install`（或把仓库目录 junction/软链到 `node_modules/dsh-ultra`）。

3. 把 [`preset/cordis.patch.yml`](preset/cordis.patch.yml) 的内容追加到
   `~/.dsh/profiles/<profile>/cordis.patch.yml` 末尾。

4. profile patch 会热加载；没有出现卡片时重启 DeepSeek Harness。

5. 设置 → **Agent 预设** → **自定义** → **Ultra 模式** → 设为新任务默认，或新建任务时选择它。

> 预设只影响之后创建的任务；已有任务保持原预设。

### 方式二：插件 + `/ultra`

同样先 clone 并加依赖，然后把仓库根目录的 [`cordis.patch.yml`](cordis.patch.yml) 追加到 profile patch：

```yaml
- insert:
    - id: ultra
      name: dsh-ultra
      config:
        alwaysOn: false
        reasoningEffort: max
```

热加载或重启后，在会话里：

```text
/ultra            切换
/ultra on|off     开关
/ultra status     查看
```

**不要同时安装两种形态**：全局插件行和预设里的子插件会重复注册同名工具/命令。

## 它具体做了什么

| 部分 | 实现 |
|---|---|
| 提示词 | `ctx.systemPrompt.section({ name: "ultra:policy", order: 9000, text })`，未开启时返回空串，不占 token |
| 推理档位 | `agent/request` 瀑布最外层（`prepend: true`）改写 `reasoningEffort` |
| 编排手册 | `ultra_reference` 工具，按需返回 `prompts/reference.md` |
| 会话状态 | `sessionProjections` 注册 `ultra` 投影，折叠 `ultra/mode` 事件 |
| 开关 | `/ultra` 命令写 `agent.session.append("ultra/mode", { active })` |
| 徽标 | client 半边读 `useProjection("ultra")`，挂 `conversation.input.dock` |

### 和 Claude Code `ultracode` 的差异

- Claude Code 靠模型白名单（支持 `xhigh` 才可开）+ 每次进入自动塞 ~17 KB 手册；这里靠 Agent 预设/命令 + 按需工具，避免每轮固定成本。
- 模式状态落在会话日志而不是进程内存，所以 resume / fork 可恢复。
- `reasoningEffort: max` 由适配器解释；换成不支持 `max` 的模型时，把配置改成 `high` 或 `""`（空字符串表示不覆盖）。

## 配置

```yaml
- id: ultra
  name: dsh-ultra
  config:
    alwaysOn: false        # true = 挂载即生效，忽略 /ultra 开关（预设用）
    reasoningEffort: max   # off | low | high | max | ""（空字符串 = 不覆盖）
```

## 文件结构

```text
index.js                 投影、命令、prompt section、effort 覆盖、参考工具
client.js                输入框上方 ULTRA 徽标
prompts/ultra.md         每轮注入的协议（约 3.5 KB）
prompts/reference.md     按需返回的完整编排手册
cordis.patch.yml         插件行（bundle / 手动 patch 安装用）
preset/                  Agent 预设 bundle（Ultra 模式卡片）
test/ultra.test.mjs      用假 ctx 覆盖开关、幂等、effort、错误分支
```

## 开发

```bash
npm test        # node test/ultra.test.mjs
npm run check   # node --check index.js && node --check client.js
```

需要 Node 20+。仓库本身没有构建步骤，DSH 直接加载 `index.js` / `client.js`。

## 兼容性

- DSH 0.2.x，在本机 `0.2.1-rc.2` 上验证；
- 服务端插件（`index.js`）跨平台；客户端徽标只在 Web UI 出现；
- `reasoningEffort: max` 需要适配器支持（DeepSeek 支持）；其他供应商请改成 `high` 或 `""`。

## License

MIT
