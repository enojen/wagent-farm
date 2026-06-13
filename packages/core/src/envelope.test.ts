import { describe, expect, it } from 'vitest';
import {
  channelCapabilitiesSchema,
  inboundEnvelopeSchema,
  outboundEnvelopeSchema,
} from './envelope.js';

const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const validInbound = {
  tenantId: TENANT_ID,
  channel: 'console' as const,
  endUserId: 'phone:+905550000001',
  text: 'is there a diesel SUV under 20k?',
};

describe('inboundEnvelopeSchema', () => {
  it('parses a minimal console envelope', () => {
    expect(inboundEnvelopeSchema.parse(validInbound)).toEqual(validInbound);
  });

  it('treats attachments and capabilities as optional', () => {
    const withExtras = {
      ...validInbound,
      attachments: [{ url: 'https://x/y.pdf' }],
      capabilities: { supportsStreaming: false, supportsRichReplies: true },
    };
    expect(inboundEnvelopeSchema.parse(withExtras)).toEqual(withExtras);
  });

  it('rejects a missing required field', () => {
    const noText = {
      tenantId: TENANT_ID,
      channel: 'console' as const,
      endUserId: 'phone:+905550000001',
    };
    expect(inboundEnvelopeSchema.safeParse(noText).success).toBe(false);
    expect(
      inboundEnvelopeSchema.safeParse({ ...validInbound, endUserId: '' }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid tenantId and an unknown channel', () => {
    expect(
      inboundEnvelopeSchema.safeParse({ ...validInbound, tenantId: 'otosor-demo' }).success,
    ).toBe(false);
    expect(
      inboundEnvelopeSchema.safeParse({ ...validInbound, channel: 'sms' }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      inboundEnvelopeSchema.safeParse({ ...validInbound, conversationId: 'x' }).success,
    ).toBe(false);
  });
});

describe('channelCapabilitiesSchema', () => {
  it('allows freeReplyWindowOpen to be omitted', () => {
    const caps = { supportsStreaming: true, supportsRichReplies: false };
    expect(channelCapabilitiesSchema.parse(caps)).toEqual(caps);
  });
});

describe('outboundEnvelopeSchema', () => {
  it('parses a reply envelope', () => {
    const reply = {
      tenantId: TENANT_ID,
      channel: 'console' as const,
      endUserId: 'phone:+905550000001',
      text: 'Yes — we have two diesel SUVs under 20k.',
    };
    expect(outboundEnvelopeSchema.parse(reply)).toEqual(reply);
  });
});
