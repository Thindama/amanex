import { useState } from 'react';

const PAGE_TITLES = {
  p1: 'Live Dashboard',   p2: 'Bot-Steuerung',   p3: 'Markt-Scanner',
  p4: 'Trade-Historie',   p5: 'Performance',      p6: 'Wissensbasis',
  p7: 'Auszahlung',       p8: 'Team',             p9: 'API-Keys',
};
const PAGE_META = {
  p1: 'Letzter Scan: vor 4 Min.',     p2: 'Einstellungen & Risikoparameter',
  p3: '312 Märkte überwacht',          p4: '90-Tage-Übersicht · 312 Trades',
  p5: '90-Tage-Analyse',              p6: '47 Lektionen gespeichert',
  p7: 'Binance + Kraken',             p8: '3 aktive Mitglieder',
  p9: '9 Dienste konfigurieren',
};
const NOTIFS = [
  { id:1, icon:'✓', type:'ni-green', text:'BTC/USDT Trade erfolgreich +124 EUR', time:'vor 8 Min.', unread:true },
  { id:2, icon:'◈', type:'ni-blue', text:'Scan abgeschlossen – 8 neue Chancen', time:'vor 15 Min.', unread:true },
  { id:3, icon:'!', type:'ni-red', text:'API-Kosten: 90% des Tageslimits', time:'vor 1 Std.', unread:true },
];

export default function Topbar({ lang, setLang, page, onMenu, onLogout, user }) {
  const [notifs, setNotifs] = useState(NOTIFS);
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => n.unread).length;
  const initials = user?.email?.substring(0,2).toUpperCase() || 'AM';

  return (
    <div className="topbar">
      <div style={{ display:'flex', alignItems:'center', gap:'12px', minWidth:0 }}>
        <button className="hamburger" onClick={onMenu}>
          <span /><span /><span />
        </button>
        <div>
          <div className="page-title">{PAGE_TITLES[page] || 'Dashboard'}</div>
          <div className="page-meta">{PAGE_META[page] || ''}</div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="lang">
          <button className={`lang-btn ${lang==='de'?'on':''}`} onClick={() => setLang('de')}>DE</button>
          <button className={`lang-btn ${lang==='en'?'on':''}`} onClick={() => setLang('en')}>EN</button>
        </div>

        <div className="notif-wrap" onClick={() => setOpen(!open)}>
          <div className="notif-bell">🔔</div>
          {unread > 0 && <div className="notif-count">{unread}</div>}
          <div className={`notif-dropdown ${open ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="notif-head">
              <span style={{ fontSize:'12px', fontWeight:500 }}>Benachrichtigungen</span>
              <span style={{ fontSize:'11px', color:'var(--blue)', cursor:'pointer' }}
                onClick={() => setNotifs([])}>Alle löschen</span>
            </div>
            {notifs.length === 0
              ? <div style={{ padding:'20px', textAlign:'center', fontSize:'12px', color:'var(--muted)' }}>Keine Benachrichtigungen</div>
              : notifs.map(n => (
                <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className={`notif-icon ${n.type}`}>{n.icon}</div>
                  <div>
                    <div className="notif-text">{n.text}</div>
                    <div className="notif-time">{n.time}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="ava">{initials}</div>
        <button className="logout-btn" onClick={onLogout}>Abmelden</button>
      </div>
    </div>
  );
}
