import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Contacts from './pages/Contacts.jsx';
import VoiceAgents from './pages/VoiceAgents.jsx';
import Parser from './pages/Parser.jsx';
import AIInsights from './pages/AIInsights.jsx';
import Integrations from './pages/Integrations.jsx';
import Settings from './pages/Settings.jsx';

export const ClientContext = createContext(null);
export function useClient() { return useContext(ClientContext); }

export default function App() {
  const [clientId, setClientId] = useState(
    localStorage.getItem('crm_client_id') || 'client_logistics'
  );

  const switchClient = (id) => {
    setClientId(id);
    localStorage.setItem('crm_client_id', id);
  };

  return (
    <ClientContext.Provider value={{ clientId, switchClient }}>
      <BrowserRouter>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/"            element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/pipeline"    element={<Pipeline />} />
              <Route path="/contacts"    element={<Contacts />} />
              <Route path="/voice"       element={<VoiceAgents />} />
              <Route path="/parser"      element={<Parser />} />
              <Route path="/insights"    element={<AIInsights />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/settings"    element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ClientContext.Provider>
  );
}
