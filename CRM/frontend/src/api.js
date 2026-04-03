// Central API client — all fetch calls go through here
const BASE = '/api';

function clientHeaders(clientId) {
  return {
    'Content-Type': 'application/json',
    'X-Client-ID': clientId || localStorage.getItem('crm_client_id') || 'client_logistics'
  };
}

async function req(method, path, body, clientId) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: clientHeaders(clientId),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getOverview:    (c) => req('GET',  '/dashboard/overview', null, c),
  getPipeline:    (c) => req('GET',  '/dashboard/pipeline', null, c),
  getActivity:    (c, limit = 30) => req('GET', `/dashboard/activity?limit=${limit}`, null, c),
  getClients:     ()  => req('GET',  '/dashboard/clients'),

  // ── Parser ─────────────────────────────────────────────────────────────────
  parseEmail:     (body, c) => req('POST', '/parse/email', body, c),
  parseTranscript:(body, c) => req('POST', '/parse/transcript', body, c),
  parseCsv:       (body, c) => req('POST', '/parse/csv', body, c),
  parseDocument:  (body, c) => req('POST', '/parse/document', body, c),
  getParseJobs:   (c)       => req('GET',  '/parse/jobs', null, c),

  // ── Voice ──────────────────────────────────────────────────────────────────
  getCalls:       (c) => req('GET',  '/voice/calls', null, c),
  getCallStats:   (c) => req('GET',  '/voice/stats', null, c),
  triggerCall:    (body, c) => req('POST', '/voice/call', body, c),
  runCampaign:    (body, c) => req('POST', '/voice/campaign', body, c),

  // ── Intelligence ───────────────────────────────────────────────────────────
  getScore:       (contactId, c) => req('GET',  `/ai/score/${contactId}`, null, c),
  getNba:         (contactId, c) => req('GET',  `/ai/nba/${contactId}`, null, c),
  getRisk:        (c)            => req('GET',  '/ai/risk', null, c),
  draftEmail:     (body, c)      => req('POST', '/ai/draft', body, c),
  getForecast:    (c)            => req('GET',  '/ai/forecast', null, c),
  getInsights:    (c)            => req('GET',  '/ai/insights', null, c),

  // ── Config ─────────────────────────────────────────────────────────────────
  getConfig:      (clientId) => req('GET', `/config/${clientId}`),
};
