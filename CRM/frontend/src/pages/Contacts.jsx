import { useState, useEffect, useCallback, useRef } from 'react';
import { useClient } from '../App.jsx';
import { api } from '../api.js';
import {
  Users, Search, Plus, RefreshCw, User, Building,
  Phone, Mail, Star, Zap, FileText, ChevronRight,
  X, Check, AlertCircle
} from 'lucide-react';

function fmt$(n) { return '$' + Number(n || 0).toLocaleString(); }
function timeAgo(iso) {
  if (!iso) return 'Never';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const STATUS_COLORS = {
  HOT: '#ff6b6b', WARM: '#f5a623', NEW: '#6366f1',
  IN_PROGRESS: '#22c55e', QUALIFIED: '#0ea5e9',
  CUSTOMER: '#10b981', COLD: '#94a3b8'
};
const TIER_COLORS = { hot: '#ff6b6b', warm: '#f5a623', cool: '#4f8ef7', cold: '#94a3b8' };

function ScoreBadge({ score }) {
  const tier = score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'cool' : 'cold';
  const color = TIER_COLORS[tier];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color }}>{score || '—'}</span>
      </div>
      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color, letterSpacing: '0.08em' }}>{tier}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function ContactRow({ contact, onSelect, onScore }) {
  const name = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || 'Unknown';
  return (
    <div className="contact-row" onClick={() => onSelect(contact)} style={{
      display: 'grid', gridTemplateColumns: '1fr 160px 120px 90px 80px 36px',
      alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
      cursor: 'pointer', transition: 'background 0.1s', gap: 12
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
            {(contact.firstname?.[0] || '?').toUpperCase()}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{name}</div>
          <div className="truncate" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{contact.email || '—'}</div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Building size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
          {contact.company || '—'}
        </div>
      </div>
      <div><StatusPill status={contact.lead_status || 'NEW'} /></div>
      <div><ScoreBadge score={contact.lead_score || 0} /></div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(contact.last_activity_at || contact.updated_at)}</div>
      <button
        className="btn btn-secondary btn-sm"
        style={{ padding: '4px 6px', minWidth: 0 }}
        onClick={e => { e.stopPropagation(); onScore(contact.id); }}
        title="Re-score this contact"
      >
        <Zap size={11} />
      </button>
    </div>
  );
}

function ContactDrawer({ contact, onClose, clientId }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [coaching, setCoaching] = useState(null);
  const name = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || 'Unknown';

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.addContactNote(contact.id, { note }, clientId);
      setNote('');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 100,
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{(contact.firstname?.[0] || '?').toUpperCase()}</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{contact.jobtitle || '—'} · {contact.company || '—'}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 6px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Score + Status */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <ScoreBadge score={contact.lead_score || 0} />
          <StatusPill status={contact.lead_status || 'NEW'} />
        </div>

        {/* Contact fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {contact.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
              <Mail size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <a href={`mailto:${contact.email}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{contact.email}</a>
            </div>
          )}
          {contact.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
              <Phone size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <a href={`tel:${contact.phone}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{contact.phone}</a>
            </div>
          )}
          {contact.company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
              <Building size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{contact.company}</span>
            </div>
          )}
          {contact.source && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Source: <span style={{ color: 'var(--text-secondary)' }}>{contact.source}</span>
              {' · '}Last activity: {timeAgo(contact.last_activity_at)}
            </div>
          )}
        </div>

        {/* AI Insight if available */}
        {contact.next_best_action && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 20 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)', marginBottom: 6 }}>
              Next Best Action
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{contact.next_best_action}</div>
          </div>
        )}

        {/* Add note */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Add Note</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note about this contact..."
            rows={3}
            style={{
              width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.82rem',
              resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8 }}
            onClick={addNote}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving...' : <><Check size={12} /> Save Note</>}
          </button>
        </div>

        {/* Recent Activity */}
        {contact.recentActivity?.length > 0 && (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Recent Activity</div>
            {contact.recentActivity.map((a, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{a.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateContactModal({ onClose, onCreated, clientId }) {
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', phone: '', company: '', jobtitle: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.firstname && !form.email) { setError('First name or email is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createContact(form, clientId);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 16, padding: '28px 32px', width: 440, maxWidth: '90vw', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>New Contact</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 6px' }}><X size={14} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {['firstname', 'lastname'].map(k => (
              <div key={k}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</label>
                <input value={form[k]} onChange={set(k)} placeholder={k === 'firstname' ? 'John' : 'Smith'}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {[
            { key: 'email', placeholder: 'john@company.com', label: 'Email' },
            { key: 'phone', placeholder: '+1 555 000 0000', label: 'Phone' },
            { key: 'company', placeholder: 'Acme Corp', label: 'Company' },
            { key: 'jobtitle', placeholder: 'VP of Operations', label: 'Job Title' },
          ].map(({ key, placeholder, label }) => (
            <div key={key}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
              <input value={form[key]} onChange={set(key)} placeholder={placeholder}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem' }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Contact'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Contacts() {
  const { clientId } = useClient();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated_at');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState(null);
  const searchTimeout = useRef(null);

  const load = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        api.getContacts({ q, sort, limit: 100 }, clientId),
        api.getContactStats(clientId)
      ]);
      setContacts(list.contacts || []);
      setTotal(list.total || 0);
      setStats(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, sort]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(q), 400);
  };

  const handleScore = async (contactId) => {
    try {
      const result = await api.scoreContact(contactId, clientId);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, lead_score: result.score } : c));
    } catch (e) { console.error(e); }
  };

  const openDetail = async (contact) => {
    try {
      const detail = await api.getContact(contact.id, clientId);
      setSelected(detail);
    } catch {
      setSelected(contact);
    }
  };

  return (
    <div className="page" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">
            {total.toLocaleString()} contacts ·{' '}
            {stats?.recentlyAdded || 0} added this week ·{' '}
            avg score {stats?.avgScore || 0}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => load()}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New Contact
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {(stats.byStatus || []).map(s => (
            <div key={s.lead_status} style={{ padding: '6px 14px', borderRadius: 999, background: `${STATUS_COLORS[s.lead_status] || '#6366f1'}18`, border: `1px solid ${STATUS_COLORS[s.lead_status] || '#6366f1'}33`, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: STATUS_COLORS[s.lead_status] || '#6366f1' }}>{s.lead_status}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + Sort Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, email, or company..."
            style={{
              width: '100%', padding: '9px 12px 9px 34px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)', borderRadius: 10, color: 'var(--text-primary)',
              fontSize: '0.85rem', boxSizing: 'border-box'
            }}
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.82rem' }}
        >
          <option value="updated_at">Recently Updated</option>
          <option value="created_at">Recently Added</option>
          <option value="lead_score">Lead Score</option>
          <option value="firstname">Name A-Z</option>
          <option value="company">Company</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 120px 90px 80px 36px',
          padding: '10px 16px', background: 'var(--bg-elevated)', gap: 12,
          borderBottom: '1px solid var(--border-default)'
        }}>
          {['Contact', 'Company', 'Status', 'Score', 'Activity', ''].map((h, i) => (
            <div key={i} style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon"><Users size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-title">{search ? 'No contacts found' : 'No contacts yet'}</div>
            <div className="empty-state-desc">
              {search ? 'Try a different search term' : 'Import a CSV, parse an email, or add a contact manually'}
            </div>
            {!search && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Add First Contact
              </button>
            )}
          </div>
        ) : (
          contacts.map(c => (
            <ContactRow key={c.id} contact={c} onSelect={openDetail} onScore={handleScore} />
          ))
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setSelected(null)} />
          <ContactDrawer contact={selected} onClose={() => setSelected(null)} clientId={clientId} />
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateContactModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setContacts(prev => [c, ...prev]); setTotal(t => t + 1); }}
          clientId={clientId}
        />
      )}
    </div>
  );
}
