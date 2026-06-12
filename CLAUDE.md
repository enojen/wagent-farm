# Agent Farm — CLAUDE.md

Multi-tenant **agent farm**: many small, config-defined customer-support agents (first
tenants: a Shopify store and `otosor.com`) reached through channel adapters. Channel-agnostic
message **envelope** → **tenant gateway** (identity, limits, metering — enforced *before* the
LLM) → **config-driven Mastra agents** → one Postgres (+pgvector). Sessions are suspendable
workflows.

**Status:** design phase. No code yet — the monorepo is scaffolded by following `@roadmap.md`
top to bottom, one small PR per task.

## Source-of-truth docs (read before non-trivial work)

- `@agent-building-principles.md` — the rules. **Read §12 (hard-rules checklist) before
  writing or modifying any agent, tool, workflow, or RAG code.** It is the PR review gate.
- `@project-notes.md` — architecture decisions & rationale. Wins on
  any conflict with the principles doc.
- `@roadmap.md` — MVP task order (Phase 0→8). Work top-to-bottom, one task at a time.

## Stack (decided)

- TypeScript (strict everywhere), pnpm workspaces monorepo.
- **Mastra** as a library — imported ONLY inside `packages/agents` + `packages/tools`.
- Hono (`apps/api`), Postgres 16 + pgvector via Docker, Drizzle ORM, Vitest.
- Latest Claude models — Opus 4.8, Sonnet 4.6, Haiku 4.5 — selected via the model-routing
  config. Never hardcode a model name in agent logic; per-tenant model is a config field.

## Monorepo layout (target — scaffold per roadmap T0.1)

```
apps/api/            Hono API + webhooks (later phases)
packages/core/       envelope, gateway, sessions, turn pipeline — NEVER imports mastra
packages/channels/   channel ⇄ envelope adapters (console first, WhatsApp parked)
packages/db/         Drizzle schema, migrations, tenant-scoped repositories
packages/agents/     Mastra agents + config→agent factory (mastra allowed)
packages/tools/      per-tenant tools, central registry (mastra allowed)
```

## Commands

Each is available only after the roadmap task that introduces it — do not assume they exist
before then.

| Command | Purpose | Available after |
| --- | --- | --- |
| `pnpm -r build` | build all packages | T0.1 |
| `docker compose up -d` | Postgres + pgvector | T0.3 |
| `pnpm db:migrate` | run Drizzle migrations | T1.1 |
| `pnpm db:seed` | seed demo tenants + data (idempotent) | T1.3 |
| `pnpm dev:chat --tenant otosor-demo --user phone:+90...` | console REPL | T3.2 |
| `pnpm eval` | run eval suite | T7.2 |

## Non-negotiable invariants

The full list is §12 of `@agent-building-principles.md` — **read it**. The highest-leverage
ones, restated because breaking them causes real bugs:

1. `mastra` / `@mastra/*` is imported ONLY in `packages/agents` and `packages/tools`. Core,
   channels, db, and apps must not know it exists (keeps the framework choice reversible).
2. Every vector operation carries the tenant namespace **and** a `tenant_id` metadata filter.
   No unfiltered queries, ever.
3. The gateway checks package limits and writes a `usage_events` row **before** any LLM
   dispatch. Every span and log line carries `tenant_id`.
4. One model call per workflow step; step I/O is meaningful and trace-worthy; workflow state
   persists to Postgres (no in-memory-only suspensions).
5. Model names, prompts, procedures, scope lists, session rules, and limits live in tenant
   config — never hardcoded. No branching on tenant identity inside agent code.
6. No agent execution inside webhook handlers — acknowledge, enqueue, process async.

## Git workflow

- Trunk-based: `main` is always green/deployable. Branch per roadmap task off `main`, open a
  PR, **squash-merge** once CI and the §12 checklist pass. Keep branches short-lived.
- Branch names: `<type>/<TaskId>-<kebab-summary>` — e.g. `feat/T1.2-tenant-repo`,
  `chore/T0.3-docker-infra`.
- Commits: Conventional Commits with a package scope — `type(scope): summary`.
  - types: `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `build` | `ci`
  - scope: `core` | `db` | `agents` | `tools` | `channels` | `api` | `repo`
  - Subject: imperative, English, ≤ ~70 chars, lower-case, no trailing period.
  - **Do NOT add a `Co-Authored-By` / Claude signature trailer.**
  - Examples: `feat(db): add usage_events table` ·
    `fix(core): serialize concurrent turns per conversation` ·
    `chore(repo): add gitignore and CLAUDE.md`

## Working agreement

Every task = one small PR. §12 is the review gate. If a task balloons, split it rather than
batching. Align on architecture and spec the tool list before writing agent code; put a
human-in-the-loop checkpoint on anything irreversible.
