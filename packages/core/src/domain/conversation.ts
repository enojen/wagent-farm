import type { Channel } from './envelope.js';

// The permanent thread a session lives in: (tenant, channel, end user). Never closes.
export interface ConversationKey {
  channel: Channel;
  endUserId: string;
}

// Minimal handle the resolver needs once the conversation is located/created.
export interface ConversationRef {
  id: string;
}
