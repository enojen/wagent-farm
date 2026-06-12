# Roadmap — Agent Farm MVP (no WhatsApp yet)

Companion to `project-notes.md` (architecture) and `agent-building-principles.md` (rules — its §12 checklist applies to every task below). Claude Code: work top-to-bottom, one task at a time, check boxes as you go. Keep each task a single small PR.

**MVP definition:** from a terminal, you can chat with a seeded tenant's agent (`otosor-demo` or `shopify-demo`); intent classification routes answer / off-topic / handoff; tools answer from seeded data; every message, session, tool call, and token is persisted and metered in Postgres. Channels only log/print — WhatsApp is absent by design, but the envelope + adapter interface make it a drop-in later.

**Stack (decided):** TypeScript, pnpm monorepo, Mastra (only inside `packages/agents` + `packages/tools`), Hono (apps/api, later), Postgres + pgvector via Docker, Drizzle ORM, Vitest.

---

## Phase 0 — Repo skeleton & guardrails

- [x] **T0.1 Init monorepo.** pnpm workspaces with `apps/api` (empty placeholder), `packages/core`, `packages/channels`, `packages/db`, `packages/agents`, `packages/tools`. Root `CLAUDE.md` pointing to the two docs above. TypeScript strict everywhere.
  *Done when:* `pnpm -r build` passes on empty packages.
- [x] **T0.2 Boundary enforcement.** ESLint `no-restricted-imports`: importing `mastra`/`@mastra/*` fails outside `packages/agents` and `packages/tools`. Vitest wired at root.
  *Done when:* a deliberate bad import in `core` fails lint in CI.
- [x] **T0.3 Local infra.** `docker-compose.yml` with Postgres 16 + pgvector; `.env.example` (DB URL, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`); README quickstart.
  *Done when:* `docker compose up -d && pnpm db:ping` succeeds.

## Phase 1 — Data layer (`packages/db`)

- [x] **T1.1 Schema v1 (Drizzle migrations).** Tables: `tenants`, `plans`, `agents` (tenant_id + key — a tenant has many agents), `agent_configs` (jsonb config, versioned per agent), `conversations` (tenant_id + channel + end_user_id — the thread spans agents), `sessions` (conversation_id, agent_id, status, closed_reason: …|handoff), `messages` (envelope-shaped, role, content, session_id), `usage_events` (tenant_id, session_id, kind: llm|tool|message, tokens_in/out, cost_estimate, ts), `documents` + `chunks` (pgvector column, tenant namespace), `profile_facts` (tenant_id, end_user_id, key, value).
  *Done when:* `pnpm db:migrate` runs clean on a fresh DB.
- [x] **T1.2 Tenant-scoped repository layer.** Every query helper takes `tenantId` as its first argument; no raw cross-tenant query helpers exist. Unit tests prove tenant A cannot read tenant B's rows through the public API of this package.
- [ ] **T1.3 Seed script.** Two tenants, each with one or more agents whose `agent_configs` match the YAML shape in the notes doc (`otosor-demo`: a sales agent with search_vehicles/listing_detail/create_appointment, scope lists, session rules — optionally a second after-sales agent to exercise routing/handoff; `shopify-demo`: query_order/search_product). Seed ~20 fake vehicle listings and ~10 fake orders as tool data tables.
  *Done when:* `pnpm db:seed` is idempotent and prints both tenant ids.

## Phase 2 — Core (`packages/core`) — no Mastra here, ever

- [ ] **T2.1 Envelope types.** `InboundEnvelope`, `OutboundEnvelope`, `ChannelCapabilities` (supportsStreaming, supportsRichReplies, freeReplyWindowOpen?). Pure types + zod schemas.
- [ ] **T2.2 Session manager.** `resolveSession(tenantId, conversationKey)`: reuse open session within `session.timeout_hours`, else close-and-create (closed_reason: timeout|resolved|topic_change|manual). Per-conversation async lock (in-process for now) so turns serialize. Config-driven values only.
  *Done when:* unit tests cover reuse-within-timeout, new-after-timeout, serialized concurrent turns.
  *Schema add (with this task):* `sessions.last_activity_at`, `sessions.closed_at`; index `sessions(tenant_id, status)` for the open-session lookup — measure before adding.
- [ ] **T2.3 Turn pipeline (orchestrator).** `handleTurn(envelope)` skeleton: debounce buffer (config `debounce_seconds`, in-memory) → resolveSession → classify (interface only; stub returns `in_scope`) → route: answer | off_topic_template | handoff_stub → persist messages → return OutboundEnvelope. Classifier and agent are injected interfaces so core stays Mastra-free.
  *Done when:* pipeline test runs end-to-end with stub classifier + echo agent.

## Phase 3 — Console channel (`packages/channels`)

- [ ] **T3.1 ChannelAdapter interface.** `start()`, `send(OutboundEnvelope)`, capability flags; adapters translate channel ⇄ envelope and nothing else.
- [ ] **T3.2 ConsoleChannel (dev REPL).** `pnpm dev:chat --tenant otosor-demo --user phone:+90555...` opens a readline loop: stdin → InboundEnvelope → handleTurn → print reply. Outbound side effects are just `console.log` (this *is* our "log the channels" stage).
- [ ] **T3.3 ScriptChannel (test harness).** Feed a JSON array of user messages, capture replies; used by evals later.
  *Done when:* a scripted 3-turn conversation persists 1 conversation, 1 session, 6 messages in DB.

## Phase 4 — Agent runtime (`packages/agents` + `packages/tools`) — Mastra enters

- [ ] **T4.1 Tool registry + first tools.** Central registry; tools enabled per tenant from config; zod schemas; semantic names; descriptions say *what + when*. Implement against seeded tables: `search_vehicles`, `listing_detail` (otosor), `query_order`, `search_product` (shopify). Credential injection stubbed but present in the signature.
- [ ] **T4.2 Config→Agent factory.** Build a Mastra agent from `agent_configs`: model string, system prompt assembled from prompt + procedures (cacheable static prefix), enabled tools. No tenant/agent branching in code.
  *Schema add:* a way to mark the active config version (e.g. `agents.active_config_version` or `agent_configs.is_active`) — defaults to max(version) until then.
- [ ] **T4.3 Intent/scope classifier + agent router.** Cheap model + structured output `{intent, in_scope, confidence, handoff}`; deterministic router in core consumes it (replaces the stub). Routing also selects which of the tenant's agents owns the turn — match the classified intent against each agent's config `scope` (no central routing table, no branching on identity). A different agent than the open session's → close it (`closed_reason: handoff`) and open a new session for the chosen agent in the same conversation. Off-topic reply text and handoff triggers come from config.
- [ ] **T4.4 Session turn as Mastra workflow.** Steps: load_context → classify → respond (single agent call) → persist. One model call per step; workflow state persisted to Postgres; a `human_takeover` flag on the session short-circuits the agent (prints "[handoff] human takes over" for now).
  *Done when:* REPL with `otosor-demo` answers "is there a diesel SUV under 20k?" via `search_vehicles`, deflects "get me a loan" with the config template, and a forced low-confidence case routes to handoff; all turns traced in DB.
  *Schema add:* `sessions.human_takeover` (bool) for the muted-agent short-circuit; index `messages(session_id, created_at)` for ordered history load.

## Phase 5 — Gateway concerns: metering & limits

- [ ] **T5.1 Usage metering.** Write `usage_events` per turn: LLM tokens (from model usage payload), tool invocations, message count. Daily per-tenant aggregate query helper.
  *Schema add:* index `usage_events(tenant_id, ts)` for the daily aggregate; `usage_events.model` / `.metadata` if cost attribution needs them.
- [ ] **T5.2 Plan enforcement.** Before LLM dispatch: hard limit check against plan (`monthly_tokens`), warn log at 80%, graceful "capacity full" reply at cap; simple per-tenant rate limit (token bucket on Postgres).
  *Done when:* a seeded tiny plan exhausts and the reply arrives without any LLM call (assert via usage_events).

## Phase 6 — Memory & RAG light

- [ ] **T6.1 Memory layering.** Context builder: current-session messages in full + one-line summaries of previous sessions (summary generated on session close) + `profile_facts` block. Token-limit pruning. Raw history untouched in DB.
- [ ] **T6.2 Ingestion v1 + retrieval tool.** CLI: `pnpm ingest --tenant otosor-demo file.pdf` → parse → chunk → embed → upsert into `chunks` with tenant namespace. Tool `search_knowledge` queries with mandatory tenant filter; agent instructed to admit when context is insufficient.
  *Done when:* a seeded FAQ answers via `search_knowledge` for its tenant, and a cross-tenant retrieval attempt returns nothing (test).
  *Schema add:* `chunks.metadata` (jsonb, for source permissions + hybrid filters), `documents.uri`/`.metadata`; HNSW index `chunks USING hnsw (embedding vector_cosine_ops)` + `chunks(tenant_id, namespace)` for the mandatory tenant filter (§12.2).

## Phase 7 — Observability & evals baseline

- [ ] **T7.1 Tracing.** Mastra telemetry/OTel spans for every step with input/output and `tenant_id` attribute; verify in Mastra Studio locally.
- [ ] **T7.2 Eval seed.** 10–15 hand-curated cases per tenant via ScriptChannel: classifier accuracy, tool-call assertions (right tool, right args), one multi-turn (context held + off-topic recovery), task-completion flag. `pnpm eval` prints scores; CI threshold fails the build on regression.

## Phase 8 — Panel v0 (optional, can slide)

- [ ] **T8.1 Next.js read-only panel.** Tenant picker (no auth yet) → conversations inbox (sessions + messages) → usage chart from `usage_events`.
  *Schema add:* index `conversations(tenant_id, created_at)` for the inbox list.

---

## Parked (in rough order — do not start yet)

WhatsApp adapter (ack-and-enqueue worker, 24h-window check, template registry) → human takeover UI + `human_takeover` signal from panel → ambient agents (turn ingestion into a long-running workflow, scheduled follow-ups) → Stripe metered billing fed by `usage_events` → Postgres RLS as second defense layer → MCP for client-supplied tools → Temporal migration for long-running workflows.

**Working agreement:** every task = one small PR; checklist §12 of `agent-building-principles.md` is the review gate; if a task balloons, split it rather than batching.
