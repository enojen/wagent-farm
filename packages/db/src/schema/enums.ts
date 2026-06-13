import { pgEnum } from 'drizzle-orm/pg-core';

// Channel the message entered/left through. WhatsApp is parked; console is the dev REPL.
export const channel = pgEnum('channel', ['whatsapp', 'web', 'console']);

// Mirrors the core `SessionStatus` union (packages/core domain/session.ts); core owns the
// canonical list, db never imports core. Keep the two in sync.
export const sessionStatus = pgEnum('session_status', ['open', 'closed']);

// Why a session was closed — the config-driven close rules (project-notes §5), plus `handoff`
// for agent→agent / agent→human transfer. Mirrors the core `ClosedReason` union
// (packages/core domain/session.ts); core owns the canonical list, db never imports core.
export const closedReason = pgEnum('closed_reason', [
  'timeout',
  'resolved',
  'topic_change',
  'manual',
  'handoff',
]);

export const messageRole = pgEnum('message_role', ['user', 'assistant', 'system', 'tool']);

// What a usage_events row meters: an LLM call, a tool invocation, or a message.
export const usageKind = pgEnum('usage_kind', ['llm', 'tool', 'message']);
