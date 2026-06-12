export interface UpsertAgentConfigInput {
  agentId: string;
  version: number;
  config: unknown;
}
