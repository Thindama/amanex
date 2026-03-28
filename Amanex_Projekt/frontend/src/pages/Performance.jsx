
import PerfChart from '../components/PerfChart';

const BRIER = [
  {name:'Gesamt',val:'0.18',col:'c-green',w:82},
  {name:'Grok',val:'0.16',col:'c-blue',w:84},
  {name:'Claude',val:'0.17',col:'c-green',w:83},
  {name:'GPT-4o',val:'0.21',col:'c-yellow',w:79},
  {name:'Gemini',val:'0.22',col:'c-yellow',w:78},
  {name:'DeepSeek',val:'0.19',col:'c-green',w:81},
];

export default function Performance() {
  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Win-Rate</div><div className="mval c-green">68.4%</div><div className="msub c-green">Ziel: 60%+</div></div>
        <div className="mcard"><div className="mlabel">Sharpe Ratio</div><div className="mval c-green">2.14</div><div className="msub c-green">Ausgezeichnet</div></div>
        <div className="mcard"><div className="mlabel">Max. Drawdown</div><div className="mval c-yellow">-4.2%</div><div className="msub c-muted">Limit: 8%</div></div>
        <div className="mcard"><div className="mlabel">Profit Factor</div><div className="mval c-green">1.87</div><div className="msub c-green">Ziel: 1.5+</div></div>
      </div>
      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Kumulativer Gewinn (90T)</div><div className="badge b-green">+4.120 EUR</div></div>
          <PerfChart />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Kalibrierung (Brier Score)</div><div className="badge b-green">0.18</div></div>
          <div className="stat-grid">
            {BRIER.map(b => (
              <div className="stat-item" key={b.name}>
                <div className="stat-name">{b.name}</div>
                <div className={`stat-val ${b.col}`}>{b.val}</div>
                <div className="brier-wrap"><div className="brier-fill" style={{width:b.w+'%'}} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
