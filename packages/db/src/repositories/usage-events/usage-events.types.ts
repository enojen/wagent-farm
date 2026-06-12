import type { UsageKind } from '../../types.js';

export interface InsertUsageEventInput {
  kind: UsageKind;
  sessionId?: string;
  tokensIn?: number;
  tokensOut?: number;
  costEstimate?: string;
}
