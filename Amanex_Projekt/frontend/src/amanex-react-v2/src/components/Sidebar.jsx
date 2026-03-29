import { useEffect, useState } from 'react';

const NAV = [
  { group: 'Übersicht', items: [
    { id: 'p1', label: '⬡  Live Dashboard' },
    { id: 'p2', label: '◎  Bot-Steuerung' },
    { id: 'p3', label: '◈  Markt-Scanner' },
  ]},
  { group: 'Analyse', items: [
    { id: 'p4', label: '◉  Trade-Historie' },
    { id: 'p5', label: '▲  Performance' },
    { id: 'p6', label: '◆  Wissensbasis' },
  ]},
  { group: 'System', items: [
    { id: 'p7', label: '□  Auszahlung' },
    { id: 'p8', label: '★  Team' },
    { id: 'p9', label: '⊕  API-Keys' },
  ]},
];

export default function Sidebar({ page, setPage, botOn, setBotOn, isOpen, onClose }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const n = new Date();
      setTime(String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0'));
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className={`overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo">
          <div className="logo-top">AMANEX</div>
          <div className="logo-name">Private Trading Intelligence</div>
        </div>

        <div className="nav">
          {NAV.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-sec">{g.group}</div>
              {g.items.map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sf">
          <div className="bot-row">
            <div className={`dot ${botOn ? '' : 'off'}`} />
            <div className={`bot-label ${botOn ? '' : 'off'}`}>
              {botOn ? 'Bot aktiv' : 'Bot gestoppt'}
            </div>
            <div className="bot-time">{time}</div>
          </div>
          <div
            className={`kill ${botOn ? '' : 'start'}`}
            onClick={() => setBotOn(!botOn)}
          >
            {botOn ? 'Kill Switch' : 'Bot starten'}
          </div>
        </div>
      </div>
    </>
  );
}
