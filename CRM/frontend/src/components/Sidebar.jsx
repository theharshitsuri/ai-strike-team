import { NavLink, useLocation } from 'react-router-dom';
import { useClient } from '../App.jsx';
import {
  LayoutDashboard, Kanban, Phone, FileSearch,
  Sparkles, Plug, Settings, Zap
} from 'lucide-react';

const NAV = [
  { label: 'Overview',     path: '/dashboard',    icon: LayoutDashboard },
  { label: 'Pipeline',     path: '/pipeline',     icon: Kanban },
  { label: 'Voice Agents', path: '/voice',        icon: Phone, badge: 'AI' },
  { label: 'Parser',       path: '/parser',       icon: FileSearch },
  { label: 'AI Insights',  path: '/insights',     icon: Sparkles, badge: 'NEW' },
  { label: 'Integrations', path: '/integrations', icon: Plug },
  { label: 'Settings',     path: '/settings',     icon: Settings },
];

const CLIENTS = [
  { id: 'client_logistics',     label: '🚛 Freight Masters LLC' },
  { id: 'client_manufacturing', label: '⚙️  Precision Parts Inc.' },
  { id: 'client_services',      label: '💼 Apex Consulting' },
];

export default function Sidebar() {
  const { clientId, switchClient } = useClient();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <Zap size={18} color="white" strokeWidth={2.5} />
          </div>
          <div className="logo-text">Neural<span>CRM</span></div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
        {NAV.map(({ label, path, icon: Icon, badge }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
            {badge && <span className="nav-badge">{badge}</span>}
          </NavLink>
        ))}
      </div>

      {/* Client Switcher */}
      <div className="client-switcher">
        <div className="client-switcher-label">Active Client</div>
        <select
          className="client-select"
          value={clientId}
          onChange={(e) => switchClient(e.target.value)}
          id="client-switcher-select"
        >
          {CLIENTS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
    </aside>
  );
}
