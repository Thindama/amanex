import { useState } from 'react';

function ApiItem({ icon, iconBg, name, desc, connected, fields }) {
  const [vals, setVals] = useState(fields.map(f => f.default || ''));
  const [shows, setShows] = useState(fields.map(() => false));
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="api-item">
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
        <div className="api-icon" style={{ background:iconBg }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:500 }}>{name}</div>
          <div style={{ fontSize:'10px', color:'var(--muted)' }}>{desc}</div>
        </div>
        <div className={`badge ${connected?'b-green':'b-red'}`}>{connected?'Verbunden':'Fehlt'}</div>
      </div>
      {fields.map((f,i) => (
        <div key={i} style={{ display:'flex', gap:'8px', marginBottom: i<fields.length-1?'6px':'0' }}>
          <input className="key-input" type={shows[i]?'text':'password'}
            placeholder={f.placeholder} value={vals[i]}
            onChange={e => { const v=[...vals]; v[i]=e.target.value; setVals(v); }} />
          <button className="key-btn" onClick={() => { const s=[...shows]; s[i]=!s[i]; setShows(s); }}>
            {shows[i]?'Verbergen':'Anzeigen'}
          </button>
          {i===fields.length-1 && (
            <button className="key-btn" style={{ borderColor:'var(--blue)', color:saved?'var(--green)':'var(--blue)' }} onClick={save}>
              {saved?'Gespeichert ✓':'Speichern'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const AI_APIS = [
  { icon:'AN', iconBg:'#c0392b', name:'Anthropic (Claude)', desc:'20% Gewichtung', connected:true, fields:[{placeholder:'sk-ant-...', default:'sk-ant-xxxx'}] },
  { icon:'GR', iconBg:'#1a1a1a', name:'xAI (Grok)', desc:'30% Gewichtung', connected:true, fields:[{placeholder:'xai-...', default:'xai-xxxx'}] },
  { icon:'GP', iconBg:'#10a37f', name:'OpenAI (GPT-4o)', desc:'20% Gewichtung', connected:true, fields:[{placeholder:'sk-...', default:'sk-xxxx'}] },
  { icon:'GM', iconBg:'#4285f4', name:'Google (Gemini)', desc:'15% Gewichtung', connected:false, fields:[{placeholder:'API Key...'}] },
  { icon:'DS', iconBg:'#2d5a9e', name:'DeepSeek', desc:'15% Gewichtung', connected:true, fields:[{placeholder:'API Key...', default:'sk-xxxx'}] },
];
const MARKET_APIS = [
  { icon:'BN', iconBg:'#f0b90b', name:'Binance', desc:'Crypto · USDT Paare', connected:true, fields:[{placeholder:'API Key...', default:'xxxx'},{placeholder:'API Secret...', default:'xxxx'}] },
  { icon:'KR', iconBg:'#5741d9', name:'Kraken', desc:'Crypto · EUR Paare', connected:false, fields:[{placeholder:'API Key...'},{placeholder:'API Secret...'}] },
  { icon:'X', iconBg:'#1da1f2', name:'Twitter / X API', desc:'Echtzeit-Sentiment', connected:true, fields:[{placeholder:'Bearer Token...', default:'AAAA'}] },
  { icon:'RD', iconBg:'#ff4500', name:'Reddit API', desc:'Community-Sentiment', connected:false, fields:[{placeholder:'Client ID...'},{placeholder:'Client Secret...'}] },
];

export default function ApiKeys() {
  return (
    <div className="page-scroll">
      <div className="row-2">
        <div>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>KI-Modelle</div>
          {AI_APIS.map(a => <ApiItem key={a.name} {...a} />)}
        </div>
        <div>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>Märkte & Daten</div>
          {MARKET_APIS.map(a => <ApiItem key={a.name} {...a} />)}
        </div>
      </div>
    </div>
  );
}
