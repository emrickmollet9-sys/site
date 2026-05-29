import { useEffect, useState } from 'react';
import { fetchJson } from '../api.js';

export default function EconomyPanel() {
  const [economy, setEconomy] = useState(null);
  const [itemForm, setItemForm] = useState({ id: '', name: '', price: 0, description: '' });
  const [questForm, setQuestForm] = useState({ id: '', name: '', description: '', reward: 0, condition: 'firstCommand' });
  const [transactionForm, setTransactionForm] = useState({ userId: '', amount: 0, reason: '' });
  const [status, setStatus] = useState('');

  const loadEconomy = async () => {
    const data = await fetchJson('/api/economy');
    setEconomy(data);
  };

  useEffect(() => {
    loadEconomy();
  }, []);

  const saveItem = async () => {
    await fetchJson('/api/economy/item', {
      method: 'POST',
      body: JSON.stringify(itemForm),
    });
    setStatus('Article sauvegardé');
    setItemForm({ id: '', name: '', price: 0, description: '' });
    loadEconomy();
  };

  const saveQuest = async () => {
    await fetchJson('/api/economy/quest', {
      method: 'POST',
      body: JSON.stringify(questForm),
    });
    setStatus('Quête sauvegardée');
    setQuestForm({ id: '', name: '', description: '', reward: 0, condition: 'firstCommand' });
    loadEconomy();
  };

  const sendTransaction = async () => {
    await fetchJson('/api/economy/transaction', {
      method: 'POST',
      body: JSON.stringify(transactionForm),
    });
    setStatus('Transaction appliquée');
    setTransactionForm({ userId: '', amount: 0, reason: '' });
    loadEconomy();
  };

  if (!economy) {
    return <div className="panel-card">Chargement du système économique...</div>;
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Gestion de l’économie</h2>
          <p>Items, quêtes, transactions et paramètres globaux.</p>
        </div>
      </div>
      <div className="grid-3 gap-lg">
        <div className="panel-card panel-card--padded">
          <h3>Paramètres globaux</h3>
          <div className="stats-card">Daily : {economy.economy.dailyAmount} coins</div>
          <div className="stats-card">Weekly : {economy.economy.weeklyAmount} coins</div>
          <div className="stats-card">Cooldown daily : {economy.economy.cooldowns.daily}s</div>
        </div>
        <div className="panel-card panel-card--padded">
          <h3>Créer un item</h3>
          <label>Identifiant</label>
          <input value={itemForm.id} onChange={(e) => setItemForm({ ...itemForm, id: e.target.value })} />
          <label>Nom</label>
          <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          <label>Prix</label>
          <input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })} />
          <label>Description</label>
          <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
          <button className="button mt-small" onClick={saveItem}>Ajouter l’item</button>
        </div>
        <div className="panel-card panel-card--padded">
          <h3>Créer une quête</h3>
          <label>Identifiant</label>
          <input value={questForm.id} onChange={(e) => setQuestForm({ ...questForm, id: e.target.value })} />
          <label>Nom</label>
          <input value={questForm.name} onChange={(e) => setQuestForm({ ...questForm, name: e.target.value })} />
          <label>Description</label>
          <textarea value={questForm.description} onChange={(e) => setQuestForm({ ...questForm, description: e.target.value })} />
          <label>Récompense</label>
          <input type="number" value={questForm.reward} onChange={(e) => setQuestForm({ ...questForm, reward: Number(e.target.value) })} />
          <button className="button mt-small" onClick={saveQuest}>Ajouter la quête</button>
        </div>
      </div>

      <div className="panel-card panel-card--padded mt-lg">
        <h3>Items disponibles</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Prix</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {economy.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.price}</td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card panel-card--padded mt-lg">
        <h3>Quêtes</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Récompense</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              {economy.quests.map((quest) => (
                <tr key={quest.id}>
                  <td>{quest.id}</td>
                  <td>{quest.name}</td>
                  <td>{quest.reward}</td>
                  <td>{quest.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card panel-card--padded mt-lg">
        <h3>Gérer les coins</h3>
        <label>ID utilisateur</label>
        <input value={transactionForm.userId} onChange={(e) => setTransactionForm({ ...transactionForm, userId: e.target.value })} placeholder="123456789" />
        <label>Montant</label>
        <input type="number" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })} />
        <label>Raison</label>
        <input value={transactionForm.reason} onChange={(e) => setTransactionForm({ ...transactionForm, reason: e.target.value })} />
        <button className="button mt-small" onClick={sendTransaction}>Appliquer</button>
      </div>
      <p className="status-text">{status}</p>
    </div>
  );
}
