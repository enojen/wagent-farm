// Raw schema tables are deliberately not exported: every query must go
// through the repositories' tenant filter.
export { createDb, type Db } from './client.js';
export { createRepositories, type Repositories } from './repositories/index.js';
export { TenantScopeError } from './errors.js';
export type {
  Channel,
  ClosedReason,
  MessageRole,
  SessionStatus,
  UsageKind,
} from './types.js';
export type { UpsertPlanInput } from './repositories/plans/plans.types.js';
export type { UpsertTenantInput } from './repositories/tenants/tenants.types.js';
export type { UpsertAgentInput } from './repositories/agents/agents.types.js';
export type { UpsertAgentConfigInput } from './repositories/agent-configs/agent-configs.types.js';
export type { GetOrCreateConversationInput } from './repositories/conversations/conversations.types.js';
export type { CreateSessionInput } from './repositories/sessions/sessions.types.js';
export type { InsertMessageInput } from './repositories/messages/messages.types.js';
export type { InsertUsageEventInput } from './repositories/usage-events/usage-events.types.js';
export type { UpsertProfileFactInput } from './repositories/profile-facts/profile-facts.types.js';
export type { Plan, NewPlan } from './schema/plans.js';
export type { Tenant, NewTenant } from './schema/tenants.js';
export type { Agent, NewAgent } from './schema/agents.js';
export type { AgentConfig, NewAgentConfig } from './schema/agent-configs.js';
export type { Conversation, NewConversation } from './schema/conversations.js';
export type { Session, NewSession } from './schema/sessions.js';
export type { Message, NewMessage } from './schema/messages.js';
export type { UsageEvent, NewUsageEvent } from './schema/usage-events.js';
export type { Document, NewDocument } from './schema/documents.js';
export type { Chunk, NewChunk } from './schema/chunks.js';
export type { ProfileFact, NewProfileFact } from './schema/profile-facts.js';
