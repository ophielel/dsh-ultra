# Ultra-mode workflow reference (DeepSeek Harness)

The `workflow` tool takes four inputs:

- `meta` — required JSON identity: `{ name, description, whenToUse?, phases? }`. It is a separate
  tool parameter, **not** an `export const meta` line inside the script.
- `script` — the plain JavaScript body of the orchestration. Type annotations, imports, and
  `export` statements are not allowed.
- `args` — optional object exposed to the script as the `args` global. Wrap a bare list in a
  field (`{"files": [...]}`).
- `run_in_background` — optional; returns a job id immediately.

The script ends with `return <json-serializable value>`. That value is the tool result.

## Hooks

```js
agent(prompt, opts?) => Promise<any>
pipeline(items, stage1, stage2, ...) => Promise<any[]>
parallel(thunks) => Promise<any[]>
phase(title) => void
log(message) => void
args => any
```

- `agent` runs one subagent to completion. Without `opts.schema` it returns the child's final
  text. With `opts.schema` it returns the validated object. It resolves `null` when the child
  fails; always `.filter(Boolean)`.
  - `opts.label` — display label.
  - `opts.phase` — progress group; use it inside pipeline/parallel stages so concurrent
    stages do not race on the global phase.
  - `opts.schema` — object-rooted JSON Schema using only `type`, `properties`, `required`,
    `additionalProperties`, `items`, `enum`, `const`, `oneOf`.
  - `opts.provider` / `opts.model` — independent LLM target overrides; omit unless certain.
- `pipeline` runs each item through all stages independently with no barrier. A stage throw
  drops that item to `null` and skips its remaining stages. Stage signature:
  `(prevResult, originalItem, index)`.
- `parallel` runs zero-argument thunks concurrently and awaits all of them. A throwing thunk
  resolves to `null`; the call itself never rejects.
- `phase` starts a progress group; `log` narrates a line; `args` is the call's `args` object.

Misused hooks (bad arguments, unknown options, unsupported schemas, tripped caps) end the
whole script. There is no filesystem, network, timer, or Node.js API inside the script; the
subagents do the work.

## Shapes

### Fan out, then verify every item

```js
phase('Find')
const dims = ['concurrency', 'error-handling', 'authz', 'perf']
const found = await pipeline(
  dims,
  d => agent(
    `Audit ${d}. Return JSON {findings:[{file,line,claim,evidence}]}. Evidence must be a quote or command output.`,
    { label: `find:${d}`, phase: 'Find', schema: FINDINGS }
  ),
  r => parallel((r.findings || []).map(f => () =>
    agent(
      `Try to refute: ${f.claim}\nEvidence: ${f.evidence}\nDefault to refuted=true if uncertain.`,
      { label: `verify:${f.file}:${f.line}`, phase: 'Verify', schema: VERDICT }
    ).then(v => ({ ...f, verdict: v }))
  ))
)
const confirmed = found.flat().filter(Boolean)
  .filter(f => f.verdict && !f.verdict.refuted)
return { confirmed }
```

### Loop until dry

```js
const seen = new Set()
const confirmed = []
let dry = 0
while (dry < 2) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: 'Find', schema: BUGS })))).filter(Boolean).flatMap(r => r.bugs)
  const fresh = found.filter(b => !seen.has(key(b)))
  if (fresh.length === 0) { dry++; continue }
  dry = 0
  fresh.forEach(b => seen.add(key(b)))
  const judged = await parallel(fresh.map(b => () =>
    parallel(['correctness', 'security', 'repro'].map(lens => () =>
      agent(`Judge "${b.desc}" via the ${lens} lens — real?`, { phase: 'Verify', schema: VERDICT })))
      .then(vs => ({ b, real: vs.filter(Boolean).filter(v => v.real).length >= 2 }))))
  confirmed.push(...judged.filter(v => v.real).map(v => v.b))
}
return confirmed
```

Dedup against everything seen (`seen`), not against confirmed — otherwise rejected findings
reappear every round and the loop never converges.

### Judge panel

```js
const attempts = await pipeline(ANGLES,
  a => agent(`Produce an independent approach: ${a}`, { phase: 'Design', schema: PLAN }))
const scored = await parallel(attempts.filter(Boolean).map(p => () =>
  agent(`Score this plan 1-10: ${JSON.stringify(p)}`, { phase: 'Judge', schema: SCORE })))
return { attempts, scored }
```

## Scale and budget

- Scale to the request: "find any bugs" → a few finders, single verify. "Audit thoroughly" →
  larger pool, 2–3 verifiers per finding, a synthesis stage.
- The engine caps concurrency; everything you pass still completes, just not simultaneously.
- Keep one workflow under ~8 rounds and ~32 agents. If the task needs more, split it into
  sequential workflows, read the result, and continue.
- Do not use `Date.now()`, `Math.random()`, or `new Date()`: workflows must be deterministic
  for replay. Vary prompts by item index instead.

## Failure handling

- `agent` returning `null` means the child failed or was skipped — filter it out and note it.
- A pipeline stage throw drops only that item; inspect `.filter(Boolean)` and report what was
  lost.
- A cancelled or failed run returns an error to the caller, not partial success. If a run is
  worth resuming, keep arguments deterministic so it can be re-run cheaply.
