export type SessionStatus = 'open' | 'closed';

// Why a session closed (project-notes §5 close rules) + `handoff` for agent→agent/human
// transfer within one conversation. Mirrored by the db `closed_reason` pgEnum
// (packages/db src/schema/enums.ts); core owns the canonical list, db never imports core.
export type ClosedReason = 'timeout' | 'resolved' | 'topic_change' | 'manual' | 'handoff';

// One agent handling one "current concern" inside a conversation (project-notes §5, §10).
export interface Session {
  id: string;
  tenantId: string;
  conversationId: string;
  agentId: string;
  status: SessionStatus;
  closedReason: ClosedReason | null;
  createdAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
}

const MS_PER_HOUR = 3_600_000;

// Inactivity rule (project-notes §5): a session is reusable until it has been idle longer
// than the tenant's configured timeout.
export function isExpired(session: Session, at: Date, timeoutHours: number): boolean {
  return at.getTime() - session.lastActivityAt.getTime() > timeoutHours * MS_PER_HOUR;
}
