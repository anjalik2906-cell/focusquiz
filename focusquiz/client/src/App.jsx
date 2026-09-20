import { useCallback, useEffect, useState } from 'react';
import Setup from './components/Setup.jsx';
import Session from './components/Session.jsx';
import Dashboard from './components/Dashboard.jsx';
import { SessionEngine } from './lib/engine.js';
import { chunkText } from './lib/chunker.js';
import { makeConfig } from './lib/config.js';
import { fetchHealth, listSessions } from './lib/api.js';

export default function App() {
  const [phase, setPhase] = useState('setup'); // setup | session | dashboard
  const [engine, setEngine] = useState(null);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState({ status: 'loading', items: [] });

  const refreshHistory = useCallback(() => {
    listSessions()
      .then((items) => setHistory({ status: 'ready', items }))
      .catch(() => setHistory({ status: 'offline', items: [] }));
  }, []);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false, ai: false, storage: 'none' }));
    refreshHistory();
  }, [refreshHistory]);

  const start = (text, { goalMin, demo }) => {
    const eng = new SessionEngine({ chunks: chunkText(text), cfg: makeConfig(demo), goalMs: goalMin * 60000 });
    eng.aiAvailable = Boolean(health && health.ai);
    setEngine(eng);
    setPhase('session');
    window.scrollTo(0, 0);
  };

  const end = () => {
    setSummary(engine.end());
    setPhase('dashboard');
    window.scrollTo(0, 0);
  };

  const again = () => {
    setEngine(null);
    setSummary(null);
    setPhase('setup');
    refreshHistory();
  };

  if (phase === 'session') return <Session engine={engine} onEnd={end} />;
  if (phase === 'dashboard') return <Dashboard summary={summary} onNew={again} />;
  return <Setup health={health} history={history} onStart={start} />;
}
