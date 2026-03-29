import { useState } from 'react';
import './index.css';
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
import { auth } from './api/client';

const PAGES = {
  p1: Dashboard,
  p2: BotControl,
  p3: Scanner,
  p4: History,
  p5: Performance,
  p6: Knowledge,
  p7: Withdraw,
  p8: Team,
  p9: ApiKeys,
};

export default function App() {
  const [user, setUser] = useState(() => auth.getUser());
  const [lang, setLang] = useState('de');
  const [page, setPage] = useState('p1');
  const [botOn, setBotOn] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  const PageComponent = PAGES[page] || Dashboard;

  const handleLogout = () => {
    auth.logout();
    setUser(null);
  };

  return (
    <div className="app">
      <Sidebar
        lang={lang}
        page={page}
        setPage={(p) => { setPage(p); setSidebarOpen(false); }}
        botOn={botOn}
        setBotOn={setBotOn}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Topbar
          lang={lang}
          setLang={setLang}
          page={page}
          onMenu={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          user={user}
        />
        <PageComponent lang={lang} botOn={botOn} setBotOn={setBotOn} />
      </div>
    </div>
  );
}
