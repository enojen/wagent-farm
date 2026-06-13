export {
  channelSchema,
  attachmentSchema,
  channelCapabilitiesSchema,
  inboundEnvelopeSchema,
  outboundEnvelopeSchema,
} from './domain/envelope.js';
export type {
  Channel,
  Attachment,
  ChannelCapabilities,
  InboundEnvelope,
  OutboundEnvelope,
} from './domain/envelope.js';
export { createKeyedLock } from './keyed-lock.js';
export type { KeyedLock } from './keyed-lock.js';
export type { Session, SessionStatus, ClosedReason } from './domain/session.js';
export type { ConversationKey, ConversationRef } from './domain/conversation.js';
export type { ConversationStore } from './ports/conversation-store.js';
export type { SessionStore, CreateSessionInput } from './ports/session-store.js';
export { resolveSession } from './application/session-manager.js';
export type {
  ResolveSessionPorts,
  ResolveSessionParams,
  ResolveSessionDeps,
  ResolveSessionResult,
} from './application/session-manager.types.js';
