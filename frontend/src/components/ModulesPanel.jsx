import { useEffect, useState } from 'react';
import { fetchJson } from '../api.js';

export default function ModulesPanel() {
  const [config, setConfig] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState('');

  const loadConfig = async () => {
    const data = await fetchJson('/api/config');
    setConfig(data.config);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const updateModules = async (key, value) => {
    const next = { ...config.modules, [key]: value };
    await fetchJson('/api/config/modules', {
      method: 'POST',
      body: JSON.stringify({ modules: next }),
    });
    setConfig((prev) => ({ ...prev, modules: next }));
    setStatus('Modules mis à jour');
  };

  const saveToken = async () => {
    await fetchJson('/api/config/token', {
      method: 'POST',
      body: JSON.stringify({ token: tokenInput }),
    });
    setStatus('Token enregistré et bot démarré.');
    setTokenInput('');
    loadConfig();
  };

  if (!config) {
    return <div className="panel-card">Chargement de la configuration...</div>;
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Configuration du bot</h2>
          <p>Gérez le token, les modules et les paramètres généraux.</p>
        </div>
      </div>
      <div className="grid-2 gap-lg">
        <div className="panel-card panel-card--padded">
          <h3>Token Discord</h3>
          <p>Ajoutez votre token pour lancer le bot et déployer les slash commandes.</p>
          <input type="password" value={tokenInput} placeholder="Token Discord" onChange={(e) => setTokenInput(e.target.value)} />
          <button className="button mt-small" onClick={saveToken}>Sauvegarder le token</button>
          <p className="hint">Token actuel : {config.token ? '************' : 'Aucun token'}</p>
        </div>
        <div className="panel-card panel-card--padded">
          <h3>Modules</h3>
          {Object.entries(config.modules).map(([key, enabled]) => (
            <label key={key} className="toggle-row">
              <span>{key}</span>
              <input type="checkbox" checked={enabled} onChange={(e) => updateModules(key, e.target.checked)} />
            </label>
          ))}
        </div>
      </div>
      <div className="panel-card panel-card--padded mt-lg">
        <h3>Infos</h3>
        <p>Module économie : gestion des coins, items, quests et transactions.</p>
        <p>Module modération : actions ban/kick/timeout pour vos commandes.</p>
      </div>
      <p className="status-text">{status}</p>
    </div>
  );
}
