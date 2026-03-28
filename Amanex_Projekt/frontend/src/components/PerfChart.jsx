
import { PERF_DATA, PERF_MONTHS } from '../data';
const MAX = Math.max(...PERF_DATA);
export default function PerfChart() {
  return (
    <>
      <div className="perf-chart">
        {PERF_DATA.map((v,i) => (
          <div key={i} className="perf-bar"
            style={{height: Math.max(4, Math.round(v/MAX*122)) + 'px'}} />
        ))}
      </div>
      <div className="bar-days">
        {PERF_MONTHS.map((m,i) => <div key={i} className="bar-day">{m}</div>)}
      </div>
    </>
  );
}
