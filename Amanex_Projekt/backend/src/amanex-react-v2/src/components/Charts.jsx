const PNL_DATA = [120,-40,210,180,-80,310,90,250,-30,190,280,150,340,87];
const MAX_PNL = Math.max(...PNL_DATA.map(Math.abs));

export function PnlChart() {
  return (
    <>
      <div className="bars">
        {PNL_DATA.map((v,i) => (
          <div key={i} className={`bar ${v>=0?'bar-g':'bar-r'}`}
            style={{ height: Math.max(4, Math.round(Math.abs(v)/MAX_PNL*82)) + 'px' }} />
        ))}
      </div>
      <div className="bar-days">
        {PNL_DATA.map((_,i) => <div key={i} className="bar-day">T-{PNL_DATA.length-i}</div>)}
      </div>
    </>
  );
}

const PERF_DATA = [200,480,310,720,550,900,1100,800,1300,1600,1200,1900,2400,3100,4120];
const PERF_MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D','J','F','M'];
const MAX_PERF = Math.max(...PERF_DATA);

export function PerfChart() {
  return (
    <>
      <div className="perf-chart">
        {PERF_DATA.map((v,i) => (
          <div key={i} className="perf-bar"
            style={{ height: Math.max(4, Math.round(v/MAX_PERF*122)) + 'px' }} />
        ))}
      </div>
      <div className="bar-days">
        {PERF_MONTHS.map((m,i) => <div key={i} className="bar-day">{m}</div>)}
      </div>
    </>
  );
}
