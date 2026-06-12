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

## Monorepo layout

```
apps/api/            Hono API + webhooks (later phases)
packages/core/       envelope, gateway, sessions, turn pipeline — NEVER imports mastra
packages/channels/   channel ⇄ envelope adapters (console first, WhatsApp parked)
packages/db/         Drizzle schema, migrations, tenant-scoped repositories
packages/agents/     Mastra agents + config→agent factory (mastra allowed)
packages/tools/      per-tenant tools, central registry (mastra allowed)
```

Dependency versions are centralized in the pnpm **catalog** (`pnpm-workspace.yaml`).

## Source-of-truth docs

- [`agent-building-principles.md`](./agent-building-principles.md) — the rules; **§12 is the
  PR review gate.**
- [`project-notes.md`](./project-notes.md) — architecture decisions & rationale (wins on conflict).
- [`roadmap.md`](./roadmap.md) — MVP task order (Phase 0→8).
- [`CLAUDE.md`](./CLAUDE.md) — working agreement & invariants for contributors/agents.
