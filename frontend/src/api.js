const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || response.statusText || 'Erreur API');
  }
  return response.json();
};

export const wsUrl = () => {
  const origin = window.location.origin.replace(/^http/, 'ws');
  return `${origin.replace(':5173', ':3000')}/ws`;
};

export default API_BASE;
