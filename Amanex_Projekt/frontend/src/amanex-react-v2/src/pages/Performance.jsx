import { PerfChart } from '../components/Charts';

const BRIER = [
  { name:'Gesamt', val:'0.18', pct:82, c:'var(--green)' },
  { name:'Grok', val:'0.16', pct:84, c:'var(--blue)' },
  { name:'Claude', val:'0.17', pct:83, c:'var(--green)' },
  { name:'GPT-4o', val:'0.21', pct:79, c:'var(--yellow)' },
  { name:'Gemini', val:'0.22', pct:78, c:'var(--yellow)' },
  { name:'DeepSeek', val:'0.19', pct:81, c:'var(--green)' },
];

export default function Performance() {
  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Win-Rate</div><div className="mval c-green">68.4%</div><div className="msub c-green">Ziel: 60%+</div></div>
        <div className="mcard"><div className="mlabel">Sharpe Ratio</div><div className="mval c-blue">2.14</div><div className="msub c-green">Ausgezeichnet</div></div>
        <div className="mcard"><div className="mlabel">Max. Drawdown</div><div className="mval c-yellow">-4.2%</div><div className="msub c-muted">Limit: 8%</div></div>
        <div className="mcard"><div className="mlabel">Profit Factor</div><div className="mval c-green">1.87</div><div className="msub c-green">Ziel: 1.5+</div></div>
      </div>
      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Kumulativer Gewinn (90T)</div><div className="badge b-green">+4.120 EUR</div></div>
          <PerfChart />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Kalibrierung (Brier Score)</div><div className="badge b-blue">0.18</div></div>
          <div className="stat-grid">
            {BRIER.map(b => (
              <div className="stat-item" key={b.name}>
                <div className="stat-name">{b.name}</div>
                <div className="stat-val" style={{ color:b.c }}>{b.val}</div>
                <div className="brier-wrap"><div className="brier-fill" style={{ width:b.pct+'%', background:b.c }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
