import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, RefreshCw, Zap } from 'lucide-react';

function fmtDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

const OUTCOME_BADGE = {
  qualified:          { cls: 'badge-green',  label: 'Qualified' },
  meeting_booked:     { cls: 'badge-green',  label: 'Meeting Booked' },
  voicemail:          { cls: 'badge-muted',  label: 'Voicemail' },
  not_interested:     { cls: 'badge-red',    label: 'Not Interested' },
  callback_requested: { cls: 'badge-orange', label: 'Callback Requested' },
  completed:          { cls: 'badge-blue',   label: 'Completed' },
};

function CallLogItem({ call }) {
  const [expanded, setExpanded] = useState(false);
  const badge = OUTCOME_BADGE[call.outcome] || { cls: 'badge-muted', label: call.outcome || '—' };

  return (
    <div>
      <div className="call-log-item" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <div className={`call-direction-badge ${call.direction === 'inbound' ? 'dir-inbound' : 'dir-outbound'}`}>
          {call.direction === 'inbound' ? <PhoneIncoming size={15} /> : <PhoneOutgoing size={15} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {call.contact_name || call.contact_phone || 'Unknown'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {call.contact_phone} · {fmtDuration(call.duration_seconds)}
          </div>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>
          {timeAgo(call.created_at)}
        </div>
      </div>
      {expanded && call.summary && (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '0 0 10px 10px',
          padding: '12px 16px',
          marginTop: -4,
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6
        }}>
          <strong style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Summary</strong>
          <p style={{ marginTop: 6 }}>{call.summary}</p>
        </div>
      )}
    </div>
  );
}

export default function VoiceAgents() {
  const { clientId } = useClient();
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [campaignResult, setCampaignResult] = useState(null);
  const [callForm, setCallForm] = useState({ phoneNumber: '', contactName: '' });
  const [activeTab, setActiveTab] = useState('logs');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [callRes, statsRes] = await Promise.all([
        api.getCalls(clientId),
        api.getCallStats(clientId)
      ]);
      setCalls(callRes.calls || []);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSingleCall = async (e) => {
    e.preventDefault();
    if (!callForm.phoneNumber) return;
    setLaunching(true);
    try {
      const res = await api.triggerCall({ phoneNumber: callForm.phoneNumber, contactName: callForm.contactName }, clientId);
      setCampaignResult({ type: 'single', ...res });
      setCallForm({ phoneNumber: '', contactName: '' });
      setTimeout(load, 1000);
    } catch(err) {
      setCampaignResult({ type: 'error', message: err.message });
    } finally {
      setLaunching(false);
    }
  };

  const handleCampaign = async () => {
    setLaunching(true);
    try {
      const res = await api.runCampaign({ daysInactive: 5, limit: 5 }, clientId);
      setCampaignResult({ type: 'campaign', ...res });
      setTimeout(load, 1500);
    } catch(err) {
      setCampaignResult({ type: 'error', message: err.message });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Voice Agents</h1>
          <p className="page-subtitle">AI-powered inbound qualification & outbound follow-up</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} id="refresh-calls-btn">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: 'Total Calls',    value: stats?.total_calls || 0,    color: 'blue' },
          { label: 'Inbound',        value: stats?.inbound || 0,        color: 'green' },
          { label: 'Outbound',       value: stats?.outbound || 0,       color: 'purple' },
          { label: 'Qualified',      value: stats?.qualified || 0,      color: 'orange' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.color}`} style={{ paddingBottom: 16 }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trigger single call */}
          <div className="card">
            <div className="card-title"><Phone size={13} /> Trigger Single Call</div>
            <form onSubmit={handleSingleCall}>
              <div className="form-group">
                <label className="form-label" htmlFor="call-phone">Phone Number</label>
                <input
                  id="call-phone"
                  className="form-input"
                  placeholder="+1 (555) 000-0000"
                  value={callForm.phoneNumber}
                  onChange={e => setCallForm(f => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="call-name">Contact Name</label>
                <input
                  id="call-name"
                  className="form-input"
                  placeholder="John Smith"
                  value={callForm.contactName}
                  onChange={e => setCallForm(f => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <button
                id="trigger-call-btn"
                type="submit"
                className="btn btn-primary w-full"
                disabled={launching || !callForm.phoneNumber}
              >
                {launching ? <><div className="spinner" />&nbsp;Launching...</> : <><Phone size={14} /> Trigger Outbound Call</>}
              </button>
            </form>
          </div>

          {/* Campaign */}
          <div className="card">
            <div className="card-title"><Zap size={13} /> Auto Follow-Up Campaign</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              Automatically call all leads in your pipeline that haven't had activity in 5+ days.
            </p>
            <button
              id="run-campaign-btn"
              className="btn btn-primary w-full"
              onClick={handleCampaign}
              disabled={launching}
            >
              {launching ? <><div className="spinner" />&nbsp;Running...</> : <><Zap size={14} /> Run Campaign (up to 5 calls)</>}
            </button>
          </div>

          {/* Result Notification */}
          {campaignResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: `1px solid ${campaignResult.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'}`,
              background: campaignResult.type === 'error' ? 'rgba(240,96,120,0.06)' : 'rgba(34,211,165,0.06)',
              fontSize: '0.82rem',
              color: campaignResult.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'
            }}>
              {campaignResult.type === 'error'
                ? `❌ ${campaignResult.message}`
                : campaignResult.type === 'campaign'
                ? `✅ Campaign launched — ${campaignResult.totalCalled} calls initiated`
                : `✅ Call queued (ID: ${campaignResult.callId})`
              }
            </div>
          )}
        </div>

        {/* Right: Call Logs */}
        <div className="card" style={{ maxHeight: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title"><Phone size={13} /> Call Logs</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12 }} />)
            ) : calls.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📞</div>
                <div className="empty-state-title">No calls yet</div>
                <div className="empty-state-desc">Trigger a call or run a campaign to get started</div>
              </div>
            ) : (
              calls.map(call => <CallLogItem key={call.id} call={call} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
