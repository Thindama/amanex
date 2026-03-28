import { useState } from 'react';
import { t } from '../i18n';
import { NOTIFS } from '../data';

export default function Topbar({ lang, setLang, page, onMenu, user, onLogout }) {
  const [notifs, setNotifs] = useState(NOTIFS);
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => n.unread).length;

  const pageTitles = {
    p1:'Live Dashboard',p2:'Bot-Steuerung',p3:'Markt-Scanner',
    p4:'Trade-Historie',p5:'Performance',p6:'Wissensbasis',
    p7:'Auszahlung',p8:'Team',p9:'API-Keys'
  };
  const pageMetas = {
    p1:'Letzter Scan: vor 4 Min.',p2:'Einstellungen & Risikoparameter',
    p3:'312 Maerkte ueberwacht',p4:'90-Tage-Uebersicht',
    p5:'90-Tage-Analyse',p6:'47 Lektionen',
    p7:'Kalshi + Polymarket',p8:'Team-Verwaltung',p9:'API-Keys konfigurieren'
  };
  const iconMap = { checkmark:'\u2713', alert:'!', warning:'\u26A0', scan:'\u25C8' };
  const initials = user?.email ? user.email.substring(0,2).toUpperCase() : 'AM';

  return (
    <div className="topbar">
      <div style={{display:'flex',alignItems:'center',gap:'12px',minWidth:0}}>
        <button className="hamburger" onClick={onMenu}><span /><span /><span /></button>
        <div>
          <div className="page-title">{pageTitles[page] || 'Dashboard'}</div>
          <div className="page-meta">{pageMetas[page] || ''}</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="lang">
          <button className={`lang-btn ${lang==='de'?'on':''}`} onClick={() => setLang('de')}>DE</button>
          <button className={`lang-btn ${lang==='en'?'on':''}`} onClick={() => setLang('en')}>EN</button>
        </div>
        <div className="notif-wrap" onClick={() => setOpen(!open)}>
          <div className="notif-bell">&#128276;</div>
          {unread > 0 && <div className="notif-count">{unread}</div>}
          <div className={`notif-dropdown ${open?'open':''}`} onClick={e => e.stopPropagation()}>
            <div className="notif-head">
              <span style={{fontSize:'12px',fontWeight:500}}>{t(lang,'notifTitle')}</span>
              <span style={{fontSize:'11px',color:'var(--blue)',cursor:'pointer'}} onClick={() => setNotifs([])}>{t(lang,'notifClear')}</span>
            </div>
            {notifs.length === 0
              ? <div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:'var(--muted)'}}>{t(lang,'noNotif')}</div>
              : notifs.map(n => (
                <div key={n.id} className={`notif-item ${n.unread?'unread':''}`}>
                  <div className={`notif-icon ${n.type}`}>{iconMap[n.icon]}</div>
                  <div><div className="notif-text">{n.text}</div><div className="notif-time">{n.time}</div></div>
                </div>
              ))
            }
          </div>
        </div>
        <div style={{position:'relative',display:'flex',alignItems:'center',gap:'8px'}}>
          <div className="ava" title={user?.email}>{initials}</div>
          {onLogout && (
            <button onClick={onLogout} style={{padding:'5px 10px',background:'rgba(255,77,106,.08)',border:'1px solid rgba(255,77,106,.2)',borderRadius:'6px',color:'var(--red)',fontSize:'11px',cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
              Abmelden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
