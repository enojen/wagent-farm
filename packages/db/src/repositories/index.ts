import type { Db } from '../client.js';
import { createAgentConfigsRepository } from './agent-configs/agent-configs.js';
import { createAgentsRepository } from './agents/agents.js';
import { createConversationsRepository } from './conversations/conversations.js';
import { createMessagesRepository } from './messages/messages.js';
import { createPlansRepository } from './plans/plans.js';
import { createProfileFactsRepository } from './profile-facts/profile-facts.js';
import { createSessionsRepository } from './sessions/sessions.js';
import { createTenantsRepository } from './tenants/tenants.js';
import { createUsageEventsRepository } from './usage-events/usage-events.js';

export function createRepositories(db: Db) {
  return {
    plans: createPlansRepository(db),
    tenants: createTenantsRepository(db),
    agents: createAgentsRepository(db),
    agentConfigs: createAgentConfigsRepository(db),
    conversations: createConversationsRepository(db),
    sessions: createSessionsRepository(db),
    messages: createMessagesRepository(db),
    usageEvents: createUsageEventsRepository(db),
    profileFacts: createProfileFactsRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
