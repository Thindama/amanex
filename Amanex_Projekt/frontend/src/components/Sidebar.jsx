
import { useEffect, useState } from 'react';
import { t } from '../i18n';

const NAV = [
  { group: 'overview', items: [['p1','dashboard'],['p2','control'],['p3','scanner']] },
  { group: 'analysis', items: [['p4','history'],['p5','performance'],['p6','knowledge']] },
  { group: 'system',   items: [['p7','withdraw'],['p8','team'],['p9','api']] },
];

export default function Sidebar({ lang, page, setPage, botOn, setBotOn, isOpen, onClose }) {
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
          <div className="logo-top">Amanex</div>
          <div className="logo-name">Dashboard</div>
        </div>
        <div className="nav">
          {NAV.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-sec">{t(lang, g.group)}</div>
              {g.items.map(([pid]) => (
                <div
                  key={pid}
                  className={`nav-item ${page === pid ? 'active' : ''}`}
                  onClick={() => { setPage(pid); onClose(); }}
                >
                  {t(lang, pid)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sf">
          <div className="bot-row">
            <div className={`dot ${botOn ? '' : 'off'}`} />
            <div className={`bot-label ${botOn ? '' : 'off'}`}>
              {botOn ? t(lang,'botActive') : t(lang,'botStopped')}
            </div>
            <div className="bot-time">{time}</div>
          </div>
          <div className={`kill ${botOn ? '' : 'start'}`} onClick={() => setBotOn(!botOn)}>
            {botOn ? t(lang,'kill') : t(lang,'startBot')}
          </div>
        </div>
      </div>
    </>
  );
}
