import { useEffect, useState } from 'react';
import { fetchJson } from '../api.js';

const defaultCommand = {
  name: '',
  description: '',
  module: 'utility',
  enabled: true,
  cooldown: 10,
  options: [],
  actions: [{ type: 'sendMessage', text: 'Réponse automatique.' }],
};

export default function CommandsPanel() {
  const [commands, setCommands] = useState([]);
  const [selection, setSelection] = useState(null);
  const [form, setForm] = useState(defaultCommand);
  const [status, setStatus] = useState('Chargement...');

  const loadCommands = async () => {
    const data = await fetchJson('/api/commands');
    setCommands(data);
  };

  useEffect(() => {
    loadCommands();
  }, []);

  const selectCommand = (command) => {
    setSelection(command.name);
    setForm(JSON.parse(JSON.stringify(command)));
  };

  const updateForm = (path, value) => {
    setForm((prev) => ({ ...prev, [path]: value }));
  };

  const saveCommand = async () => {
    try {
      await fetchJson('/api/commands', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setStatus('Commande sauvegardée.');
      loadCommands();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const deleteCommand = async (name) => {
    await fetchJson(`/api/commands/${name}`, { method: 'DELETE' });
    setSelection(null);
    setForm(defaultCommand);
    loadCommands();
  };

  const addAction = () => {
    setForm((prev) => ({ ...prev, actions: [...(prev.actions || []), { type: 'sendMessage', text: 'Nouveau bloc' }] }));
  };

  const updateAction = (index, key, value) => {
    const updated = [...(form.actions || [])];
    updated[index] = { ...updated[index], [key]: value };
    setForm((prev) => ({ ...prev, actions: updated }));
  };

  const removeAction = (index) => {
    const updated = [...(form.actions || [])];
    updated.splice(index, 1);
    setForm((prev) => ({ ...prev, actions: updated }));
  };

  const moveCommand = async (fromIndex, toIndex) => {
    const updated = [...commands];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setCommands(updated);
    await fetchJson('/api/commands/reorder', {
      method: 'POST',
      body: JSON.stringify({ order: updated.map((cmd) => cmd.name) }),
    });
  };

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Éditeur de commandes</h2>
          <p>Créez et modifiez vos slash commandes visuellement.</p>
        </div>
        <div className="button-row">
          <button className="button" onClick={() => { setSelection(null); setForm(defaultCommand); }}>Nouvelle commande</button>
          <button className="button secondary" onClick={loadCommands}>Rafraîchir</button>
        </div>
      </div>
      <div className="panel-card grid-2 gap-lg">
        <div className="panel-card panel-card--padded">
          <h3>Commandes</h3>
          <div className="command-list">
            {commands.map((command, index) => (
              <div key={command.name} className={selection === command.name ? 'command-item active' : 'command-item'}>
                <div onClick={() => selectCommand(command)}>
                  <strong>/{command.name}</strong>
                  <p>{command.description}</p>
                </div>
                <div className="command-actions">
                  <button className="chip" onClick={() => moveCommand(index, Math.max(0, index - 1))}>↑</button>
                  <button className="chip" onClick={() => moveCommand(index, Math.min(commands.length - 1, index + 1))}>↓</button>
                  <button className="chip chip--danger" onClick={() => deleteCommand(command.name)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card panel-card--padded">
          <h3>{selection ? 'Modifier commande' : 'Nouvelle commande'}</h3>
          <div className="form-row">
            <label>Nom</label>
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value.toLowerCase())} placeholder="hello" />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Message de bienvenue" />
          </div>
          <div className="form-row split-2">
            <label>
              Module
              <select value={form.module} onChange={(e) => updateForm('module', e.target.value)}>
                <option value="moderation">Modération</option>
                <option value="fun">Fun</option>
                <option value="utility">Utilitaires</option>
                <option value="logs">Logs</option>
                <option value="economy">Économie</option>
              </select>
            </label>
            <label>
              Actif
              <select value={form.enabled ? 'true' : 'false'} onChange={(e) => updateForm('enabled', e.target.value === 'true')}>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Cooldown (secondes)</label>
            <input type="number" value={form.cooldown} onChange={(e) => updateForm('cooldown', Number(e.target.value))} />
          </div>
          <div className="form-row">
            <label>Options JSON</label>
            <textarea value={JSON.stringify(form.options || [], null, 2)} onChange={(e) => {
              try {
                updateForm('options', JSON.parse(e.target.value));
              } catch {
                // ignore JSON parse errors until valid
              }
            }} rows="6" />
          </div>
          <div className="panel-card panel-card--inner">
            <div className="panel-card-header">
              <h4>Blocs d'actions</h4>
              <button className="chip" onClick={addAction}>Ajouter un bloc</button>
            </div>
            {(form.actions || []).map((action, index) => (
              <div key={index} className="action-block">
                <div className="form-row split-2">
                  <label>
                    Type
                    <select value={action.type} onChange={(e) => updateAction(index, 'type', e.target.value)}>
                      <option value="sendMessage">sendMessage</option>
                      <option value="embed">embed</option>
                      <option value="ban">ban</option>
                      <option value="kick">kick</option>
                      <option value="timeout">timeout</option>
                      <option value="log">log</option>
                      <option value="coins">coins</option>
                      <option value="condition">condition</option>
                    </select>
                  </label>
                  <button className="chip chip--danger" onClick={() => removeAction(index)}>Supprimer</button>
                </div>
                <div className="form-row">
                  <label>Texte / message</label>
                  <textarea value={action.text || action.message || ''} onChange={(e) => updateAction(index, 'text', e.target.value)} rows="3" />
                </div>
                <div className="form-row split-3">
                  <label>Montant coins</label>
                  <input type="number" value={action.amount || ''} onChange={(e) => updateAction(index, 'amount', Number(e.target.value))} />
                  <label>Raison</label>
                  <input value={action.reason || ''} onChange={(e) => updateAction(index, 'reason', e.target.value)} />
                  <label>Durée ms</label>
                  <input type="number" value={action.durationMs || ''} onChange={(e) => updateAction(index, 'durationMs', Number(e.target.value))} />
                </div>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button className="button" onClick={saveCommand}>Enregistrer</button>
            {selection && <button className="button secondary" onClick={() => deleteCommand(selection)}>Supprimer</button>}
          </div>
          <p className="status-text">{status}</p>
        </div>
      </div>
    </div>
  );
}
