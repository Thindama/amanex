import { useState } from 'react';
import { TRADES } from '../data';

export default function History({ data }) {
  const [filter, setFilter] = useState('all');

  // Echte Daten vom Backend, Fallback auf Beispieldaten
  const allTrades = (data && data.length > 0) ? data : TRADES;

  const normalize = (tr) => ({
    date:  tr.created_at ? new Date(tr.created_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : tr.date,
    name:  tr.market_title || tr.name,
    plat:  tr.platform === 'kalshi' ? 'Kalshi' : tr.platform === 'polymarket' ? 'Polymarket' : tr.plat,
    pc:    (tr.platform === 'kalshi' || tr.plat === 'Kalshi') ? 'b-blue' : 'b-yellow',
    side:  tr.side === 'yes' ? 'JA' : tr.side === 'no' ? 'NEIN' : tr.side,
    stake: tr.amount ? Math.round(tr.amount) + ' EUR' : tr.stake + ' EUR',
    fc:    tr.ai_consensus ? Math.round(tr.ai_consensus * 100) + '%' : tr.fc,
    won:   tr.pnl !== undefined ? tr.pnl > 0 : tr.won,
    pnl:   tr.pnl !== undefined ? (tr.pnl > 0 ? '+' : '') + Math.round(tr.pnl) + ' EUR' : (tr.won ? '+' : '-') + tr.pnl + ' EUR',
  });

  const filtered = allTrades.filter(tr => {
    const n = normalize(tr);
    if (filter === 'won')    return n.won;
    if (filter === 'lost')   return !n.won;
    if (filter === 'kalshi') return n.plat === 'Kalshi';
    if (filter === 'poly')   return n.plat === 'Polymarket';
    return true;
  });

  const total  = allTrades.length;
  const won    = allTrades.filter(t => normalize(t).won).length;
  const totalPnl = allTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Trades gesamt</div><div className="mval c-blue">{total}</div><div className="msub c-muted">90 Tage</div></div>
        <div className="mcard"><div className="mlabel">Gewonnen</div><div className="mval c-green">{won}</div><div className="msub c-green">{total > 0 ? Math.round(won/total*100) : 0}%</div></div>
        <div className="mcard"><div className="mlabel">Verloren</div><div className="mval c-red">{total - won}</div><div className="msub c-red">{total > 0 ? Math.round((total-won)/total*100) : 0}%</div></div>
        <div className="mcard"><div className="mlabel">Gesamtgewinn</div><div className={`mval ${totalPnl >= 0 ? 'c-green' : 'c-red'}`}>{totalPnl >= 0 ? '+' : ''}{Math.round(totalPnl)} EUR</div><div className="msub c-green">Netto</div></div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Alle Trades</div>
          <div className="filter-row">
            {[['all','Alle'],['won','Gewonnen'],['lost','Verloren'],['kalshi','Kalshi'],['poly','Polymarket']].map(([f,l]) => (
              <button key={f} className={`filter-btn ${filter===f?'on':''}`} onClick={() => setFilter(f)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Datum</th><th>Markt</th><th>Plattform</th><th>Seite</th><th>Einsatz</th><th>KI-Prognose</th><th>Ergebnis</th><th>P&L</th></tr></thead>
            <tbody>
              {filtered.map((tr,i) => {
                const n = normalize(tr);
                return (
                  <tr key={i}>
                    <td style={{color:'var(--muted)',fontSize:'11px',fontFamily:'JetBrains Mono,monospace'}}>{n.date}</td>
                    <td style={{fontWeight:500}}>{n.name}</td>
                    <td><span className={`badge ${n.pc}`}>{n.plat}</span></td>
                    <td><div className={`side ${n.side==='JA'?'s-yes':'s-no'}`}>{n.side}</div></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace'}}>{n.stake}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',color:'var(--blue)'}}>{n.fc}</td>
                    <td><div className={`badge ${n.won?'b-green':'b-red'}`}>{n.won?'Gewonnen':'Verloren'}</div></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',color:n.won?'var(--green)':'var(--red)',fontWeight:500}}>{n.pnl}</td>
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
