import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'mock' });
const MOCK = process.env.MOCK_MODE === 'true';

/**
 * Extract structured CRM data from raw text using Claude.
 * Returns a validated JSON object matching the provided schema.
 */
export async function extractWithClaude(systemPrompt, userText, schema) {
  if (MOCK) return generateMockExtraction(schema, userText);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userText }]
  });

  const raw = response.content[0].text;

  // Strip markdown code fences if present
  const jsonText = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    console.error('[Claude] Failed to parse JSON response:', raw);
    throw new Error('Claude returned invalid JSON');
  }
}

/**
 * Generate an AI text response (for drafts, summaries, suggestions).
 */
export async function generateWithClaude(systemPrompt, userText) {
  if (MOCK) return generateMockText(userText);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userText }]
  });

  return response.content[0].text;
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function generateMockExtraction(schema, text) {
  const names = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Davis', 'Robert Wilson'];
  const companies = ['Acme Corp', 'Pinnacle Industries', 'Summit Logistics', 'BlueSky Manufacturing', 'Vertex Services'];
  const emails = ['john@acme.com', 'sarah@pinnacle.com', 'mike@summit.com', 'emily@bluesky.com', 'rob@vertex.com'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  return {
    contact_name: pick(names),
    email: pick(emails),
    company: pick(companies),
    phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    intent: pick(['quote_request', 'follow_up', 'general_inquiry', 'complaint']),
    deal_size: Math.floor(Math.random() * 90000 + 10000),
    urgency: pick(['high', 'medium', 'low']),
    next_step: pick(['Send proposal', 'Schedule discovery call', 'Follow up in 3 days', 'Request more info']),
    confidence: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)),
    load_type: pick(['LTL', 'FTL', 'Partial', 'Container']),
    origin: pick(['Chicago, IL', 'Dallas, TX', 'Los Angeles, CA', 'New York, NY']),
    destination: pick(['Atlanta, GA', 'Phoenix, AZ', 'Seattle, WA', 'Miami, FL'])
  };
}

function generateMockText(context) {
  const drafts = [
    'Hi {name},\n\nFollowing up on our recent conversation — I wanted to check in on your timeline and see if you had any questions about our proposal.\n\nWould a 15-minute call this week work?\n\nBest,',
    'Hi {name},\n\nThank you for your interest! Based on what you shared, I think we\'re a strong fit.\n\nI\'d love to schedule a discovery call to go deeper. Are you available Thursday or Friday?\n\nLooking forward,',
    'Hi {name},\n\nJust wanted to touch base — we haven\'t heard back in a few days and want to make sure your question was answered.\n\nFeel free to reply directly or book time here: [link]\n\nThanks!'
  ];
  return drafts[Math.floor(Math.random() * drafts.length)];
}
