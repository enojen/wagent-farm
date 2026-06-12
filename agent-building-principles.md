# Agent Building Principles — Field Guide for This Repo

Distilled from *Principles of Building AI Agents* (3rd ed., Sam Bhagwat / Mastra, March 2026), rewritten and adapted to our project. Claude Code: read this before writing or modifying any agent, tool, workflow, or RAG code. It pairs with `project-notes.md` (architecture decisions). Where the two conflict, the architecture doc wins.

## 0. Project context (so the rules below make sense)

We are building a multi-tenant **agent farm**: many small, config-defined customer-support agents (first tenants: a Shopify store and a car marketplace), reached through channel adapters (WhatsApp first). Core invariants: a channel-agnostic message **envelope**, a **tenant gateway** (identity, package limits, usage metering — all enforced *before* the LLM is called), **config-driven agents** on Mastra used *as a library*, one Postgres (+pgvector) for everything, sessions modeled as suspendable workflows.

## 1. Models and prompting

- Start with hosted state-of-the-art providers (Anthropic / OpenAI / Google). The ordering is: make it work, then make it right, then make it fast/cheap. Do not optimize for cost before correctness.
- Always go through the model-routing abstraction. Swapping provider/model must stay a one-line (for us: one config-field) change. Per-tenant model choice is a product feature tied to packages — never hardcode a model name inside agent logic.
- System prompts carry: a clear role, explicit constraints, and explicit "do not" instructions (e.g., never invent facts, never promise anything outside available tools). This measurably reduces hallucination.
- Prefer few-shot examples for precision, and place static content (instructions, procedures, examples, knowledge headers) in a cacheable prefix — prompt caching cuts both cost and latency.
- Use structured output (schema-constrained JSON) whenever the model's answer feeds code. Route structured-extraction tasks — like our intent classifier — to a cheaper, faster model; extraction needs less reasoning than open-ended generation.
- Formatting nudges differ by family: Claude follows XML-style scaffolding well; GPT models respond better to markdown and delimiters. Keep tenant-facing prompt text in config, not in code.

## 2. Agents: definition and cost reality

- Working definition: an agent is a model calling tools in a loop to pursue a goal. Autonomy is a spectrum — from binary decisions in a tree, to memory+tools+retries, to full planning with subtask queues. **Build at the lowest autonomy level that solves the problem.**
- Agents accumulate tokens fast: tool results, memory, and history all stack. Context and cost management is a launch requirement, not a later optimization. In this repo that means: gateway metering on every turn, memory layering (see §4), and pruned context.
- "Dynamic agents" — instructions, model, and tool set resolved at runtime from context — are exactly our tenant-config pattern. The trade-off is power vs. predictability: keep the dynamic surface confined to declared config fields (prompt, procedures, tools, model, limits). Never branch on tenant identity inside agent code.

## 3. Tool design — the single most important step

- Write the tool list down **before coding anything**. For each tool: what it does, and when the agent should call it.
- Think like a skilled human analyst doing the job manually: enumerate the concrete operations and queries they would run; turn each into one tool. The book's case study: dumping a whole book corpus into context failed; the same agent became capable once the corpus was exposed as a handful of specific query tools (by-genre, by-recommender, recommendations, etc.). Structured tools beat raw context.
- Tool quality bar: semantic names (`searchVehicleListings`, not `doStuff`), strict input/output schemas (zod), and descriptions that state both purpose and usage conditions — the model uses tools only as well as you describe them.
- In this repo, tools are the per-tenant extension point: registered centrally, enabled per tenant via config, credentials injected per tenant. A client's custom logic enters as a tool, never as a branch in the core.

## 4. Memory

- Three established memory types: **working memory** (durable user facts), **semantic recall** (vector search over past content), and **observational memory** (an observer agent compresses raw sessions into short timestamped observations; a reflector garbage-collects observations when they overflow; context holds two blocks — observations + recent raw messages).
- More context is not better. Use memory processors to deliberately prune what reaches the LLM: token-limiting (drop oldest first), tool-call filtering (strip verbose tool transcripts; also forces fresh tool calls instead of stale reuse), plus custom processors.
- Our mapping (must be respected in code): current-session messages go in full; previous sessions go as one-line summaries; durable profile facts (name, last order, vehicle interest) go as a separate structured block. Raw history always stays in Postgres for the tenant panel — pruning applies only to what the LLM sees.
- Cache the static prefix (system prompt + procedures + tool descriptions) per tenant.

## 5. Guardrails, permissions, middleware

- Guardrails are perimeter middleware — input sanitization and output checks around the agent, never inside its loop. They exist to catch prompt injection, PII fishing, and off-topic traffic that burns tokens.
- Assume injected instructions arrive through **content the agent reads** (web pages, uploaded documents, ingested PDFs, third-party data), not just user messages. All ingested content is untrusted input.
- Two permission layers, both enforced from verified identity (JWT claims at the gateway), never from prompt text: (1) what resources this agent/tenant may touch; (2) which users may talk to this agent.
- High-stakes or irreversible actions (refunds, writes, outbound commitments) require a human-in-the-loop checkpoint: suspend the workflow, wait for an approval signal, then resume.

## 6. Workflows

- Use a workflow when agent freedom is too much. The standard composition: deterministic workflow scaffolding with agent/LLM calls embedded as steps for the open-ended parts.
- Primitives: chaining (`.then`), branching into parallel steps, merging, and conditions attached to the child step. Loops and retries are compositions of these.
- Two best practices that are non-negotiable here: **each step's input/output must be meaningful** (they become your trace view), and **at most one model call per step**.
- Suspend/resume is the mechanism for anything that waits on the outside world: human approval, a slow third-party API, a long async job. Persist workflow state in a durable store (Postgres) — a suspended workflow held only in memory dies on restart. Our session = one workflow; inactivity timeout = a durable timer; user messages, approvals, takeover, cancel = signals.
- Streaming: there are no commercially successful agents that feel slow. Stream step-level progress and within-step partials wherever the channel allows (web widget: full streaming; WhatsApp: typing indicators + prompt acknowledgment, since token streaming isn't possible).

## 7. RAG — and what to try before RAG

- Pipeline order: chunk (pick strategy + overlap; format-aware splitting for markdown/HTML) → embed → upsert with metadata → index (dimension must match the embedding model; cosine similarity is the default metric) → query → optional rerank (expensive; apply to top results only) → synthesize with explicit "say so if context is insufficient" instructions.
- Hybrid queries (vector similarity + metadata filters) are the norm, and in this repo one filter is mandatory and automatic on every query: the tenant namespace / `tenant_id`. No exceptions, ever.
- Vector DB choice is commoditized. Already on Postgres → pgvector is the right call (the book's own recommendation matches our stack).
- **Before** building RAG for a data source, try the simpler ladder: (1) give the agent query/search tools over the source, (2) let the agent write and run code against it, (3) for small corpora, consider full-context. Build the agent first; use RAG as the fallback for genuinely document-shaped knowledge. Our rule stands: live/fast-changing data (inventory, prices, orders, listings) = tools; documents (FAQs, policies, manuals) = RAG.
- Tune the boring knobs first (chunking, embedding model, reranker) before reaching for advanced RAG (LLM-generated metadata, query rewriting, graph extraction).

## 8. Multi-agent: resist it, then structure it

- Multi-agent design is organization design: group related tasks into a "job description" per agent, each with its own prompt, memory, and tools.
- The patterns, in increasing structure: supervisor with subagents passed in as tools; workflows passed as tools when a fixed sequence must be enforced; parallel tool calls when subtasks are independent (Claude parallelizes tool calls by default — disable when earlier results must gate later calls).
- Start with the simplest version. In this farm, "variety of agents" means many small single-purpose agents instantiated from config — not crews of role-played agents sharing context. Add a subagent only when one agent + good tools demonstrably fails.

## 9. Observability and evals (the production gate)

- The two things that actually block teams from shipping agents: **accuracy** and **token cost**. Both are answered by observability. Agents can regress while still returning 200 OK; teams in production look at traces daily.
- Token economics are existential: real teams have hit token bills that dwarfed revenue. Per-tenant metering from day one (our `usage_events`) is the defense and the billing source.
- Tracing: OTel-style spans for every step with full input/output, status, and latency; tag every span with `tenant_id`. Meaningful step I/O (§6) is what makes traces readable.
- Evals are CI for non-deterministic systems — expect noise per run, trust the trend. Run **offline evals** (fixed dataset, pre-deploy, regression catching) first; add **online evals** (scored samples of live traffic) once in production.
- Build the eval dataset three ways: hand-curate first (forces you to define "good"), generate synthetically (fast, but models produce easy cases — review them), and mine production logs (highest signal). Every production bug becomes a new eval case, like regression tests.
- Eval types this project specifically needs: classification accuracy for the intent/scope classifier; tool-call assertions (the right tool, with the right arguments); multi-turn evals (context held across turns? recovered after a tool failure? stayed on task after a tangent?); and task completion — did the conversation actually resolve? Resolution rate is our north-star metric and a per-tenant sales number.
- LLM-as-judge works for textual quality and faithfulness-to-context; pick a judge from a different model family than the agent (judges favor outputs that sound like themselves) and beware the long-answer bias.

## 10. Development loop and deployment

- The standard production shape: agent wrapped in a server, server in a container, autoscaled on a managed platform. Steady B2B traffic tolerates simple container hosting; spiky consumer traffic wants managed autoscaling. Long-running turns + serverless = timeout and bundle headaches; plan for streaming responses, not single JSON blobs.
- Agent logic never runs client-side (it would leak provider keys). Channels and webhooks sit in front; the brain stays in the backend.
- Local dev must include: a chat playground against real agents, a workflow visualizer with suspend/resume/replay, curl-able agent/workflow endpoints, a tool playground (test tools without invoking the agent), and local traces + evals. Mastra Studio (localhost:4111) provides this — use it during development.

## 11. How Claude Code should work in this repo

- Align on architecture before writing code; spec the tool list before implementing an agent; add human checkpoints to anything irreversible. (The book applies the same PM discipline to agents that we apply to Claude Code itself.)
- Security posture going forward: prompt-injection surface grows as agents ingest more and act more, and MCP adoption widens the attack surface — keep guardrails and permissions at the gateway strict, and treat third-party MCP servers with third-party-API levels of vetting.
- Expect evals to become increasingly generated from production traces (with human approval). Design traces today so they can seed eval datasets tomorrow.

## 12. Hard rules checklist (enforce in every PR)

1. `mastra` is imported **only** in `packages/agents` and `packages/tools`. Core, channels, db, and apps never know it exists.
2. Every vector operation carries the tenant namespace and a `tenant_id` metadata filter. No unfiltered queries.
3. The gateway checks package limits and writes a `usage_events` row **before** any LLM dispatch; every span and log line carries `tenant_id`.
4. One model call per workflow step; step inputs/outputs are meaningful and trace-worthy.
5. Workflow state persists to Postgres; no in-memory-only suspensions.
6. The intent/scope classifier runs on a cheap model with schema-constrained structured output; routing decisions afterward are deterministic code.
7. Tools: semantic names, zod schemas, descriptions covering both *what* and *when*; registered centrally, enabled per tenant via config.
8. No agent execution inside webhook handlers (WhatsApp requires 200 OK within ~5s): acknowledge, enqueue, process asynchronously.
9. Write-capable or irreversible tools sit behind a suspend → approve-signal → resume checkpoint.
10. Model names, prompts, procedures, scope lists, session rules, and limits live in tenant config — never hardcoded.
