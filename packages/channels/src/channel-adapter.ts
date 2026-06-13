import type {
  Channel,
  ChannelCapabilities,
  InboundEnvelope,
  OutboundEnvelope,
} from '@wagent/core';

// undefined = the turn was folded into a later one by the debouncer; nothing to emit.
export type TurnHandler = (
  envelope: InboundEnvelope,
) => Promise<OutboundEnvelope | undefined>;

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: ChannelCapabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(envelope: OutboundEnvelope): Promise<void>;
}
