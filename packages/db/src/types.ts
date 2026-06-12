import {
  channel,
  closedReason,
  messageRole,
  sessionStatus,
  usageKind,
} from './schema/enums.js';

export type Channel = (typeof channel.enumValues)[number];
export type SessionStatus = (typeof sessionStatus.enumValues)[number];
export type ClosedReason = (typeof closedReason.enumValues)[number];
export type MessageRole = (typeof messageRole.enumValues)[number];
export type UsageKind = (typeof usageKind.enumValues)[number];
