
import { PNL_DATA } from '../data';
const MAX = Math.max(...PNL_DATA.map(Math.abs));
export default function PnlChart() {
  return (
    <>
      <div className="bars">
        {PNL_DATA.map((v,i) => (
          <div key={i} className={`bar ${v>=0?'bar-g':'bar-r'}`}
            style={{height: Math.max(4, Math.round(Math.abs(v)/MAX*82)) + 'px'}} />
        ))}
      </div>
      <div className="bar-days">
        {PNL_DATA.map((_,i) => <div key={i} className="bar-day">T-{PNL_DATA.length-i}</div>)}
      </div>
    </>
  );
}
