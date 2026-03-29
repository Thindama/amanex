import { useState } from 'react';

const MARKETS = [
  { name:'BTC/USDT', plat:'Binance', price:'82.410', ai:'89.200', edge:'+7.2%', ePct:72, vol:'12.200', signal:'KAUF', sc:'b-green', type:'crypto' },
  { name:'ETH/EUR', plat:'Kraken', price:'1.847', ai:'1.960', edge:'+6.1%', ePct:61, vol:'5.400', signal:'KAUF', sc:'b-green', type:'crypto' },
  { name:'NVIDIA (NVDA)', plat:'Aktien', price:'875.20', ai:'920.00', edge:'+5.1%', ePct:51, vol:'3.800', signal:'SIGNAL', sc:'b-blue', type:'stock' },
  { name:'SOL/USDT', plat:'Binance', price:'142.80', ai:'148.00', edge:'+3.6%', ePct:36, vol:'8.100', signal:'WATCH', sc:'b-yellow', type:'crypto' },
  { name:'Apple (AAPL)', plat:'Aktien', price:'189.40', ai:'193.20', edge:'+2.0%', ePct:20, vol:'6.500', signal:'SKIP', sc:'b-red', type:'stock' },
];

export default function Scanner() {
  const [filter, setFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  const filtered = filter === 'all' ? MARKETS : MARKETS.filter(m =>
    filter === 'binance' ? m.plat === 'Binance' :
    filter === 'kraken'  ? m.plat === 'Kraken' :
    filter === 'stocks'  ? m.plat === 'Aktien' :
    filter === 'edge5'   ? parseFloat(m.edge) > 5 : true
  );

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 2000);
  };

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Gescannte Märkte</div><div className="mval">312</div><div className="msub c-muted">07:37 Uhr</div></div>
        <div className="mcard"><div className="mlabel">Chancen gefunden</div><div className="mval c-green">8</div><div className="msub c-green">Bereit</div></div>
        <div className="mcard"><div className="mlabel">Ø Edge</div><div className="mval c-blue">5.8%</div><div className="msub c-muted">Min. 4%</div></div>
        <div className="mcard"><div className="mlabel">Nächster Scan</div><div className="mval">11<span style={{fontSize:'14px',color:'var(--muted)'}}> Min</span></div><div className="msub c-muted">Automatisch</div></div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Aktive Märkte</div>
          <div className="filter-row">
            {[['all','Alle'],['binance','Binance'],['kraken','Kraken'],['stocks','Aktien'],['edge5','Edge > 5%']].map(([k,l]) => (
              <button key={k} className={`filter-btn ${filter===k?'on':''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
            <button className="action-btn" onClick={handleScan} disabled={scanning}>
              {scanning ? 'Scannt...' : 'Jetzt scannen'}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Markt</th><th>Plattform</th><th>Preis</th><th>KI-Schätzung</th><th>Edge</th><th>Volumen</th><th>Signal</th></tr>
            </thead>
            <tbody>
              {filtered.map((m,i) => (
                <tr key={i}>
                  <td style={{ fontWeight:500 }}>{m.name}</td>
                  <td><div className={`badge ${m.plat==='Binance'?'b-blue':m.plat==='Kraken'?'b-yellow':'b-blue'}`}>{m.plat}</div></td>
                  <td style={{ fontFamily:'JetBrains Mono, monospace' }}>{m.price}</td>
                  <td style={{ fontFamily:'JetBrains Mono, monospace', color:'var(--green)' }}>{m.ai}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div className="edge-wrap"><div className="edge-fill" style={{ width:m.ePct+'%' }} /></div>
                      <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'11px', color:'var(--blue)' }}>{m.edge}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily:'JetBrains Mono, monospace', color:'var(--muted)' }}>{m.vol}</td>
                  <td><div className={`badge ${m.sc}`}>{m.signal}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
