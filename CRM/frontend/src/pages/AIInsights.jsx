import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { Sparkles, TrendingUp, AlertTriangle, Mail, Target, RefreshCw, Zap } from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

function fmt$(n) { return '$' + Number(n||0).toLocaleString(); }

function ScoreRing({ score }) {
  const tier = score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'cool' : 'cold';
  const colors = { hot: '#ff6b6b', warm: '#f5a623', cool: '#4f8ef7', cold: '#94a3b8' };
  const color = colors[tier];
  const pct = `${score}%`;

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius={30} outerRadius={48} data={[{ value: score }]} startAngle={90} endAngle={90 - (score / 100) * 360}>
          <RadialBar dataKey="value" cornerRadius={10} fill={color} background={{ fill: 'var(--bg-elevated)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{score}</span>
        <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{tier}</span>
      </div>
    </div>
  );
}

const MOCK_CONTACT_IDS = ['ct_001', 'ct_002', 'ct_003', 'ct_004', 'ct_005'];
const MOCK_CONTACT_NAMES = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Davis', 'Robert Wilson'];
const MOCK_COMPANIES = ['Acme Corp', 'Pinnacle Industries', 'Summit Logistics', 'BlueSky Mfg', 'Vertex Services'];

// Forecast stages area chart
const forecastSparkline = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  forecast: Math.floor(Math.random() * 80000 + 50000),
  actual: i < 4 ? Math.floor(Math.random() * 70000 + 40000) : undefined
}));

export default function AIInsights() {
  const { clientId } = useClient();
  const [forecast, setForecast] = useState(null);
  const [risk, setRisk] = useState(null);
  const [insights, setInsights] = useState([]);
  const [scores, setScores] = useState([]);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fc, rk, ins] = await Promise.all([
        api.getForecast(clientId),
        api.getRisk(clientId),
        api.getInsights(clientId)
      ]);
      setForecast(fc);
      setRisk(rk);
      setInsights(ins.insights || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const runScoring = async () => {
    setScoringLoading(true);
    try {
      const results = await Promise.all(
        MOCK_CONTACT_IDS.map(id => api.getScore(id, clientId))
      );
      setScores(results.map((r, i) => ({
        ...r,
        name: MOCK_CONTACT_NAMES[i],
        company: MOCK_COMPANIES[i]
      })));
    } catch (e) { console.error(e); }
    finally { setScoringLoading(false); }
  };

  const draftEmail = async () => {
    setDraftLoading(true);
    try {
      const res = await api.draftEmail({
        contactData: { name: 'John Smith', company: 'Acme Corp' },
        dealContext: { stage: 'qualified', lastNote: 'Discussed freight needs', keyPoints: 'LTL lanes, monthly cadence, urgency' }
      }, clientId);
      setDraft(res.draft);
    } catch (e) { console.error(e); }
    finally { setDraftLoading(false); }
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
      <div className="grid-2"><div className="skeleton" style={{ height: 200 }} /><div className="skeleton" style={{ height: 200 }} /></div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">AI Insights</h1>
          <p className="page-subtitle">Lead scoring · Next best actions · Deal risk · Forecasting · Email drafting</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Forecast + Risk Row */}
      <div className="grid-2 mb-6">
        {/* Forecast */}
        <div className="card">
          <div className="card-title"><TrendingUp size={13} /> Revenue Forecast</div>
          <div className="forecast-numbers">
            <div className="forecast-item">
              <div className="forecast-label">Pipeline</div>
              <div className="forecast-value" style={{ color: 'var(--text-primary)' }}>{fmt$(forecast?.totalPipelineValue)}</div>
            </div>
            <div className="forecast-item">
              <div className="forecast-label">Weighted</div>
              <div className="forecast-value" style={{ color: 'var(--accent-primary)' }}>{fmt$(forecast?.weightedForecast)}</div>
            </div>
            <div className="forecast-item">
              <div className="forecast-label">Closed Won</div>
              <div className="forecast-value" style={{ color: 'var(--accent-success)' }}>{fmt$(forecast?.closedWonThisMonth)}</div>
            </div>
          </div>
          <div style={{ marginTop: 20, height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastSparkline}>
                <defs>
                  <linearGradient id="fc-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }} formatter={(v) => [fmt$(v), '']} />
                <Area type="monotone" dataKey="forecast" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#fc-grad)" dot={false} name="Forecast" />
                <Area type="monotone" dataKey="actual" stroke="var(--accent-success)" strokeWidth={2} fill="none" dot={false} name="Actual" strokeDasharray="0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Deal Risk */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} /> Deal Risk Analysis</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-red">{risk?.risks?.filter(r => r.riskLevel==='high').length || 0} High</span>
              <span className="badge badge-orange">{risk?.risks?.filter(r => r.riskLevel==='medium').length || 0} Medium</span>
            </div>
          </div>
          {(risk?.risks || []).length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div style={{ fontSize: '1.5rem' }}>✅</div>
              <div className="empty-state-title" style={{ marginTop: 8 }}>All deals on track</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {(risk?.risks || []).map((r, i) => (
                <div key={i} className={`risk-item risk-${r.riskLevel}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.dealName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.riskReason}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-success)' }}>{fmt$(r.amount)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{r.probability}% win prob</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lead Scoring */}
      <div className="card mb-6">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> Lead Scoring</span>
          <button id="run-scoring-btn" className="btn btn-primary btn-sm" onClick={runScoring} disabled={scoringLoading}>
            {scoringLoading ? <><div className="spinner" />&nbsp;Scoring...</> : <><Zap size={12} /> Run Scoring</>}
          </button>
        </div>
        {scores.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-icon"><Target size={36} strokeWidth={1.5} /></div>
            <div className="empty-state-title">No scores computed yet</div>
            <div className="empty-state-desc">Click "Run Scoring" to score your leads</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {scores.map((s, i) => (
              <div key={i} className="insight-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ScoreRing score={s.score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>{s.company}</div>
                    <span className={`badge tier-${s.tier}`}>{s.tier?.toUpperCase()} LEAD</span>
                  </div>
                </div>
                {s.breakdown && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(s.breakdown).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 100, textTransform: 'capitalize', flexShrink: 0 }}>{key.replace(/_/g, ' ')}</span>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, val * 4)}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', width: 24, textAlign: 'right' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Drafter */}
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> AI Email Drafter</span>
          <button id="draft-email-btn" className="btn btn-primary btn-sm" onClick={draftEmail} disabled={draftLoading}>
            {draftLoading ? <><div className="spinner" />&nbsp;Drafting...</> : <><Sparkles size={12} /> Draft Follow-Up</>}
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          One-click AI drafting based on deal history and contact profile. Review, edit, and send — zero typing required.
        </p>
        {draft ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Generated Draft — John Smith @ Acme Corp
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>{draft}</pre>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" id="use-draft-btn">Use Draft</button>
              <button className="btn btn-secondary btn-sm" id="regenerate-draft-btn" onClick={draftEmail}>Regenerate</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 10, color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-default)' }}>
            Click "Draft Follow-Up" to generate an AI email for your top lead
          </div>
        )}
      </div>
    </div>
  );
}
