import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import { FileText, Mail, FileSpreadsheet, Mic, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const TABS = [
  { id: 'email',      label: 'Email',      icon: Mail },
  { id: 'transcript', label: 'Transcript', icon: Mic },
  { id: 'csv',        label: 'CSV Import', icon: FileSpreadsheet },
  { id: 'document',   label: 'Document',   icon: FileText },
];

const STATUS_BADGE = {
  completed:  { cls: 'badge-green',  label: '✓ Completed', icon: CheckCircle },
  processing: { cls: 'badge-orange', label: '⏳ Processing', icon: Clock },
  pending:    { cls: 'badge-muted',  label: '⏳ Pending',   icon: Clock },
  failed:     { cls: 'badge-red',    label: '✗ Failed',    icon: AlertCircle },
};

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  return `${Math.floor(secs/3600)}h ago`;
}

const SAMPLE_EMAIL = `From: john.smith@acmecorp.com
Subject: Request for freight quote — Chicago to Atlanta

Hi,

My name is John Smith, VP of Operations at Acme Corp. We're looking for a reliable freight partner for our monthly LTL shipments from our Chicago facility to Atlanta.

We typically move around 20,000 lbs of packaged goods per month. This is time-sensitive as our current carrier gave us 30 days notice. Budget is around $8,000/month.

Can you provide a quote? We need to make a decision within the next two weeks.

Best,
John Smith
VP Operations, Acme Corp
(312) 555-0192`;

const SAMPLE_TRANSCRIPT = `Agent: Hi, this is Sarah from Apex Consulting. Am I speaking with Michael Chen?
Contact: Yes, this is Michael.
Agent: Great! I'm following up on your inquiry about our process optimization services. Do you have a few minutes?
Contact: Sure, go ahead.
Agent: Wonderful. Can you tell me a bit about the challenges you're facing with your current operations?
Contact: We're losing about 20% efficiency in our production line. It's costing us around $50,000 a month. We need to fix this by end of Q2.
Agent: That sounds significant. Do you have a budget in mind for a consulting engagement?
Contact: We've set aside about $80,000 for the right solution.
Agent: Excellent. I'd love to schedule a discovery call with our lead consultant. Are you available Thursday at 2pm?
Contact: Thursday at 2pm works perfectly.
Agent: Perfect. I'll send over a calendar invite. Is there anything else you'd like to know?
Contact: No, that covers it. Looking forward to Thursday.`;

export default function Parser() {
  const { clientId } = useClient();
  const [activeTab, setActiveTab] = useState('email');
  const [input, setInput] = useState('');
  const [docType, setDocType] = useState('invoice');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await api.getParseJobs(clientId);
      setJobs(res.jobs || []);
    } catch (e) { console.error(e); }
    finally { setJobsLoading(false); }
  }, [clientId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let res;
      if (activeTab === 'email')      res = await api.parseEmail({ emailText: input }, clientId);
      else if (activeTab === 'transcript') res = await api.parseTranscript({ transcriptText: input }, clientId);
      else if (activeTab === 'csv')   res = await api.parseCsv({ csvText: input }, clientId);
      else if (activeTab === 'document') res = await api.parseDocument({ docText: input, docType }, clientId);
      setResult(res);
      setTimeout(loadJobs, 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fillSample = () => {
    if (activeTab === 'email') setInput(SAMPLE_EMAIL);
    else if (activeTab === 'transcript') setInput(SAMPLE_TRANSCRIPT);
    else setInput('Name,Email,Company,Phone,Title\nJohn Smith,john@acme.com,Acme Corp,+13125550192,VP Operations\nSara Lee,sara@apex.com,Apex LLC,+13125550199,CEO');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">AI Parser</h1>
        <p className="page-subtitle">Automatically extract CRM data from emails, transcripts, documents, and spreadsheets</p>
      </div>

      <div className="grid-2">
        {/* Input Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`parser-tab-${id}`}
                onClick={() => { setActiveTab(id); setResult(null); setInput(''); setError(null); }}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 6px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 150ms',
                  background: activeTab === id ? 'var(--bg-active)' : 'transparent',
                  color: activeTab === id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'document' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Document Type</label>
              <select id="doc-type-select" className="form-select" value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="invoice">Invoice</option>
                <option value="rfq">RFQ</option>
                <option value="bill_of_lading">Bill of Lading</option>
                <option value="contract">Contract</option>
                <option value="purchase_order">Purchase Order</option>
              </select>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Input
              </span>
              <button className="btn btn-ghost btn-sm" onClick={fillSample} id="fill-sample-btn">
                Load sample
              </button>
            </div>
            <textarea
              id="parser-input"
              className="form-textarea"
              style={{ border: 'none', borderRadius: 0, minHeight: 280, resize: 'vertical', background: 'transparent' }}
              placeholder={`Paste your ${activeTab} content here...`}
              value={input}
              onChange={e => setInput(e.target.value)}
            />
          </div>

          <button
            id="parse-btn"
            className="btn btn-primary btn-lg w-full"
            onClick={handleParse}
            disabled={loading || !input.trim()}
          >
            {loading ? <><div className="spinner" />&nbsp;Extracting with AI...</> : <>✨ Extract &amp; Push to CRM</>}
          </button>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(240,96,120,0.08)', border: '1px solid rgba(240,96,120,0.25)', color: 'var(--accent-danger)', fontSize: '0.82rem' }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result && (
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34,211,165,0.05), rgba(79,142,247,0.05))', border: '1px solid rgba(34,211,165,0.2)' }}>
              <div className="card-title" style={{ color: 'var(--accent-success)' }}>
                ✅ Extracted Successfully
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {result.contactId && (
                  <span className="badge badge-green">Contact Created</span>
                )}
                <span className="badge badge-blue">
                  {Math.round((result.extracted?.confidence || 0.8) * 100)}% Confidence
                </span>
              </div>
              <pre style={{
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: '0.72rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-secondary)',
                overflow: 'auto',
                maxHeight: 360,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid var(--border-subtle)'
              }}>
                {JSON.stringify(result.extracted, null, 2)}
              </pre>
            </div>
          )}

          {/* Parse History */}
          <div className="card">
            <div className="card-title"><FileText size={13} /> Parse History</div>
            {jobsLoading ? (
              [...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)
            ) : jobs.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-title">No parse jobs yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jobs.slice(0, 10).map(job => {
                  const s = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
                  return (
                    <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      <span className={`badge ${s.cls}`} style={{ flexShrink: 0 }}>{s.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                          {job.type} · {job.source || 'manual'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }} className="truncate">
                          {job.input_preview}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(job.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
