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

function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

export const api = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getOverview:    (c) => req('GET',  '/dashboard/overview', null, c),
  getPipeline:    (c) => req('GET',  '/dashboard/pipeline', null, c),
  getActivity:    (c, limit = 30) => req('GET', `/dashboard/activity?limit=${limit}`, null, c),
  getClients:     ()  => req('GET',  '/dashboard/clients'),

  // ── Contacts ───────────────────────────────────────────────────────────────
  getContacts:    (params, c) => req('GET', `/contacts${buildQuery(params)}`, null, c),
  getContact:     (id, c)     => req('GET', `/contacts/${id}`, null, c),
  createContact:  (body, c)   => req('POST', '/contacts', body, c),
  updateContact:  (id, body, c) => req('PATCH', `/contacts/${id}`, body, c),
  scoreContact:   (id, c)     => req('POST', `/contacts/${id}/score`, {}, c),
  addContactNote: (id, body, c) => req('POST', `/contacts/${id}/note`, body, c),
  getContactStats:(c)         => req('GET', '/contacts/stats/summary', null, c),

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
  coachCall:      (body, c)      => req('POST', '/ai/coach', body, c),
  getForecast:    (c)            => req('GET',  '/ai/forecast', null, c),
  getInsights:    (c)            => req('GET',  '/ai/insights', null, c),

  // ── Onboarding ─────────────────────────────────────────────────────────────
  getOnboardingPresets: () => req('GET', '/onboarding/presets'),
  createTenant:   (body) => req('POST', '/onboarding/tenant', body),
  getChecklist:   (clientId) => req('GET', `/onboarding/checklist/${clientId}`),

  // ── Config ─────────────────────────────────────────────────────────────────
  getConfig:      (clientId) => req('GET', `/config/${clientId}`),
  getHealth:      () => req('GET', '/health'),
};
