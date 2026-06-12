import type { MessageRole } from '../../types.js';

export interface InsertMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
  envelope?: unknown;
}
