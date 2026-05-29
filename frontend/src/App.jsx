import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import LogsPanel from './components/LogsPanel.jsx';
import CommandsPanel from './components/CommandsPanel.jsx';
import EconomyPanel from './components/EconomyPanel.jsx';
import ModulesPanel from './components/ModulesPanel.jsx';

const tabs = [
  { id: 'dashboard', title: 'Tableau de bord' },
  { id: 'commands', title: 'Commandes' },
  { id: 'economy', title: 'Économie' },
  { id: 'logs', title: 'Logs' },
  { id: 'modules', title: 'Modules' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DB</div>
          <div>
            <h1>DraftBot Panel</h1>
            <p>Gestionnaire de bot Discord</p>
          </div>
        </div>
        <nav className="nav-menu">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.title}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content-pane">
        <header className="topbar">
          <div>
            <span className="status-chip">Bot Discord.js v14</span>
            <span className="status-chip status-secondary">React + Vite</span>
          </div>
        </header>

        <section className="page-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'commands' && <CommandsPanel />}
          {activeTab === 'economy' && <EconomyPanel />}
          {activeTab === 'logs' && <LogsPanel />}
          {activeTab === 'modules' && <ModulesPanel />}
        </section>
      </main>
    </div>
  );
}

export default App;
