// Mirrors the YAML config shape in project-notes §8, minus three keys:
// tenant_id / plan live in their own tables (§10), and channels is dropped
// because the agent is channel-agnostic (§2) — capabilities arrive per
// envelope. Connector details (base_url, credentials) belong to the tool
// layer, not here: the config only enables tools by name (§12.7).
// The §8 voice layer (identity / persona / tone / output_style / formality /
// uncertainty_behavior / rag_grounding / language / messages) is deliberately
// absent here: it lands with the core zod schema + config→agent factory (T4.2),
// which is what compiles it into the agent's system prompt. No factory consumes
// this type yet, so seeding it would be dead data.
// Seed-local stopgap, deliberately not exported from the package: the real
// contract will be a zod schema in core, and this interface dies with it.
export interface AgentConfigV1 {
  model: string;
  agent_type: string;
  procedures: { name: string; text: string }[];
  tools: string[];
  knowledge_base: { vector_namespace: string };
  scope: { allowed: string[]; forbidden: string[]; off_topic_message: string };
  handoff: { triggers: string[]; confidence_threshold: number };
  session: {
    timeout_hours: number;
    post_resolution_wait_min: number;
    new_session_on_topic_change: boolean;
    debounce_seconds: number;
  };
}

export interface DemoAgent {
  key: string;
  name: string;
  config: AgentConfigV1;
}

export interface DemoTenant {
  slug: string;
  name: string;
  agents: DemoAgent[];
}

export const demoPlan = {
  name: 'demo',
  monthlyTokens: 2_000_000,
  messagesPerMinute: 60,
};

const handoff = {
  triggers: ['user_requested', 'low_confidence', 'complaint', 'three_failed_attempts'],
  confidence_threshold: 0.7,
};

const session = {
  timeout_hours: 24,
  post_resolution_wait_min: 30,
  new_session_on_topic_change: true,
  debounce_seconds: 5,
};

export const demoTenants: DemoTenant[] = [
  {
    slug: 'otosor-demo',
    name: 'Otosor Demo',
    agents: [
      {
        key: 'sales',
        name: 'Sales Assistant',
        config: {
          model: 'anthropic:claude-sonnet-4-6',
          agent_type: 'customer_support',
          procedures: [
            {
              name: 'test_drive_appointment',
              text: 'For anyone wanting a test drive: ask the city → show suitable listings → propose appointment slots.',
            },
          ],
          tools: ['search_vehicles', 'listing_detail', 'create_appointment'],
          knowledge_base: { vector_namespace: 'tenant_otosor' },
          scope: {
            allowed: ['vehicle_search', 'listing_detail', 'appointment', 'inspection_faq'],
            forbidden: ['price_negotiation', 'legal_advice', 'competitor_comment'],
            off_topic_message:
              "I'm the Otosor assistant; I can help with vehicle listings and appointments.",
          },
          handoff,
          session,
        },
      },
      {
        key: 'after-sales',
        name: 'After-Sales Assistant',
        config: {
          model: 'anthropic:claude-sonnet-4-6',
          agent_type: 'customer_support',
          procedures: [
            {
              name: 'service_appointment',
              text: 'For service or inspection requests: ask the city and the vehicle → propose available service slots → confirm the appointment.',
            },
          ],
          tools: ['create_appointment', 'listing_detail'],
          knowledge_base: { vector_namespace: 'tenant_otosor' },
          scope: {
            allowed: ['service_appointment', 'warranty_faq', 'complaint_intake'],
            forbidden: ['price_negotiation', 'legal_advice', 'competitor_comment'],
            off_topic_message:
              "I'm the Otosor after-sales assistant; I can help with service appointments and warranty questions.",
          },
          handoff,
          session,
        },
      },
    ],
  },
  {
    slug: 'shopify-demo',
    name: 'Shopify Demo Store',
    agents: [
      {
        key: 'support',
        name: 'Store Assistant',
        config: {
          model: 'anthropic:claude-sonnet-4-6',
          agent_type: 'customer_support',
          procedures: [
            {
              name: 'return_flow',
              text: 'For return requests: look up the order → check it is delivered and within the 14-day window → explain the return steps, and hand off if the customer disputes.',
            },
          ],
          tools: ['query_order', 'search_product'],
          knowledge_base: { vector_namespace: 'tenant_shopify' },
          scope: {
            allowed: ['order_status', 'product_search', 'return_request'],
            forbidden: ['discount_negotiation', 'payment_dispute'],
            off_topic_message:
              "I'm the store assistant; I can help with orders, products, and returns.",
          },
          handoff,
          session,
        },
      },
    ],
  },
];
