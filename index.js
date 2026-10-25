import { readFileSync } from "node:fs";

const PROTOCOL = readFileSync(new URL("./prompts/ultra.md", import.meta.url), "utf8");
const REFERENCE = readFileSync(new URL("./prompts/reference.md", import.meta.url), "utf8");

const EFFORT_IDS = new Set(["", "off", "low", "high", "max"]);

function normalizeConfig(config) {
  const effort = config?.reasoningEffort ?? "max";
  if (typeof effort !== "string" || !EFFORT_IDS.has(effort)) {
    throw new Error(
      `dsh-ultra: reasoningEffort must be one of ${[...EFFORT_IDS]
        .map((value) => (value === "" ? '""' : value))
        .join(", ")}`,
    );
  }
  return { reasoningEffort: effort, alwaysOn: config?.alwaysOn === true };
}

/**
 * Durable per-session state. `ultra/mode` is a log-only event; the projection
 * fold restores the mode on resume and fork.
 */
const ultraProjection = {
  key: "ultra",
  stateVersion: 1,
  stateSchema: { parse: (value) => value },
  init: () => ({ active: false }),
  apply: (state, event) => {
    if (event?.type === "ultra/mode") return { active: event.data?.active === true };
    return state;
  },
  wire: {
    viewSchema: { parse: (value) => value },
    view: (state) => ({ active: state.active === true }),
  },
};

export const name = "dsh-ultra";
export const inject = ["systemPrompt", "sessionProjections", "tools"];

export function apply(ctx, config = {}) {
  const { reasoningEffort, alwaysOn } = normalizeConfig(config);

  const isActive = (session) => {
    if (alwaysOn) return true;
    if (!session) return false;
    try {
      return ctx.sessionProjections.stateOf(session, "ultra")?.active === true;
    } catch {
      return false;
    }
  };

  // 1. Per-session state, folded from the session log.
  ctx.effect(() => ctx.sessionProjections.register(ultraProjection), "dsh-ultra: projection");

  // 2. Model-facing protocol: present on every request while the mode is on.
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: "ultra:policy",
        order: 9000,
        text: (context) =>
          context.agent !== void 0 && isActive(context.agent.session) ? PROTOCOL : "",
      }),
    "dsh-ultra: policy section",
  );

  // 3. /ultra [on|off|status] — toggles the durable session state.
  ctx.inject(["commands"], (commandCtx) => {
    commandCtx.commands.register({
      name: "ultra",
      description: "开启/关闭 Ultra 模式（常驻多智能体编排 + 最高推理档）",
      input: { hint: "[on|off|status]" },
      handler: ({ agent, rawInput }) => {
        if (!agent) return { kind: "error", text: "Ultra 模式需要一个活动会话。" };
        const arg = String(rawInput ?? "").trim().toLowerCase();
        const current = isActive(agent.session);

        if (arg !== "" && arg !== "on" && arg !== "off" && arg !== "status") {
          return { kind: "error", text: `未知参数 "${arg}"。用法：/ultra [on|off|status]` };
        }
        if (arg === "status") {
          return {
            kind: "success",
            text: current
              ? `Ultra：已开启（reasoningEffort=${reasoningEffort === "" ? "跟随会话" : reasoningEffort}）。`
              : "Ultra：已关闭。发送 /ultra 开启。",
          };
        }

        const target = arg === "on" ? true : arg === "off" ? false : !current;
        if (target === current) {
          return { kind: "success", text: target ? "Ultra 已经开启。" : "Ultra 已经关闭。" };
        }
        if (alwaysOn && target === false) {
          return {
            kind: "error",
            text: "当前会话使用 Ultra 预设，模式始终开启；切换到其他 Agent 预设即可关闭。",
          };
        }

        agent.session.append("ultra/mode", { active: target });
        return {
          kind: "success",
          text: target
            ? "Ultra 已开启：本会话每个实质性任务默认使用 workflow 多智能体编排，推理档位拉到最高。用 /ultra off 关闭。"
            : "Ultra 已关闭：workflow 回到“用户显式要求才使用”的默认规则。",
        };
      },
    });
  });

  // 4. Raise the request's reasoning effort while the mode is on. Registered
  //    outermost so it wins over a per-session model selection.
  if (reasoningEffort !== "") {
    ctx.on(
      "agent/request",
      async (payload, next) => {
        const resolved = await next();
        const agent = payload?.agent;
        if (!agent || !isActive(agent.session)) return resolved;
        return { ...resolved, reasoningEffort };
      },
      { prepend: true },
    );
  }

  // 5. On-demand reference. Kept registered so the tool catalog stays stable.
  ctx.effect(
    () =>
      ctx.tools.register({
        name: "ultra_reference",
        description:
          "Return the full Ultra-mode workflow reference: script hooks, schema rules, scale limits, and worked fan-out/verify/loop templates. Call once before authoring your first workflow in the session.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        output: {
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { text: { type: "string" } },
            required: ["text"],
          },
          render: (_args, value) => [{ type: "text", text: value.text }],
        },
        execute: () => ({ text: REFERENCE }),
      }),
    "dsh-ultra: reference tool",
  );
}



