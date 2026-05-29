import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, wsUrl } from '../api.js';

export default function LogsPanel() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef(null);

  const loadLogs = async () => {
    const data = await fetchJson('/api/logs');
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
    const socket = new WebSocket(wsUrl());
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log' && data.payload) {
          setLogs((prev) => [...prev.slice(-199), data.payload]);
        }
      } catch (error) {
        console.error(error);
      }
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (filter !== 'ALL' && !entry.message.includes(`[${filter}]`)) return false;
      if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filter, search]);

  const exportLogs = () => {
    const content = filteredLogs.map((entry) => entry.message).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'draftbot-logs.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Logs en direct</h2>
          <p>Suivi temps réel des événements, filtres et export.</p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={loadLogs}>Rafraîchir</button>
          <button className="button" onClick={exportLogs}>Exporter</button>
        </div>
      </div>
      <div className="panel-card panel-card--padded grid-4">
        {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map((level) => (
          <button
            key={level}
            className={filter === level ? 'chip chip--active' : 'chip'}
            onClick={() => setFilter(level)}
          >
            {level}
          </button>
        ))}
        <label className="search-label">
          Recherche
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer..." />
        </label>
        <label className="search-label">
          Auto-scroll
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
        </label>
      </div>
      <div className="logs-list" ref={listRef}>
        {filteredLogs.map((entry) => (
          <div key={entry.id} className={`log-item log-item--${entry.level.toLowerCase()}`}>
            <span>{entry.timestamp}</span>
            <strong>{entry.level}</strong>
            <p>{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
