import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { RefreshCw } from 'lucide-react';

const STAGE_COLORS = [
  '#4f8ef7','#7c5af7','#22d3a5','#f5a623','#f06078','#a78bfa','#34d399'
];

function fmt$(n) { return '$' + Number(n || 0).toLocaleString(); }

function DealCard({ deal }) {
  const p = deal.properties || {};
  const prob = p.hs_deal_stage_probability || 30;
  const closeDate = p.closedate ? new Date(p.closedate).toLocaleDateString() : 'TBD';

  return (
    <div className="deal-card" id={`deal-${deal.id}`}>
      <div className="deal-card-name" title={p.dealname}>{p.dealname}</div>
      <div className="deal-card-amount">{fmt$(p.amount)}</div>
      <div className="deal-card-meta">
        <div className="deal-card-prob">
          <div className="prob-bar">
            <div className="prob-fill" style={{ width: `${prob}%` }} />
          </div>
          <span>{prob}%</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          Close: {closeDate}
        </span>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { clientId } = useClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipelineData, forecast] = await Promise.all([
        api.getPipeline(clientId),
        api.getForecast(clientId)
      ]);
      setData({ pipeline: pipelineData, forecast });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="page">
      <div className="page-header">
        <div className="skeleton" style={{ width: 180, height: 32 }} />
      </div>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ flex: '0 0 280px', height: 500 }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">{error}</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={load}>Retry</button>
      </div>
    </div>
  );

  const { pipeline, forecast } = data || {};
  const columns = pipeline?.columns || {};
  const stages = pipeline?.stages || [];

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="page-subtitle">{pipeline?.totalDeals || 0} deals · Weighted forecast: {fmt$(forecast?.weightedForecast)}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Best Case</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-success)' }}>{fmt$(forecast?.bestCase)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Worst Case</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-danger)' }}>{fmt$(forecast?.worstCase)}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} id="refresh-pipeline-btn">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Forecast strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto' }}>
        {stages.map((stage, i) => {
          const col = columns[stage];
          const count = col?.deals?.length || 0;
          const value = col?.deals?.reduce((s, d) => s + (parseFloat(d.properties?.amount) || 0), 0) || 0;
          return (
            <div key={stage} style={{
              flex: '0 0 auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 16px',
              borderTop: `2px solid ${STAGE_COLORS[i % STAGE_COLORS.length]}`,
              minWidth: 120,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {stage.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt$(value)}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{count} deals</div>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {stages.map((stage, i) => {
          const col = columns[stage] || { name: stage, deals: [] };
          const deals = col.deals || [];
          const totalValue = deals.reduce((s, d) => s + (parseFloat(d.properties?.amount) || 0), 0);
          const dotColor = STAGE_COLORS[i % STAGE_COLORS.length];

          return (
            <div key={stage} className="kanban-column" id={`kanban-col-${stage}`}>
              <div className="kanban-col-header">
                <div className="kanban-col-name">
                  <div className="stage-dot" style={{ background: dotColor }} />
                  {col.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span className="kanban-col-count">{deals.length}</span>
                  <span className="kanban-col-value">{fmt$(totalValue)}</span>
                </div>
              </div>
              <div className="kanban-cards">
                {deals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No deals here
                  </div>
                ) : (
                  deals.map(deal => <DealCard key={deal.id} deal={deal} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
