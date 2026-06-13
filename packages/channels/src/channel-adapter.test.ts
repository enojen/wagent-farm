import { describe, expect, it } from 'vitest';
import type { InboundEnvelope, OutboundEnvelope } from '@wagent/core';
import type { ChannelAdapter, TurnHandler } from './channel-adapter.js';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

class FakeAdapter implements ChannelAdapter {
  readonly channel = 'console' as const;
  readonly capabilities = { supportsStreaming: false, supportsRichReplies: false };
  readonly sent: OutboundEnvelope[] = [];

  constructor(private readonly handler: TurnHandler) {}

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  send(envelope: OutboundEnvelope): Promise<void> {
    this.sent.push(envelope);
    return Promise.resolve();
  }

  async receive(envelope: InboundEnvelope): Promise<void> {
    const reply = await this.handler(envelope);
    if (reply) await this.send(reply);
  }
}

describe('ChannelAdapter contract', () => {
  const inbound: InboundEnvelope = {
    tenantId: TENANT_ID,
    channel: 'console',
    endUserId: 'phone:+905551112233',
    text: 'merhaba',
  };

  it('emits the handler reply through send()', async () => {
    const handler: TurnHandler = (e) =>
      Promise.resolve({
        tenantId: e.tenantId,
        channel: e.channel,
        endUserId: e.endUserId,
        text: 'selam',
      });
    const adapter = new FakeAdapter(handler);

    await adapter.start();
    await adapter.receive(inbound);
    await adapter.stop();

    expect(adapter.sent).toEqual([
      { tenantId: TENANT_ID, channel: 'console', endUserId: inbound.endUserId, text: 'selam' },
    ]);
  });

  it('emits nothing when the handler returns undefined (debounced turn)', async () => {
    const adapter = new FakeAdapter(() => Promise.resolve(undefined));

    await adapter.receive(inbound);

    expect(adapter.sent).toEqual([]);
  });
});
