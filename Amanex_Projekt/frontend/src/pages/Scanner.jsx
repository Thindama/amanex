import { useState } from 'react';
import { MARKETS } from '../data';

export default function Scanner({ data, loading, reload }) {
  const [filter, setFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  // Echte Daten vom Backend, Fallback auf Beispieldaten
  const markets = (data && data.length > 0) ? data : MARKETS;

  const filtered = markets.filter(m => {
    if (filter === 'kalshi')    return m.platform === 'kalshi' || m.plat === 'Kalshi';
    if (filter === 'poly')      return m.platform === 'polymarket' || m.plat === 'Polymarket';
    if (filter === 'edge5')     return parseFloat(m.edge || m.edgeScore) > 5;
    return true;
  });

  const doScan = () => {
    setScanning(true);
    reload && reload();
    setTimeout(() => setScanning(false), 2000);
  };

  // Felder normalisieren (Backend vs. Beispieldaten)
  const normalize = (m) => ({
    name:     m.title || m.name,
    plat:     m.platform === 'kalshi' ? 'Kalshi' : m.platform === 'polymarket' ? 'Polymarket' : m.plat,
    pc:       (m.platform === 'kalshi' || m.plat === 'Kalshi') ? 'b-blue' : 'b-yellow',
    mkt:      m.yes_price ? Math.round(m.yes_price * 100) + '%' : m.mkt,
    ai:       m.ai || '–',
    aiPos:    m.aiPos !== undefined ? m.aiPos : true,
    edge:     m.edge_score ? '+' + Math.round(m.edge_score * 100) / 10 + '%' : m.edge,
    ePct:     m.edge_score ? Math.min(Math.round(m.edge_score * 100), 100) : m.ePct,
    vol:      m.volume ? m.volume.toLocaleString('de-DE') : m.vol,
    exp:      m.expiry_days ? m.expiry_days + ' Tage' : m.exp,
    status:   m.status || 'TRADE',
    sc:       m.status === 'WATCH' ? 'b-yellow' : m.status === 'SKIP' ? 'b-red' : m.sc || 'b-green',
  });

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Gescannte Maerkte</div><div className="mval c-blue">312</div><div className="msub c-muted">Letzter Scan</div></div>
        <div className="mcard"><div className="mlabel">Chancen gefunden</div><div className="mval c-green">{filtered.length}</div><div className="msub c-green">Bereit</div></div>
        <div className="mcard"><div className="mlabel">Oe Edge</div><div className="mval c-yellow">5.8%</div><div className="msub c-muted">Min. 4%</div></div>
        <div className="mcard"><div className="mlabel">Naechster Scan</div><div className="mval c-blue">11 Min</div><div className="msub c-muted">Automatisch</div></div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Aktive Maerkte</div>
          <div className="filter-row">
            {[['all','Alle'],['kalshi','Kalshi'],['poly','Polymarket'],['edge5','Edge > 5%']].map(([f,l]) => (
              <button key={f} className={`filter-btn ${filter===f?'on':''}`} onClick={() => setFilter(f)}>{l}</button>
            ))}
            <button className="action-btn" onClick={doScan}>{scanning ? 'Scanne...' : 'Jetzt scannen'}</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Markt</th><th>Plattform</th><th>Marktpreis</th><th>KI-Schaetzung</th><th>Edge</th><th>Volumen</th><th>Ablauf</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((m,i) => {
                const n = normalize(m);
                return (
                  <tr key={i}>
                    <td style={{fontWeight:500}}>{n.name}</td>
                    <td><span className={`badge ${n.pc}`}>{n.plat}</span></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace'}}>{n.mkt}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',color:n.aiPos?'var(--green)':'var(--muted)'}}>{n.ai}</td>
                    <td><div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <div className="edge-wrap"><div className="edge-fill" style={{width:n.ePct+'%',background:n.aiPos?'var(--blue)':'var(--muted)'}} /></div>
                      <span style={{fontSize:'10px',color:n.aiPos?'var(--blue)':'var(--muted)',fontFamily:'JetBrains Mono,monospace'}}>{n.edge}</span>
                    </div></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',color:'var(--muted)'}}>{n.vol}</td>
                    <td style={{color:'var(--muted)',fontSize:'11px'}}>{n.exp}</td>
                    <td><div className={`badge ${n.sc}`}>{n.status}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
