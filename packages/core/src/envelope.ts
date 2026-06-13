import { z } from 'zod';

// Mirrors the db `channel` pgEnum (packages/db src/schema/enums.ts); core owns the
// canonical list, db never imports core. Keep the two in sync when adding a channel.
export const channelSchema = z.enum(['whatsapp', 'web', 'console']);

export const attachmentSchema = z.strictObject({
  url: z.string(),
  mimeType: z.string().optional(),
});

export const channelCapabilitiesSchema = z.strictObject({
  supportsStreaming: z.boolean(),
  supportsRichReplies: z.boolean(),
  // undefined = the channel has no such notion (console/web); WhatsApp 24h window (notes §5).
  freeReplyWindowOpen: z.boolean().optional(),
});

export const inboundEnvelopeSchema = z.strictObject({
  // Resolved upstream (adapter/gateway, identity -> tenant); never set by the LLM.
  tenantId: z.uuid(),
  channel: channelSchema,
  endUserId: z.string().min(1),
  text: z.string(),
  attachments: z.array(attachmentSchema).optional(),
  capabilities: channelCapabilitiesSchema.optional(),
});

export const outboundEnvelopeSchema = z.strictObject({
  tenantId: z.uuid(),
  channel: channelSchema,
  endUserId: z.string().min(1),
  text: z.string(),
});

export type Channel = z.infer<typeof channelSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ChannelCapabilities = z.infer<typeof channelCapabilitiesSchema>;
export type InboundEnvelope = z.infer<typeof inboundEnvelopeSchema>;
export type OutboundEnvelope = z.infer<typeof outboundEnvelopeSchema>;
