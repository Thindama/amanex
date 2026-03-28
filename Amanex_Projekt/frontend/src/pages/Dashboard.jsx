import PnlChart from '../components/PnlChart';

const DEMO_TRADES = [
  {side:'JA',name:'EZB senkt Zinsen April',plat:'Kalshi',time:'vor 8 Min.',pnl:'+124 EUR',pos:true},
  {side:'NEIN',name:'BTC ueber 95k',plat:'Polymarket',time:'vor 23 Min.',pnl:'+87 EUR',pos:true},
  {side:'JA',name:'Fed haelt Zinsen stabil',plat:'Kalshi',time:'vor 1 Std.',pnl:'-43 EUR',pos:false},
  {side:'JA',name:'Apple Q2 Erwartungen',plat:'Polymarket',time:'vor 2 Std.',pnl:'+201 EUR',pos:true},
];
const AI_MODELS = [
  {name:'Grok (30%)',pct:71,color:'var(--blue)'},
  {name:'Claude (20%)',pct:68,color:'var(--green)'},
  {name:'GPT-4o (20%)',pct:74,color:'var(--yellow)'},
  {name:'Gemini (15%)',pct:65,color:'var(--muted)'},
  {name:'DeepSeek (15%)',pct:69,color:'var(--muted)'},
];

export default function Dashboard({ data }) {
  // Echte Daten vom Backend, sonst Fallback auf Beispieldaten
  const balance      = data?.balance      ?? 12847;
  const winRate      = data?.winRate      ?? 68.4;
  const openPos      = data?.openPositions ?? 7;
  const maxPos       = data?.maxPositions  ?? 15;
  const sharpe       = data?.sharpeRatio   ?? 2.14;
  const dailyPnl     = data?.dailyPnl      ?? 847;

  const riskItems = [
    { n:'Tagesverlust', v: dailyPnl >= 0 ? '+' + Math.round(Math.abs(dailyPnl/balance*100)*10)/10 + '%' : '-' + Math.round(Math.abs(dailyPnl/balance*100)*10)/10 + '%', c:'var(--green)', w: Math.min(Math.abs(dailyPnl/balance*100)*5, 100) },
    { n:'Drawdown',     v:'2.1%',  c:'var(--yellow)', w:26 },
    { n:'Exposure',     v: Math.round(openPos/maxPos*100) + '%', c:'var(--blue)', w: Math.round(openPos/maxPos*100) },
    { n:'API-Kosten',   v:'$18',   c:'var(--blue)',   w:36 },
  ];

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Kontostand</div><div className="mval c-green">{balance.toLocaleString('de-DE')} EUR</div><div className="msub c-green">{dailyPnl >= 0 ? '+' : ''}{dailyPnl} EUR heute</div></div>
        <div className="mcard"><div className="mlabel">Win-Rate (90T)</div><div className="mval c-blue">{winRate}%</div><div className="msub c-muted">Ziel: 60%+</div></div>
        <div className="mcard"><div className="mlabel">Offene Positionen</div><div className="mval c-yellow">{openPos} / {maxPos}</div><div className="msub c-muted">Max. {maxPos}</div></div>
        <div className="mcard"><div className="mlabel">Sharpe Ratio</div><div className="mval c-green">{sharpe}</div><div className="msub c-green">Ausgezeichnet</div></div>
      </div>
      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">P&L letzte 14 Tage</div><div className="badge b-green">+{data?.totalPnl ?? 2847} EUR</div></div>
          <PnlChart />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Risiko-Monitor</div><div className="badge b-green">Alles OK</div></div>
          <div className="risk-grid">
            {riskItems.map(r => (
              <div className="risk-item" key={r.n}>
                <div className="risk-name">{r.n}</div>
                <div className="risk-val" style={{color:r.c}}>{r.v}</div>
                <div className="risk-track"><div className="risk-fill" style={{width:r.w+'%',background:r.c}} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Letzte Trades</div><div className="badge b-blue">Live</div></div>
          <div className="trade-list">
            {DEMO_TRADES.map((tr,i) => (
              <div className="trade" key={i}>
                <div className={`side ${tr.side==='JA'?'s-yes':'s-no'}`}>{tr.side}</div>
                <div style={{flex:1}}><div className="t-name">{tr.name}</div><div className="t-plat">{tr.plat} - {tr.time}</div></div>
                <div className={`t-pnl ${tr.pos?'c-green':'c-red'}`}>{tr.pnl}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">KI-Konsens</div><div className="badge b-green">Edge +7.2%</div></div>
          <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'12px',fontFamily:'JetBrains Mono,monospace'}}>EZB senkt Zinsen April - JA @ 0.62</div>
          <div className="ai-list">
            {AI_MODELS.map(m => (
              <div className="ai-row" key={m.name}>
                <div className="ai-name">{m.name}</div>
                <div className="ai-track"><div className="ai-fill" style={{width:m.pct+'%',background:m.color}} /></div>
                <div className="ai-pct" style={{color:m.color}}>{m.pct}%</div>
              </div>
            ))}
          </div>
          <div className="consensus">
            <span style={{fontSize:'11px',color:'var(--muted)'}}>Gewichteter Konsens</span>
            <span style={{fontSize:'20px',fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:'var(--green)'}}>69.2%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
