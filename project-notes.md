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

Sierra, Decagon, and Intercom Fin independently arrived at the same abstraction: behavior is configuration, not code — "procedures" written in natural language (Decagon AOP, Fin Procedures, Sierra Journeys). The tenant config therefore holds not just a system prompt but a list of named procedures per scenario. The business-model axis: vendor-led setup (Sierra-style) brings big deals but limits the number of customers per person; self-service configuration (Fin-style) is the way for one team to serve hundreds of tenants — our target is the latter. The industry's core metric is resolution rate (the share of conversations resolved end-to-end without human intervention; not deflection) — measured per tenant from day one; sales are made over it.

## 8. Example tenant config

```yaml
tenant_id: otosor
model: anthropic:claude-sonnet-4-6
agent_type: customer_support
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

The Shopify customer is the same template filled with different values (tools: query_order, search_product, start_return; procedure: return flow, etc.). A new customer = a new config row, not new code.

## 9. First-version scope and growth path

First-version backbone: envelope + gateway (identity, limit, metering) + a single chat-agent archetype built from config + a durable workflow with a signal channel + Postgres/pgvector + WhatsApp and web adapters (ack-and-enqueue) + one PDF ingestion connector + one live API tool + a simple panel (conversation inbox, config editor, usage report). Growth path: a new customer type, a new channel, a new package, ambient agents, B2B2C scenarios — all arrive into this picture as a new config row, a new adapter, or a new workflow definition; the picture does not change. The B2B2C vs. internal-use distinction is not an architectural fork but a matter of identity: the same agent, with a different permission profile in config (mostly read-only tools for end customers; write permissions with approval signals for internal users).

## 10. Open decisions and next steps

To be decided: Hono or Fastify; Meta Cloud API directly or via a BSP (leaning toward starting directly on a single channel); the session timeout default (24 hours vs. shorter); the limit buffer percentage. Next design tasks: the full table design of usage_events + the package schema (with the quota query), the output schema of the intent classifier and the intent lists for the two customers, the signal/timer skeleton of the session workflow, the data model and API endpoints of the panel inbox screen. Nothing is coded; the project is still in the design phase.
