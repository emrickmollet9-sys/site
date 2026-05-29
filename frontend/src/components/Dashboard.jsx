import { useEffect, useState } from 'react';
import { fetchJson } from '../api.js';

function statCard(label, value) {
  return (
    <div className="stats-card" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Dashboard() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetchJson('/api/config');
      setConfig(response.config);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    const interval = setInterval(loadConfig, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !config) {
    return <div className="panel-card">Chargement du tableau de bord...</div>;
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Tableau de bord</h2>
          <p>Statistiques du bot en temps réel et configuration principale.</p>
        </div>
      </div>
      <div className="grid-4">
        {statCard('Serveurs', config.stats.servers)}
        {statCard('Utilisateurs', config.stats.users)}
        {statCard('Uptime', `${Math.floor(config.stats.uptime || 0)}s`)}
        {statCard('Commandes', config.stats.commands)}
      </div>
      <div className="panel-card panel-card--padded">
        <h3>Modules actifs</h3>
        <div className="module-list">
          {Object.entries(config.modules).map(([moduleName, enabled]) => (
            <div key={moduleName} className="module-badge">
              <strong>{moduleName}</strong>
              <span>{enabled ? 'Activé' : 'Désactivé'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel-card panel-card--padded">
        <h3>Conseils</h3>
        <ul>
          <li>Utilisez l’onglet Commandes pour créer des slash commandes visuelles.</li>
          <li>Les logs sont envoyés en direct via WebSocket.</li>
          <li>Le bot recharge automatiquement les commandes modifiées.</li>
        </ul>
      </div>
    </div>
  );
}
