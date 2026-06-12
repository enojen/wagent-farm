import type { Channel } from '../../types.js';

export interface GetOrCreateConversationInput {
  channel: Channel;
  endUserId: string;
}
