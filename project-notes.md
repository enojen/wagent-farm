# Agent Farm — Project Notes & Decisions

Date: 11 June 2026 · Status: idea phase, first-version design

## 1. Vision

A multi-tenant "agent farm": a single platform that offers different customers (companies, stores, individuals) AI assistants that talk to their own end users. The first two customers: a Shopify store and otosor.com — both will support their own customers over WhatsApp. The channel (WhatsApp, web, etc.) is only an entry/exit gate; the agent core is fully channel-independent. Customers buy packages, usage is metered and billed; customers can view their own end users' past conversations from a panel.

## 2. Architectural backbone

Golden rule: the channel is only a door, the agent sees the envelope. Every inbound message is converted at the adapter into a single internal format (the envelope): tenant_id, conversation_id, end_user_id, channel, text, attachments, and optional channel capability flags. The agent processes the envelope and returns its reply as an envelope; the adapter translates it back into the channel's language.

Flow, top to bottom: channel adapters → tenant gateway → agent core → Postgres. On every turn, before going to the LLM, the gateway does three things: it identifies the tenant from identity (JWT claims; tenant context is never left to the LLM's instructions), checks the package limit, and writes a usage row to the usage_events table. The agent core loads the tenant's config row and runs as a durable workflow. The panel and billing sit at the edge of the flow; both only read Postgres. The "view past conversations" feature is therefore not a separate system but the panel listing the conversations table with a tenant filter.

A single Postgres + pgvector holds everything: tenants, configs, conversations (as normalized envelopes), usage_events, RAG vectors (a namespace per tenant), and workflow checkpoints. Isolation starts logically: tenant_id on every row, a filter at the application layer, and Row Level Security as a second line of defense. On the vector side, a namespace per tenant and a mandatory tenant filter on every query; if a sensitive-sector customer arrives, a separate index. Architectural form: modular monolith — a single Node service, a separate panel app; no microservices or message queue on day one.

## 3. Technology choices and rationale

Language: TypeScript (the team doesn't know Python; since LLM calls are HTTP there is no loss; webhook and panel work is more natural in TS). The cost: the newest techniques land in Python first; Pydantic AI's ability to generate agents from YAML is lost — a thin config→agent factory will be hand-written (about a day's work).

Agent layer: Mastra, used "as a library." Rationale: a TS-native full package (agent, workflow with suspend/resume, Postgres memory, RAG, built-in eval and tracing, MCP, model selection from 90+ providers). Alternative ordering: Mastra > writing from scratch + Inngest > LangGraph TS (trails Python by 4–8 weeks) > provider SDKs (lock-in to a single provider; lose per-tenant model-selection flexibility) > bare Vercel AI SDK (a streaming library; no workflow or memory — Mastra is already built on top of it). Honest cons: Mastra is young, its APIs are volatile, its production footprint is smaller than LangGraph's. The insurance: the envelope, gateway, session rules, and tenant config stay in modules independent of the framework; the "mastra" import may appear only in the agents and tools modules. This keeps the framework decision reversible.

Other parts: Hono or Fastify for the API and webhooks; Next.js for the customer panel. Durability initially via the Mastra workflow runtime (or Inngest beneath it); when hours-long autonomous jobs get serious, only those workflows move to Temporal, not the platform. WhatsApp connection first directly via the Meta Cloud API; when a second/third messaging channel comes up, a BSP/aggregator (Twilio, 360dialog) is evaluated — thanks to the adapter pattern this decision is cheap to change later. Metering first via our own usage_events table (each turn = one row: tokens, messages, tool calls); once money starts flowing, it is fed into Stripe metered / OpenMeter / Lago. Non-negotiable rule: metering is written from the first turn, not added retroactively. Limit policy: warn at 80%, a small buffer at 100%, then a graceful "capacity full" message — all as data in the package definition.

## 4. Agent classes and durability

Two classes, one infrastructure. Interactive agents (chat): signals arrive often, latency matters, the user can interrupt or change direction. Ambient (autonomous) agents: triggered by an event or scheduler, run long in the background, escalate to a human only when needed. Every agent run is a durable workflow that can receive signals; an ambient agent is the same workflow that simply nobody sends signals to. Draft signal set: user_message, pause, cancel, approve, human_takeover. Implementation rules: signal handlers are idempotent ("if a decision already exists, return"); in checkpoint systems, side effects before an interrupt are idempotent (the node re-runs from the start). Industry principles (12-Factor Agents): production agents are mostly deterministic code + LLM decisions placed at the right points; agents are kept small (ideal 3–10 steps); the lifecycle pattern is "save state, break the loop, load, continue"; an agent is a headless service, triggered regardless of webhook/cron/message. Flashy multi-agent setups (role-played crews) are avoided — they don't scale.

## 5. WhatsApp behavior design

Turn pipeline: envelope → a few seconds of debounce (consecutive short messages are merged into one turn) → session check (signal an open workflow if there is one, else start a new one) → intent classification (structured output from the LLM: intent, in-scope?, confidence score, handoff needed?) → deterministic routing: answer / off-topic template / hand off to a human. The scope decision is given not to the system prompt but to this separate step; the allowed and forbidden topics, the off-topic message text, and the handoff triggers (user asked, low confidence, complaint/anger, 3 failed attempts) live in the tenant config. The agent cannot promise anything (a discount, a legal opinion) that is not in its tools. The moment a human takes over, the agent is muted and the handoff is done with a context summary that spares the customer from repeating themselves.

Thread vs. session distinction: the (tenant_id, phone) pair is a thread that never closes; the session is the logical slice representing "the current concern" and maps to one workflow. Four rules close a session (all in config): inactivity timeout (default 24 hours — a durable timer), resolution closure (a resolved flag + a short wait; optionally a satisfaction question — resolution rate is fed from here), topic jump (when the classifier sees a completely new intent), manual close (from the panel). Memory is layered: not the whole thread to the LLM; the session's messages in full, previous sessions as a one-sentence summary each, durable profile facts as a separate structure. A concurrency lock per conversation: the session = one workflow pattern largely solves this.

Platform constraints: the 24-hour service window (when the window closes, messaging only via approved templates — proactive/ambient messages go through template management; an "am I allowed to reply freely?" check in the adapter), the requirement to return 200 OK to the webhook within 5 seconds (the agent never runs inside the handler: instant ack → queue → async reply), the channel is stateless (history lives entirely on our side), per-message pricing since 2025 (outbound messages are also metered per tenant).

## 6. Data sources: tools vs. ingestion

The two access modes are not mixed. Live, fast-changing data (Shopify stock/price/order, the Otosor listing database) is queried at runtime via a tool — not embedded into vectors. Documents (PDF, manual, policy) go through the ingestion pipeline: the raw source is stored (traceability), parse + clean + normalize, then embedding; a namespace per tenant; source-system access permissions are reflected into the chunk metadata; upstream rate limits are managed as policy, not silent retries. Design goal: adding a new source/connector must be cheap — if it takes a sprint, the bottleneck is the architecture. Ingestion itself is a typical ambient-agent job and runs on the same durable workflow infrastructure.

## 7. Lessons from the industry

Sierra, Decagon, and Intercom Fin independently arrived at the same abstraction: behavior is configuration, not code — "procedures" written in natural language (Decagon AOP, Fin Procedures, Sierra Journeys). The tenant config therefore holds not just a system prompt but a list of named procedures per scenario. The voice layer is itself configuration, and the established pattern (clearest in Intercom Fin) is structured controls over free text: a fixed tone-of-voice preset, a separate answer-length setting, and a pronoun-formality control that mirrors the customer (the formal/informal distinction matters for Turkish sen/siz) — Anthropic's own prompting guidance independently mandates a role/persona, a positive output-style directive, and explicit uncertainty/anti-hallucination behavior in the system prompt. Multilingual support follows an "allowed-languages list + auto-detect and reply in kind" model, with the language detected once at the start of a conversation and held for its duration (which lines up with our session boundary, §5); Turkish and English are both first-class for these tenants. The business-model axis: vendor-led setup (Sierra-style) brings big deals but limits the number of customers per person; self-service configuration (Fin-style) is the way for one team to serve hundreds of tenants — our target is the latter. The industry's core metric is resolution rate (the share of conversations resolved end-to-end without human intervention; not deflection) — measured per tenant from day one; sales are made over it.

## 8. Example tenant config

```yaml
tenant_id: otosor
model: anthropic:claude-sonnet-4-6
agent_type: customer_support
identity:
  name: "Otosor Assistant"
  role: "Vehicle-listings and appointment assistant"
persona: "A helpful, patient car advisor who speaks plainly and guides without overwhelming the customer."
tone: professional            # enum: friendly | neutral | matter_of_fact | professional | humorous
output_style: "Short, smoothly flowing prose paragraphs; bullet points only when listing options."
formality: auto               # enum: formal | informal | auto — drives TR sen/siz (and similar), mirrors the customer
uncertainty_behavior: "If unsure, do not guess; say so plainly and hand off when it matters."
rag_grounding:
  directive: "Base answers only on the retrieved knowledge-base content."
  no_evidence_fallback: "I don't have verified information on that; I can hand you to a representative."
language:
  default: tr
  auto_detect: true           # detect once at conversation start, then reply in kind
  allowed: [tr, en]
messages:
  greeting: "Hi! I'm the Otosor assistant — I can help with vehicle listings and appointments."
  fallback: "I couldn't answer that just now; shall I hand you to a representative?"
procedures:
  - name: test_drive_appointment
    text: "For anyone wanting a test drive: ask the city → show suitable listings → propose appointment slots."
tools: [search_vehicles, listing_detail, create_appointment]
knowledge_base:
  vector_namespace: tenant_otosor
scope:
  allowed: [vehicle_search, listing_detail, appointment, inspection_faq]
  forbidden: [price_negotiation, legal_advice, competitor_comment]
  off_topic_message: "I'm the Otosor assistant; I can help with vehicle listings and appointments."
handoff:
  triggers: [user_requested, low_confidence, complaint, three_failed_attempts]
  confidence_threshold: 0.7
session:
  timeout_hours: 24
  post_resolution_wait_min: 30
  new_session_on_topic_change: true
  debounce_seconds: 5
channels: [whatsapp, web_widget]
plan:
  monthly_tokens: 2000000
  messages_per_minute: 60
```

The Shopify customer is the same template filled with different values — different identity/persona/tone and `messages`, a different `language` default if its customers differ, different tools (query_order, search_product, start_return), a different procedure (return flow), etc. A new customer = a new config row, not new code. The identity/persona/tone/output_style/uncertainty/rag_grounding/language block above is the agent's voice layer; it compiles into the agent's system prompt (Mastra `instructions`), while `scope` and routing stay outside the prompt as deterministic code (§5, §10). `messages.greeting`/`fallback` are surfaced by deterministic code, not left to the LLM.

## 9. First-version scope and growth path

First-version backbone: envelope + gateway (identity, limit, metering) + a single chat-agent archetype built from config + a durable workflow with a signal channel + Postgres/pgvector + WhatsApp and web adapters (ack-and-enqueue) + one PDF ingestion connector + one live API tool + a simple panel (conversation inbox, config editor, usage report). Growth path: a new customer type, a new channel, a new package, ambient agents, B2B2C scenarios — all arrive into this picture as a new config row, a new adapter, or a new workflow definition; the picture does not change. The B2B2C vs. internal-use distinction is not an architectural fork but a matter of identity: the same agent, with a different permission profile in config (mostly read-only tools for end customers; write permissions with approval signals for internal users).

## 10. Open decisions and next steps

Decided (multi-agent per tenant): a tenant owns **many** agents, not one. The data model is `tenants → agents → agent_configs` (versioned config per agent), and config is per agent, not per tenant. A conversation stays the tenant-level thread `(tenant_id, channel, end_user_id)`; routing is non-deterministic and dynamic — the classifier picks the turn's intent and the router selects the agent whose config `scope` covers it (no central routing table, no branching on identity). Multiple agents can run **sequentially** within one conversation: each agent's engagement is one session (`sessions.agent_id`, one workflow per session); switching agents closes the current session with `closed_reason: handoff` and opens a new one in the same conversation. The new agent receives the prior sessions' one-line summaries (the §4 memory layering), so the customer never repeats themselves. This supersedes the "single chat-agent archetype" phrasing in §8–§9; the §8 example config is now one agent's config among potentially several. Plans/limits stay tenant-level (the tenant's agents share the package).

Decided (cross-agent routing is deterministic, and Mastra is a leaf executor): the choice of *which* agent owns a turn is made by our own code in `packages/core`, not by an LLM. A cheap classifier emits `{intent, in_scope, confidence, handoff}` (the step we need anyway for scope/off-topic), and deterministic code maps the intent to the agent whose config `scope` covers it. We deliberately do **not** use Mastra's supervisor pattern (an LLM agent that delegates to sub-agents via `generate()`/`stream()`) nor the deprecated Agent Network for this cross-agent routing. Rationale, in priority order: (1) predictability and testability — same input routes to the same agent every time, so classifier accuracy and tool-call routing are unit-testable and eval-stable (§9, roadmap T7.2); (2) multi-tenant scope/permission safety — routing decides which agent's scope and permissions apply, and that boundary must come from a deterministic step on verified identity, never from an LLM's reading of prompt text (§5, hard-rule §12.6); (3) we already run the classifier, so routing is just a lookup on top of it, not a second "brain"; (4) framework reversibility — routing stays Mastra-free, keeping the framework choice swappable (§12.1). Lower token cost is a real but *secondary* benefit that only compounds at scale (a supervisor adds an extra, usually larger, LLM call per turn); it is not the primary reason. Mastra's role is to **run** the selected agent — model, prompt assembly, tools, memory, tracing — not to orchestrate; routing, sessions, and the gateway live in core.

Mapping onto Mastra primitives: our `session` is one Mastra **thread** (one agent, isolated message history, immutable owner — matching the rule that an agent switch opens a new session rather than re-owning the old one); the Mastra **resourceId** is the `(tenant, end_user)` identity (optionally suffixed per agent); our `conversation` is an extra grouping layer Mastra has no native equivalent for, which is fine. The handoff context (a new agent seeing the prior sessions) can be served either by Mastra's resource-scoped memory (working memory + semantic recall over pgvector) or by our own one-line session summaries (§4, roadmap T6.1). This decision is low-regret: routing sits behind a core interface, so an LLM router or Mastra supervisor can be swapped in later — even per tenant — if deterministic routing proves too rigid. The one place we may still use Mastra's supervisor / agents-as-tools is *in-agent* delegation (e.g. a sales agent calling a small "financing calculator" helper as a tool); cross-agent routing stays in core.

To be decided: Hono or Fastify; Meta Cloud API directly or via a BSP (leaning toward starting directly on a single channel); the session timeout default (24 hours vs. shorter); the limit buffer percentage. Next design tasks: the full table design of usage_events + the package schema (with the quota query), the output schema of the intent classifier and the intent lists for the two customers, the signal/timer skeleton of the session workflow, the data model and API endpoints of the panel inbox screen. Nothing is coded; the project is still in the design phase.
