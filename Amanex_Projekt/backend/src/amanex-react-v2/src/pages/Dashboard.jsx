import { PnlChart } from '../components/Charts';

const TRADES = [
  { side:'KAUF', name:'BTC/USDT Breakout', plat:'Binance', time:'vor 8 Min.', pnl:'+124 EUR', pos:true },
  { side:'VERK', name:'ETH/EUR Short', plat:'Kraken', time:'vor 23 Min.', pnl:'+87 EUR', pos:true },
  { side:'KAUF', name:'NVIDIA Signal', plat:'Aktien', time:'vor 1 Std.', pnl:'-43 EUR', pos:false },
  { side:'KAUF', name:'Apple Earnings', plat:'Aktien', time:'vor 2 Std.', pnl:'+201 EUR', pos:true },
];
const AI_MODELS = [
  { name:'Grok (30%)', pct:71 },
  { name:'Claude (20%)', pct:68 },
  { name:'GPT-4o (20%)', pct:74 },
  { name:'Gemini (15%)', pct:65 },
  { name:'DeepSeek (15%)', pct:69 },
];
const RISKS = [
  { n:'Tagesverlust', v:'+6.6%', c:'var(--green)', w:44 },
  { n:'Drawdown', v:'2.1%', c:'var(--yellow)', w:26 },
  { n:'Exposure', v:'11.2%', c:'var(--blue)', w:75 },
  { n:'API-Kosten', v:'$18', c:'var(--blue)', w:36 },
];

export default function Dashboard() {
  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Kontostand</div><div className="mval c-green">12.847 EUR</div><div className="msub c-green">+847 EUR heute</div></div>
        <div className="mcard"><div className="mlabel">Win-Rate (90T)</div><div className="mval c-blue">68.4%</div><div className="msub c-muted">Ziel: 60%+</div></div>
        <div className="mcard"><div className="mlabel">Offene Positionen</div><div className="mval c-yellow">7 / 15</div><div className="msub c-muted">Max. 15</div></div>
        <div className="mcard"><div className="mlabel">Sharpe Ratio</div><div className="mval c-green">2.14</div><div className="msub c-green">Ausgezeichnet</div></div>
      </div>

      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">P&L letzte 14 Tage</div><div className="badge b-green">+2.847 EUR</div></div>
          <PnlChart />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Risiko-Monitor</div><div className="badge b-green">Alles OK</div></div>
          <div className="risk-grid">
            {RISKS.map(r => (
              <div className="risk-item" key={r.n}>
                <div className="risk-name">{r.n}</div>
                <div className="risk-val" style={{ color:r.c }}>{r.v}</div>
                <div className="risk-track"><div className="risk-fill" style={{ width:r.w+'%', background:r.c }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Letzte Trades</div><div className="badge b-blue">Live</div></div>
          <div className="trade-list">
            {TRADES.map((tr,i) => (
              <div className="trade" key={i}>
                <div className={`side ${tr.side==='KAUF'?'s-yes':'s-no'}`}>{tr.side}</div>
                <div style={{ flex:1 }}>
                  <div className="t-name">{tr.name}</div>
                  <div className="t-plat">{tr.plat} · {tr.time}</div>
                </div>
                <div className={`t-pnl ${tr.pos?'c-green':'c-red'}`}>{tr.pnl}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">KI-Konsens</div><div className="badge b-green">Edge +7.2%</div></div>
          <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'12px', fontFamily:'JetBrains Mono, monospace' }}>BTC/USDT · KAUF @ 82.410</div>
          <div className="ai-list">
            {AI_MODELS.map(m => (
              <div className="ai-row" key={m.name}>
                <div className="ai-name">{m.name}</div>
                <div className="ai-track"><div className="ai-fill" style={{ width:m.pct+'%', background:'var(--blue)' }} /></div>
                <div className="ai-pct c-blue">{m.pct}%</div>
              </div>
            ))}
          </div>
          <div className="consensus">
            <span style={{ fontSize:'11px', color:'var(--muted)' }}>Gewichteter Konsens</span>
            <span style={{ fontSize:'20px', fontWeight:600, fontFamily:'JetBrains Mono, monospace', color:'var(--blue)' }}>69.2%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
