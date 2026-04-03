import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const INTEGRATIONS = [
  {
    id: 'gmail', label: 'Gmail', icon: '📧', configKey: 'gmail',
    description: 'Two-way email sync. Inbound emails auto-parsed into CRM contacts.',
    setupNote: 'Requires Google OAuth2 credentials + Pub/Sub topic',
    docsUrl: 'https://developers.google.com/gmail/api'
  },
  {
    id: 'twilio', label: 'Twilio SMS', icon: '💬', configKey: 'twilio',
    description: 'Automated SMS follow-ups, drip sequences, inbound reply handling.',
    setupNote: 'Requires Account SID, Auth Token, and phone number',
    docsUrl: 'https://www.twilio.com/docs/sms'
  },
  {
    id: 'slack', label: 'Slack', icon: '💼', configKey: 'slack',
    description: 'Real-time deal alerts, pipeline updates, and team notifications.',
    setupNote: 'Requires a Slack Bot Token and channel ID',
    docsUrl: 'https://api.slack.com'
  },
  {
    id: 'calendly', label: 'Calendly', icon: '📅', configKey: 'calendly',
    description: 'Meeting booked → deal stage auto-updates, Slack alert fired.',
    setupNote: 'Requires Calendly webhook signing key',
    docsUrl: 'https://developer.calendly.com'
  },
  {
    id: 'stripe', label: 'Stripe', icon: '💳', configKey: 'stripe',
    description: 'Payment received → contact upgraded to Customer in CRM.',
    setupNote: 'Requires Stripe webhook secret',
    docsUrl: 'https://stripe.com/docs/webhooks'
  },
  {
    id: 'docusign', label: 'DocuSign', icon: '✍️', configKey: 'docusign',
    description: 'Contract signed → deal automatically marked Closed Won.',
    setupNote: 'DocuSign Connect webhook integration',
    docsUrl: 'https://developers.docusign.com'
  },
  {
    id: 'vapi', label: 'Vapi Voice AI', icon: '🎙️', configKey: null,
    description: 'AI voice agents for inbound qualification and outbound follow-up.',
    setupNote: 'Requires Vapi API key and phone number',
    docsUrl: 'https://vapi.ai/docs',
    alwaysOn: true
  },
  {
    id: 'hubspot', label: 'HubSpot CRM', icon: '🟠', configKey: null,
    description: 'Core CRM backend. All contacts, deals, and activities sync here.',
    setupNote: 'Create a Private App → generate access token',
    docsUrl: 'https://developers.hubspot.com',
    alwaysOn: true
  },
];

const WEBHOOK_ENDPOINTS = [
  { label: 'Vapi (call ended)',    path: '/webhook/vapi', method: 'POST', badge: 'badge-blue' },
  { label: 'HubSpot events',       path: '/webhook/hubspot', method: 'POST', badge: 'badge-orange' },
  { label: 'Gmail Pub/Sub',        path: '/webhook/gmail', method: 'POST', badge: 'badge-green' },
  { label: 'Calendly booking',     path: '/webhook/calendly', method: 'POST', badge: 'badge-purple' },
  { label: 'Stripe payment',       path: '/webhook/stripe', method: 'POST', badge: 'badge-green' },
  { label: 'Twilio SMS inbound',   path: '/webhook/twilio/sms', method: 'POST', badge: 'badge-muted' },
];

export default function Integrations() {
  const { clientId } = useClient();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.getConfig(clientId);
      setConfig(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const isActive = (configKey, alwaysOn) => {
    if (alwaysOn) return true;
    if (!configKey || !config?.integrations) return false;
    return !!config.integrations[configKey];
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Integrations</h1>
        <p className="page-subtitle">Configure per-client integration toggles in config/client_*.json — all webhooks auto-register</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <>
          {/* Integration Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 40 }}>
            {INTEGRATIONS.map(intg => {
              const active = isActive(intg.configKey, intg.alwaysOn);
              return (
                <div key={intg.id} className={`integration-card ${active ? 'active' : ''}`} id={`integration-${intg.id}`}>
                  <div className="integration-icon" style={{ background: active ? 'rgba(79,142,247,0.1)' : 'var(--bg-elevated)', fontSize: '1.6rem' }}>
                    {intg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{intg.label}</span>
                      {intg.alwaysOn && <span className="badge badge-blue">Core</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{intg.description}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⚙️ {intg.setupNote}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {active ? (
                      <CheckCircle size={20} color="var(--accent-success)" />
                    ) : (
                      <XCircle size={20} color="var(--text-muted)" />
                    )}
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: active ? 'var(--accent-success)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {intg.alwaysOn ? 'Always On' : active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Webhook Reference */}
          <div className="card">
            <div className="card-title"><AlertCircle size={13} /> Webhook Endpoints Reference</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Point your integration webhooks to these endpoints (base URL: <code style={{ fontFamily: 'JetBrains Mono', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem' }}>http://your-domain:3001</code>).
              Add <code style={{ fontFamily: 'JetBrains Mono', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem' }}>X-Client-ID</code> header to route to correct client.
            </p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Integration</th>
                    <th>Endpoint</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {WEBHOOK_ENDPOINTS.map(ep => (
                    <tr key={ep.path}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{ep.label}</td>
                      <td><code style={{ fontFamily: 'JetBrains Mono', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{ep.path}</code></td>
                      <td><span className={`badge ${ep.badge}`}>{ep.method}</span></td>
                      <td><span className="badge badge-green">✓ Ready</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
