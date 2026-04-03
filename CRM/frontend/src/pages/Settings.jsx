import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { Settings as SettingsIcon, RefreshCw, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { clientId, switchClient } = useClient();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.getConfig(clientId);
      setConfig(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ width: 160, height: 32, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 300 }} />
    </div>
  );

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Client configuration · {config?.name}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} id="refresh-settings-btn">
          <RefreshCw size={13} /> Reload
        </button>
      </div>

      <div className="grid-2">
        {/* Client Info */}
        <div className="card">
          <div className="card-title"><SettingsIcon size={13} /> Client Profile</div>
          <div className="form-group">
            <label className="form-label">Client ID</label>
            <input id="setting-client-id" className="form-input" value={config?.clientId || ''} readOnly style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input id="setting-company-name" className="form-input" defaultValue={config?.name || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Industry Vertical</label>
            <select id="setting-industry" className="form-select" defaultValue={config?.industry || 'logistics'}>
              <option value="logistics">Logistics / Freight</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Professional Services</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Parser Vertical</label>
            <select id="setting-parser-vertical" className="form-select" defaultValue={config?.parser?.vertical || 'logistics'}>
              <option value="logistics">Logistics</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Services</option>
            </select>
          </div>
          <button id="save-settings-btn" className="btn btn-primary w-full" onClick={handleSave}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Changes'}
          </button>
        </div>

        {/* Pipeline Stages */}
        <div className="card">
          <div className="card-title">Pipeline Stages</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(config?.hubspot?.stages || {}).map(([name, id], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `hsl(${i * 50 + 200}, 70%, 60%)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                  {name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <code style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{id}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Voice Config */}
        <div className="card">
          <div className="card-title">Voice Agent Config</div>
          <div className="form-group">
            <label className="form-label">Agent Voice</label>
            <select id="setting-voice" className="form-select" defaultValue={config?.voice?.voiceId || 'jennifer'}>
              <option value="jennifer">Jennifer (Female, Professional)</option>
              <option value="michael">Michael (Male, Warm)</option>
              <option value="sarah">Sarah (Female, Friendly)</option>
              <option value="david">David (Male, Authoritative)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Call Hours (Timezone: {config?.voice?.callHours?.timezone || 'America/Chicago'})</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input className="form-input" defaultValue={config?.voice?.callHours?.start || '08:00'} id="call-hours-start" style={{ flex: 1 }} />
              <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>to</span>
              <input className="form-input" defaultValue={config?.voice?.callHours?.end || '17:00'} id="call-hours-end" style={{ flex: 1 }} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Qualification Questions</label>
            {(config?.voice?.qualificationQuestions || []).map((q, i) => (
              <input key={i} className="form-input" defaultValue={q} id={`qual-question-${i}`} style={{ marginBottom: 8 }} />
            ))}
          </div>
        </div>

        {/* Reporting */}
        <div className="card">
          <div className="card-title">Reporting</div>
          <div className="form-group">
            <label className="form-label">Weekly Report Recipients</label>
            <textarea
              id="setting-report-recipients"
              className="form-textarea"
              defaultValue={(config?.reporting?.weeklyRecipients || []).join('\n')}
              style={{ minHeight: 80 }}
              placeholder="one@email.com&#10;two@email.com"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Report Metrics</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {(config?.reporting?.metrics || []).map(m => (
                <span key={m} className="badge badge-blue">{m.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent-primary)' }}>📋 Config file path:</strong><br />
            <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>CRM/config/{clientId}.json</code><br />
            Edit this file to permanently update settings.
          </div>
        </div>
      </div>
    </div>
  );
}
