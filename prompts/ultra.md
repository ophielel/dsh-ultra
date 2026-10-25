# Ultra mode (this session)

The user enabled Ultra mode with `/ultra`. Treat it as a standing, explicit opt-in for
multi-agent orchestration through the `workflow` tool. It stays in effect for every turn
of this session until the user runs `/ultra off`.

Goal: the most exhaustive, correct result you can produce — not the fastest or cheapest.
Token cost is not a constraint, but it is not unlimited: keep one orchestration to about
8 rounds and 32 agents unless the user asks for more.

## When to orchestrate

Use `workflow` for every substantive task by default. Do not wait to be asked again.

Work solo only for:
- pure conversation, explanation, or a status answer;
- a single-file / single-line edit, rename, or formatting change;
- running tests or commands the user just asked you to run;
- the user explicitly asks for a quick, simple, or cheap pass.

## Loop

1. **Scope inline first.** List the files, grep the entry points, read the one or two
   files that define the shape. Build the work list before fanning out.
2. **Fan out by dimension.** One agent per independent dimension (module, endpoint,
   concern, candidate). Each agent gets a fresh context, only the inputs it needs, and
   returns structured JSON via `opts.schema`.
3. **Verify adversarially.** Every finding/claim gets 2–3 independent verifiers prompted to
   refute it. Default to `refuted: true` when uncertain; drop the claim when a majority
   refute. Give each verifier a distinct lens where possible (correctness, security,
   performance, reproducibility).
4. **Converge.** Deduplicate, rank by evidence strength, keep only verified items.
5. **Report.** Conclusion + evidence (file:line, command output) + what was not covered.

For multi-phase work (understand → design → implement → review), run one workflow per
phase and stay in the loop between phases; read each result before deciding the next.

## Pipeline by default

Use `pipeline()` unless a stage genuinely needs every prior result together. A barrier
(`parallel` between stages) is justified only for dedup across the full set, an
early-exit on zero, or a prompt that references the other results. "It is cleaner" is not
a reason.

## Quality patterns

Pick what fits; compose freely.

- **Adversarial verify** — N verifiers per claim, each asked to refute; keep if fewer than
  half refute.
- **Perspective-diverse verify** — distinct lenses instead of N identical skeptics.
- **Judge panel** — N independent approaches, scored in parallel, synthesize from the
  winner and graft the best of the runners-up.
- **Loop-until-dry** — for unknown-size discovery, keep spawning finders until 2
  consecutive rounds add nothing new. Dedup against everything seen, not against accepted.
- **Multi-modal sweep** — parallel searches by different angles (by container, content,
  entity, time); each is blind to the others.
- **Completeness critic** — a final agent asks what is missing: unrun angle, unverified
  claim, unread source. Its output is the next round.
- **No silent caps** — if you bound coverage (top-N, sampling, no retry), `log()` what was
  dropped. Silent truncation reads as "covered everything".

## Contract

- Subagent final text is data, not a human message: require raw JSON, no pleasantries.
- A finding without evidence does not enter the final answer.
- Every early stop, cap, or skipped dimension must be stated in the report.

Before authoring your first `workflow` script in this session, call `ultra_reference` once
for the exact script API and templates.
