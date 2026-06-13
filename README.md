# wagent-farm

Multi-tenant **agent farm**: many small, config-defined customer-support agents reached
through channel adapters. A channel-agnostic message **envelope** flows through a **tenant
gateway** (identity, limits, metering — enforced *before* the LLM) into **config-driven Mastra
agents**, backed by a single Postgres (+pgvector). Sessions are suspendable workflows.

> **Status:** scaffolding (Phase 0). The monorepo is built top-to-bottom from
> [`roadmap.md`](./roadmap.md), one small PR per task.

## Prerequisites

- **Node ≥ 24** (see `.nvmrc`)
- **pnpm 10** — `corepack enable` then `corepack use pnpm@10.26.1` (pinned via `packageManager`)
- **Docker** + Compose v2 (for local Postgres + pgvector)

## Quickstart

```bash
pnpm install                 # install workspace deps
cp .env.example .env         # then fill in ANTHROPIC_API_KEY / OPENAI_API_KEY

docker compose up -d         # start Postgres 16 + pgvector
pnpm db:ping                 # -> "accepting connections"

pnpm -r build                # build all packages
pnpm lint                    # ESLint (enforces the mastra import boundary, §12.1)
pnpm test                    # Vitest
```

## Architecture (ports & adapters)

The whole monorepo is one **hexagon**: `core` is the center (pure business logic + the
interfaces — *ports* — it needs), every other package is an *adapter* around it, and `apps/api`
is the *composition root* that wires them together. Postgres (`db`) and Mastra (`agents`/`tools`)
are swappable technologies that sit **behind ports** — `core` never names them.

```
   INBOUND / driving adapters            ⬡  CORE — the hexagon          OUTBOUND / driven adapters
   (they call the core)                  (pure: zod only — no            (the core calls them,
                                          mastra, no db, no HTTP)         each behind a core-owned port)

  ┌─────────────────────────┐                                          ┌─────────────────────────┐
  │ channels/               │                                          │ db/                     │
  │  console · ScriptChannel│                                          │  Drizzle · migrations · │
  │  whatsapp (parked)      │                                          │  tenant-scoped repos    │
  └─────────────────────────┘          ┌────────────────────┐         └─────────────────────────┘
              │                         │  domain/   types   │                      ▲
              │  InboundEnvelope        │  ports/    ifaces  │   SessionStore       │
              └───────────────────────▶ │  application/      │   ConversationStore  │
                                        │     use-cases      │ ◀────────────────────┘
  ┌─────────────────────────┐          │                    │                      ┌─────────────────────────┐
  │ apps/api                │ ───call─▶ │  resolveSession,   │   AgentRunner        │ agents/ + tools/        │
  │  HTTP · webhooks        │          │  turn pipeline,    │   Classifier         │  Mastra agents ·        │
  │  + COMPOSITION ROOT     │ ◀─Outbound│  gateway           │ ───────────────────▶ │  tool registry →        │
  │    (wires everything)   │  Envelope └────────────────────┘                      │  Shopify / Otosor APIs  │
  └─────────────────────────┘                                                       └─────────────────────────┘

   Dependency rule: every arrow points INWARD. `core` imports nothing of ours (zod only);
   channels / db / agents / tools import `core`; `apps/api` imports all of them and wires them.
   `core` ↔ `db` stay fully decoupled — the row→domain mapping lives in the composition root.
```

| Package | Hexagon role | What it holds | Imports `core`? | Mastra? |
| --- | --- | --- | --- | --- |
| `packages/core` | ⬡ **center** (domain + ports + application) | envelope, session/conversation domain, gateway, turn pipeline; defines the ports it needs | — (depends on nothing of ours) | ❌ never |
| `packages/db` | driven adapter (persistence) | Drizzle schema, migrations, tenant-scoped repositories | ❌ (kept decoupled) | ❌ |
| `packages/agents` · `packages/tools` | driven adapter (LLM) | config→agent factory, tool registry → external APIs | ✅ (implements core ports) | ✅ **only here** |
| `packages/channels` | driving adapter (input) | channel ⇄ envelope translation | ✅ (envelope + adapter iface) | ❌ |
| `apps/api` | driving adapter **+ composition root** | HTTP/webhooks **and** the wiring that injects adapters into core | ✅ (imports everything) | wiring only |

Structure is **role-shaped, not uniform**: `core` is laid out hexagonally inside
(`domain/`, `ports/`, `application/`); `db` is laid out per table (`schema/`, `repositories/`).

Dependency versions are centralized in the pnpm **catalog** (`pnpm-workspace.yaml`).

## Source-of-truth docs

- [`agent-building-principles.md`](./agent-building-principles.md) — the rules; **§12 is the
  PR review gate.**
- [`project-notes.md`](./project-notes.md) — architecture decisions & rationale (wins on conflict).
- [`roadmap.md`](./roadmap.md) — MVP task order (Phase 0→8).
- [`CLAUDE.md`](./CLAUDE.md) — working agreement & invariants for contributors/agents.
