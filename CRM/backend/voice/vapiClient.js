import axios from 'axios';
import { v4 as uuid } from 'uuid';

const VAPI_BASE = 'https://api.vapi.ai';
const MOCK = process.env.MOCK_MODE === 'true';

function headers() {
  return { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' };
}

// ─── Call Management ─────────────────────────────────────────────────────────

export async function createOutboundCall(phoneNumber, assistantId, metadata = {}) {
  if (MOCK) return mockCall(phoneNumber, 'outbound', metadata);

  const res = await axios.post(`${VAPI_BASE}/call`, {
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: phoneNumber },
    assistantId,
    metadata
  }, { headers: headers() });

  return res.data;
}

export async function createAssistant(config, scriptType) {
  if (MOCK) return { id: `asst_${uuid().slice(0, 8)}`, name: `${config.clientId}_${scriptType}` };

  const script = buildAssistantScript(config, scriptType);
  const res = await axios.post(`${VAPI_BASE}/assistant`, script, { headers: headers() });
  return res.data;
}

export async function getCallDetails(callId) {
  if (MOCK) return mockCallDetails(callId);
  const res = await axios.get(`${VAPI_BASE}/call/${callId}`, { headers: headers() });
  return res.data;
}

export async function listCalls(limit = 20) {
  if (MOCK) return { results: Array.from({ length: limit }, () => mockCallDetails(uuid())) };
  const res = await axios.get(`${VAPI_BASE}/call?limit=${limit}`, { headers: headers() });
  return res.data;
}

// ─── Assistant Script Builder ─────────────────────────────────────────────────

function buildAssistantScript(config, scriptType) {
  const voiceName = config.voice.voiceId || 'jennifer';
  const questions = config.voice.qualificationQuestions || [];

  const scripts = {
    inbound: {
      name: `${config.name} — Inbound Assistant`,
      model: {
        provider: 'anthropic',
        model: 'claude-haiku-20240307',
        systemPrompt: `You are a friendly, professional AI assistant for ${config.name}, a ${config.industry} company. 
Your job is to answer inbound calls, qualify leads, and collect key information.

Key qualification questions to ask naturally:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

After qualifying, offer to connect them with a team member or book a meeting.
Be concise, professional, and helpful. Keep conversations under 3 minutes.`
      },
      voice: { provider: 'playht', voiceId: voiceName },
      endCallMessage: 'Thank you for calling! We\'ll be in touch soon. Have a great day!',
      endCallPhrases: ['goodbye', 'bye', 'hang up', 'end call', 'that\'s all']
    },
    outbound: {
      name: `${config.name} — Follow-up Assistant`,
      model: {
        provider: 'anthropic',
        model: 'claude-haiku-20240307',
        systemPrompt: `You are a professional follow-up caller for ${config.name}. 
You're calling to follow up on a previous inquiry or quote. 

Your goals:
1. Confirm they received our information
2. Answer any questions they have
3. Either move the deal forward or understand why not
4. Book a follow-up call or meeting if interested

Be warm, not pushy. Respect their time.`
      },
      voice: { provider: 'playht', voiceId: voiceName },
      endCallMessage: 'Thank you for your time! I\'ll send you a follow-up email. Have a wonderful day!',
      endCallPhrases: ['goodbye', 'bye', 'not interested', 'remove me']
    }
  };

  return scripts[scriptType] || scripts.inbound;
}

// ─── Mock Generators ──────────────────────────────────────────────────────────

function mockCall(phone, direction, metadata) {
  return {
    id: `call_${uuid().slice(0, 8)}`,
    status: 'queued',
    direction,
    customer: { number: phone },
    metadata,
    createdAt: new Date().toISOString()
  };
}

function mockCallDetails(callId) {
  const outcomes = ['qualified', 'voicemail', 'not_interested', 'callback_requested', 'meeting_booked'];
  const names = ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Emily Davis'];
  const durations = [45, 120, 180, 240, 90, 30];

  return {
    id: callId || `call_${uuid().slice(0, 8)}`,
    status: 'ended',
    direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
    duration: durations[Math.floor(Math.random() * durations.length)],
    outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
    contact_name: names[Math.floor(Math.random() * names.length)],
    contact_phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    summary: 'Lead expressed interest in services. Has budget approved. Wants to schedule a demo next week.',
    transcript: 'Agent: Hi, this is Nicole from our team. Am I speaking with the right person?\nContact: Yes, speaking.\nAgent: Great! I\'m following up on your recent inquiry about our services...',
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date().toISOString()
  };
}
