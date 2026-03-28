import { useState, useEffect, useCallback } from 'react';
import { auth, bot, dashboard, trades, scanner, knowledge, settings, team } from './api/client';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import BotControl from './pages/BotControl';
import Scanner from './pages/Scanner';
import History from './pages/History';
import Performance from './pages/Performance';
import Knowledge from './pages/Knowledge';
import Withdraw from './pages/Withdraw';
import Team from './pages/Team';
import ApiKeys from './pages/ApiKeys';

// Ladeindikator
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--muted)', fontSize: '13px', gap: '10px' }}>
      <div style={{ width: '16px', height: '16px', border: '2px solid var(--sub)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      Wird geladen...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Fehleranzeige
function ErrorMsg({ message, onRetry }) {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '10px' }}>{message}</div>
      {onRetry && <button onClick={onRetry} style={{ padding: '6px 14px', background: 'var(--blue)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Erneut versuchen</button>}
    </div>
  );
}

// Page-Wrapper mit echten API-Daten
function PageWithData({ page, lang, botOn, setBotOn }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let result = null;
      if (page === 'p1') result = await dashboard.getMetrics();
      else if (page === 'p3') result = await scanner.getResults();
      else if (page === 'p4') result = await trades.getAll({ limit: 50 });
      else if (page === 'p5') result = await dashboard.getMetrics();
      else if (page === 'p6') result = await knowledge.getAll();
      else if (page === 'p8') result = await team.getAll();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh alle 30 Sekunden fuer Live-Daten
  useEffect(() => {
    if (['p1','p3','p4'].includes(page)) {
      const id = setInterval(load, 30000);
      return () => clearInterval(id);
    }
  }, [page, load]);

  const pageProps = { lang, botOn, setBotOn, data, loading, error, reload: load };

  if (loading && !data) return <div className="page-scroll"><LoadingSpinner /></div>;
  if (error && !data) return <div className="page-scroll"><ErrorMsg message={error} onRetry={load} /></div>;

  const pages = {
    p1: <Dashboard {...pageProps} />,
    p2: <BotControl {...pageProps} />,
    p3: <Scanner {...pageProps} />,
    p4: <History {...pageProps} />,
    p5: <Performance {...pageProps} />,
    p6: <Knowledge {...pageProps} />,
    p7: <Withdraw {...pageProps} />,
    p8: <Team {...pageProps} />,
    p9: <ApiKeys {...pageProps} />,
  };

  return pages[page] || null;
}

export default function App() {
  const [user, setUser] = useState(() => auth.getUser());
  const [lang, setLang] = useState('de');
  const [page, setPage] = useState('p1');
  const [botOn, setBotOn] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bot-Status vom Server laden
  useEffect(() => {
    if (!user) return;
    bot.getStatus()
      .then(status => setBotOn(!status.killSwitchActive))
      .catch(() => {});
    const id = setInterval(() => {
      bot.getStatus()
        .then(status => setBotOn(!status.killSwitchActive))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [user]);

  // Kill Switch mit API verbinden
  const handleBotToggle = async (newState) => {
    try {
      if (newState) await bot.start();
      else await bot.stop();
      setBotOn(newState);
    } catch (err) {
      console.error('Bot toggle Fehler:', err.message);
    }
  };

  // Nicht eingeloggt -> Login-Seite
  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return (
    <div className="app">
      <Sidebar
        lang={lang}
        page={page}
        setPage={setPage}
        botOn={botOn}
        setBotOn={handleBotToggle}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Topbar
          lang={lang}
          setLang={setLang}
          page={page}
          onMenu={() => setSidebarOpen(true)}
          user={user}
          onLogout={() => { auth.logout(); setUser(null); }}
        />
        <PageWithData
          page={page}
          lang={lang}
          botOn={botOn}
          setBotOn={handleBotToggle}
        />
      </div>
    </div>
  );
}
