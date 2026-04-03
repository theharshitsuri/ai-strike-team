import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Users, Phone, FileText,
  AlertTriangle, DollarSign, Target, Activity, RefreshCw
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt$  (n) { return '$' + Number(n||0).toLocaleString(); }
function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

const ACTIVITY_ICONS = {
  parse_email:      '📧',
  call_completed:   '📞',
  deal_stage_change:'📊',
  meeting_booked:   '📅',
  payment_received: '💰',
  sms_received:     '💬',
  parse_document:   '📄',
};

// Fake sparkline data for stat cards
const sparkData = (n = 7, base = 50) =>
  Array.from({ length: n }, (_, i) => ({
    v: Math.max(0, base + Math.sin(i) * base * 0.4 + Math.random() * base * 0.3)
  }));

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, icon: Icon, color = 'blue', sparkline }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta != null && (
        <span className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
        </span>
      )}
      <div className="stat-icon">
        <Icon size={40} strokeWidth={1} />
      </div>
      {sparkline && (
        <div style={{ height: 40, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--accent-primary)" strokeWidth={1.5} fill={`url(#sg-${label})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Activity Feed ──────────────────────────────────────────────────────────────
function ActivityFeed({ activities = [] }) {
  if (!activities.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚡</div>
        <div className="empty-state-title">No activity yet</div>
        <div className="empty-state-desc">Parse an email or run a call campaign to see the feed</div>
      </div>
    );
  }
  return (
    <div className="activity-feed">
      {activities.map((a) => (
        <div key={a.id} className="activity-item">
          <div className={`activity-icon icon-${a.type || 'default'}`}>
            {ACTIVITY_ICONS[a.type] || '⚡'}
          </div>
          <div className="activity-content">
            <div className="activity-title">{a.title}</div>
            <div className="activity-desc">{a.description}</div>
          </div>
          <div className="activity-time">{timeAgo(a.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Stage Bar Chart ────────────────────────────────────────────────────────────
function StageChart({ stageData }) {
  const data = Object.entries(stageData || {}).map(([stage, val]) => ({
    name: stage.replace(/_/g, ' ').slice(0,12),
    deals: val.count,
    value: val.value
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--accent-primary)' }}
        />
        <Bar dataKey="deals" fill="var(--accent-primary)" radius={[4,4,0,0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Risk Items ─────────────────────────────────────────────────────────────────
function RiskPanel({ risks = [] }) {
  if (!risks.length) return (
    <div className="empty-state" style={{ padding: '24px' }}>
      <div style={{ fontSize: '1.4rem' }}>✅</div>
      <div className="empty-state-title" style={{ marginTop: 8 }}>All deals healthy</div>
    </div>
  );
  return (
    <div>
      {risks.slice(0, 5).map((r, i) => (
        <div key={i} className={`risk-item risk-${r.riskLevel}`}>
          <AlertTriangle size={14} color={r.riskLevel === 'high' ? 'var(--accent-danger)' : 'var(--accent-warning)'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.dealName}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.riskReason}</div>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-success)', flexShrink: 0 }}>{fmt$(r.amount)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { clientId } = useClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await api.getOverview(clientId);
      setData(overview);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="page">
      <div className="page-header">
        <div className="skeleton" style={{ width: 220, height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 160, height: 16 }} />
      </div>
      <div className="stat-grid">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Backend not connected</div>
        <div className="empty-state-desc">{error}</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={load}>Retry</button>
      </div>
    </div>
  );

  const { client, pipeline, forecast, risk, activity, calls } = data || {};
  const deals = pipeline?.recentDeals || [];
  const totalPipeline = forecast?.totalPipelineValue || 0;
  const weighted = forecast?.weightedForecast || 0;
  const stageDistribution = pipeline?.stageDistribution || {};

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">{client?.name} · {client?.industry}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="live-dot">Live</span>
          <button className="btn btn-secondary btn-sm" onClick={load} id="refresh-dashboard-btn">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="stat-grid">
        <StatCard label="Total Pipeline"   value={fmt$(totalPipeline)} delta={12}  icon={DollarSign} color="blue"   sparkline={sparkData(7, 60)} />
        <StatCard label="Weighted Forecast" value={fmt$(weighted)}     delta={8}   icon={TrendingUp}  color="green"  sparkline={sparkData(7, 50)} />
        <StatCard label="Deals in Pipeline" value={pipeline?.totalDeals || 0} delta={3} icon={Target} color="purple" sparkline={sparkData(7, 40)} />
        <StatCard label="Calls This Week"   value={calls?.stats?.total || 0} delta={15} icon={Phone}  color="orange" sparkline={sparkData(7, 20)} />
        <StatCard label="Deals at Risk"     value={risk?.atRisk || 0} delta={null} icon={AlertTriangle} color="red" />
      </div>

      {/* Main Grid */}
      <div className="grid-2 mb-8">
        {/* Pipeline by Stage */}
        <div className="card">
          <div className="card-title"><Activity size={13} /> Pipeline by Stage</div>
          <StageChart stageData={stageDistribution} />
        </div>

        {/* Deal Risk */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} /> Deals at Risk</span>
            <span className="badge badge-red">{risk?.atRisk || 0} deals</span>
          </div>
          <RiskPanel risks={risk?.risks || []} />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid-2">
        {/* Activity Feed */}
        <div className="card">
          <div className="card-title"><Activity size={13} /> Live Activity Feed</div>
          <ActivityFeed activities={activity || []} />
        </div>

        {/* Recent Deals */}
        <div className="card">
          <div className="card-title"><Target size={13} /> Recent Deals</div>
          {deals.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-title">No deals yet</div>
            </div>
          ) : (
            <div>
              {deals.slice(0, 8).map((deal) => (
                <div key={deal.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {deal.properties?.dealname}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {deal.properties?.dealstage?.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-success)', fontSize: '0.88rem', flexShrink: 0 }}>
                    {fmt$(deal.properties?.amount)}
                  </div>
                  <div style={{ width: 50, height: 4, background: 'var(--border-subtle)', borderRadius: 9999, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${deal.properties?.hs_deal_stage_probability || 30}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 9999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
