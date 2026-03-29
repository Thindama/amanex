import { useState } from 'react';

export default function Slider({ label, desc, min, max, defaultVal, step = 1, suffix = '' }) {
  const [val, setVal] = useState(defaultVal);
  const display = suffix === '$' ? '$' + val : val + suffix;
  return (
    <div className="param-row">
      <div style={{ flex: 1 }}>
        <div className="param-name">{label}</div>
        {desc && <div className="param-desc">{desc}</div>}
      </div>
      <div className="param-right">
        <input
          type="range" min={min} max={max} value={val} step={step}
          onChange={e => setVal(Number(e.target.value))}
        />
        <div className="param-val">{display}</div>
      </div>
    </div>
  );
}
