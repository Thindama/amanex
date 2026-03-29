// History.jsx
import { useState } from 'react';

const TRADES = [
  { date:'28.03 07:29', name:'BTC/USDT Breakout', plat:'Binance', side:'KAUF', stake:'312', fc:'69%', won:true, pnl:'+124' },
  { date:'28.03 07:14', name:'ETH/EUR Short', plat:'Kraken', side:'VERK', stake:'218', fc:'53%', won:true, pnl:'+87' },
  { date:'28.03 06:51', name:'Fed hält Zinsen', plat:'Binance', side:'KAUF', stake:'180', fc:'66%', won:false, pnl:'-43' },
  { date:'28.03 05:22', name:'Apple Earnings', plat:'Aktien', side:'KAUF', stake:'402', fc:'74%', won:true, pnl:'+201' },
  { date:'27.03 22:10', name:'US Arbeitslosigkeit', plat:'Binance', side:'KAUF', stake:'290', fc:'64%', won:true, pnl:'+158' },
  { date:'27.03 19:45', name:'EUR/USD über 1.10', plat:'Kraken', side:'VERK', stake:'150', fc:'58%', won:false, pnl:'-67' },
];

export function History() {
  const [filter, setFilter] = useState('all');
  const filtered = filter==='all' ? TRADES : filter==='won' ? TRADES.filter(t=>t.won) : filter==='lost' ? TRADES.filter(t=>!t.won) : TRADES.filter(t=>t.plat.toLowerCase()===filter);

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Trades gesamt</div><div className="mval">312</div><div className="msub c-muted">90 Tage</div></div>
        <div className="mcard"><div className="mlabel">Gewonnen</div><div className="mval c-green">213</div><div className="msub c-green">68.4%</div></div>
        <div className="mcard"><div className="mlabel">Verloren</div><div className="mval c-red">99</div><div className="msub c-red">31.6%</div></div>
        <div className="mcard"><div className="mlabel">Nettogewinn</div><div className="mval c-blue">4.120</div><div className="msub c-green">EUR gesamt</div></div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Alle Trades</div>
          <div className="filter-row">
            {[['all','Alle'],['won','Gewonnen'],['lost','Verloren'],['binance','Binance'],['kraken','Kraken'],['aktien','Aktien']].map(([k,l]) => (
              <button key={k} className={`filter-btn ${filter===k?'on':''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Datum</th><th>Markt</th><th>Plattform</th><th>Seite</th><th>Einsatz</th><th>KI-Prognose</th><th>Ergebnis</th><th>P&L</th></tr></thead>
            <tbody>
              {filtered.map((t,i) => (
                <tr key={i}>
                  <td style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'var(--muted)' }}>{t.date}</td>
                  <td style={{ fontWeight:500 }}>{t.name}</td>
                  <td><div className={`badge ${t.plat==='Binance'?'b-blue':t.plat==='Kraken'?'b-yellow':'b-blue'}`}>{t.plat}</div></td>
                  <td><div className={`side ${t.side==='KAUF'?'s-yes':'s-no'}`}>{t.side}</div></td>
                  <td style={{ fontFamily:'JetBrains Mono,monospace' }}>{t.stake} EUR</td>
                  <td style={{ fontFamily:'JetBrains Mono,monospace', color:'var(--blue)' }}>{t.fc}</td>
                  <td><div className={`badge ${t.won?'b-green':'b-red'}`}>{t.won?'Gewonnen':'Verloren'}</div></td>
                  <td style={{ fontFamily:'JetBrains Mono,monospace', color:t.won?'var(--green)':'var(--red)', fontWeight:600 }}>{t.pnl} EUR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default History;
