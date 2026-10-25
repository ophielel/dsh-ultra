import assert from "node:assert/strict";
import { apply } from "../index.js";

const disposers = [];
let command;
let section;
let tool;
let requestListener;
const projections = new Map();

function fold(session) {
  let state = { active: false };
  for (const event of session.log) {
    if (event.type === "ultra/mode") state = { active: event.data?.active === true };
  }
  return state;
}

const ctx = {
  effect(fn) {
    const dispose = fn();
    if (typeof dispose === "function") disposers.push(dispose);
    return dispose;
  },
  inject(_deps, cb) { cb(ctx); },
  on(name, listener) {
    if (name === "agent/request") requestListener = listener;
    return () => {};
  },
  systemPrompt: {
    section(def) { section = def; return () => {}; },
  },
  sessionProjections: {
    register(def) { projections.set(def.key, def); return () => {}; },
    stateOf(session, key) {
      const def = projections.get(key);
      assert.ok(def, "projection registered");
      return fold(session);
    },
  },
  tools: {
    register(def) { tool = def; return () => {}; },
  },
  commands: {
    register(def) { command = def; return () => {}; },
  },
  logger: { warn() {}, info() {} },
};

apply(ctx, { reasoningEffort: "max" });

const session = {
  log: [],
  append(type, data) { this.log.push({ type, data }); },
};
const agent = { session };

// 1. inactive by default
assert.equal(section.text({ agent }), "");

// 2. /ultra on
let result = command.handler({ agent, rawInput: "on" });
assert.equal(result.kind, "success");
assert.equal(session.log[0].type, "ultra/mode");
assert.equal(session.log[0].data.active, true);
assert.ok(section.text({ agent }).includes("Ultra mode (this session)"));

// 3. effort override
const resolved = { provider: "deepseek", model: "deepseek-flash", reasoningEffort: "high" };
const out = await requestListener({ agent }, async () => resolved);
assert.equal(out.reasoningEffort, "max");

// 4. reference tool
assert.ok(tool.execute().text.includes("pipeline(items"));

// 5. status / off / unknown
assert.equal(command.handler({ agent, rawInput: "status" }).kind, "success");
command.handler({ agent, rawInput: "off" });
assert.equal(section.text({ agent }), "");
assert.equal(command.handler({ agent, rawInput: "wat" }).kind, "error");
assert.equal(command.handler({ agent: undefined, rawInput: "on" }).kind, "error");

// 6. idempotent on
command.handler({ agent, rawInput: "on" });
const before = session.log.length;
const again = command.handler({ agent, rawInput: "on" });
assert.equal(session.log.length, before, "no duplicate event");
assert.match(again.text, /已经开启/);

console.log("dsh-ultra unit test: OK");

