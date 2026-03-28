
import { useState } from 'react';
import { t } from '../i18n';

function ApiItem({ icon, bg, name, desc, connected, placeholder, defaultVal }) {
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const doSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="api-item">
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
        <div className="api-icon" style={{background:bg}}>{icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:'13px',fontWeight:500}}>{name}</div>
          <div style={{fontSize:'10px',color:'var(--muted)'}}>{desc}</div>
        </div>
        <div className={`badge ${connected?'b-green':'b-red'}`}>{connected?'Verbunden':'Nicht verbunden'}</div>
      </div>
      <div style={{display:'flex',gap:'8px'}}>
        <input className="key-input" type={visible?'text':'password'} defaultValue={defaultVal} placeholder={placeholder} />
        <button className="key-btn" onClick={() => setVisible(!visible)}>{visible?'Verbergen':'Anzeigen'}</button>
        <button className="key-btn" style={saved?{borderColor:'var(--green)',color:'var(--green)'}:{}} onClick={doSave}>{saved?'✓':'Speichern'}</button>
      </div>
    </div>
  );
}

const AI_APIS = [
  {icon:'AN',bg:'#c0392b',name:'Anthropic (Claude)',desc:'20% Gewichtung',connected:true,placeholder:'sk-ant-...',defaultVal:'sk-ant-xxxx'},
  {icon:'GR',bg:'#1a1a1a',name:'xAI (Grok)',desc:'30% Gewichtung',connected:true,placeholder:'xai-...',defaultVal:'xai-xxxx'},
  {icon:'GP',bg:'#10a37f',name:'OpenAI (GPT-4o)',desc:'20% Gewichtung',connected:true,placeholder:'sk-...',defaultVal:'sk-xxxx'},
  {icon:'GM',bg:'#4285f4',name:'Google (Gemini)',desc:'15% Gewichtung',connected:false,placeholder:'API Key...',defaultVal:''},
  {icon:'DS',bg:'#2d5a9e',name:'DeepSeek',desc:'15% Gewichtung',connected:true,placeholder:'API Key...',defaultVal:'sk-xxxx'},
];

const MKT_APIS = [
  {icon:'KA',bg:'#2ecc71',name:'Kalshi',desc:'US-reguliert',connected:true,placeholder:'API Key...',defaultVal:'xxxx'},
  {icon:'PM',bg:'#9b59b6',name:'Polymarket',desc:'Ethereum Wallet',connected:true,placeholder:'Private Key (0x...)',defaultVal:'0xxxxx'},
  {icon:'X',bg:'#1da1f2',name:'Twitter / X API',desc:'Echtzeit-Sentiment',connected:true,placeholder:'Bearer Token...',defaultVal:'AAAA'},
  {icon:'RD',bg:'#ff4500',name:'Reddit API',desc:'Community-Sentiment',connected:false,placeholder:'Client ID...',defaultVal:''},
];

export default function ApiKeys({ lang }) {
  return (
    <div className="page-scroll">
      <div className="row-2">
        <div>
          <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'10px',fontFamily:'JetBrains Mono,monospace',letterSpacing:'1px'}}>KI-MODELLE</div>
          {AI_APIS.map(a => <ApiItem key={a.name} {...a} />)}
        </div>
        <div>
          <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'10px',fontFamily:'JetBrains Mono,monospace',letterSpacing:'1px'}}>MAERKTE & DATEN</div>
          {MKT_APIS.map(a => <ApiItem key={a.name} {...a} />)}
        </div>
      </div>
    </div>
  );
}
