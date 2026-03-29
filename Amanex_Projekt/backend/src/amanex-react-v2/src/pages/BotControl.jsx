import { useState } from 'react';
import Slider from '../components/Slider';

const MODELS = ['Grok (30%)','Claude Sonnet (20%)','GPT-4o (20%)','Gemini Flash (15%)','DeepSeek (15%)'];

export default function BotControl({ botOn, setBotOn }) {
  const [kelly, setKelly] = useState('25%');
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="page-scroll">
      <div className="row-3">
        <div className="card" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'24px 18px' }}>
          <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div className="card-title">Bot-Status</div>
            <div className={`badge ${botOn?'b-green':'b-red'}`}>{botOn?'Aktiv':'Gestoppt'}</div>
          </div>
          <div className={`toggle-circle ${botOn?'tc-on':'tc-off'}`} onClick={() => setBotOn(!botOn)}>
            {botOn ? 'AN' : 'AUS'}
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'15px', fontWeight:600 }}>{botOn ? 'Bot läuft' : 'Bot gestoppt'}</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'JetBrains Mono, monospace', marginTop:'4px' }}>
              {botOn ? 'Seit 4h 32min' : 'Manuell gestoppt'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Scan-Einstellungen</div></div>
          <Slider label="Scan-Intervall" desc="Wie oft der Scanner läuft" min={5} max={60} defaultVal={15} step={5} suffix=" Min" />
          <Slider label="Aktive Stunden" desc="Trading-Zeitfenster" min={1} max={24} defaultVal={24} suffix="h" />
          <Slider label="Max. API-Kosten/Tag" desc="Automatischer Stopp" min={10} max={100} defaultVal={50} step={5} suffix="$" />
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Kelly-Modus</div></div>
          <div style={{ textAlign:'center', padding:'10px 0 4px' }}>
            <div style={{ fontSize:'32px', fontWeight:600, fontFamily:'JetBrains Mono, monospace', color:'var(--blue)' }}>{kelly}</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>des Kelly-Wertes</div>
          </div>
          <div className="kelly-opts">
            {[['100%','Voll','Max. Wachstum'],['50%','Halb','Ausgewogen'],['25%','Viertel','Empfohlen'],['12%','Achtel','Konservativ']].map(([pct,name,sub]) => (
              <div key={pct} className={`kelly-opt ${kelly===pct?'on':''}`} onClick={() => setKelly(pct)}>
                <div className="kelly-opt-name">{name} ({pct})</div>
                <div className="kelly-opt-sub">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Risikoparameter</div></div>
          <Slider label="Min. Edge für Trade" desc="KI muss Marktpreis um X% übertreffen" min={2} max={15} defaultVal={4} suffix="%" />
          <Slider label="Max. pro Trade" desc="Maximaler Einsatz" min={1} max={10} defaultVal={5} suffix="%" />
          <Slider label="Max. gleichzeitige Trades" desc="Offene Positionen" min={1} max={20} defaultVal={15} />
          <Slider label="Tagesverlust-Limit" desc="Bot pausiert bei Überschreitung" min={5} max={30} defaultVal={15} suffix="%" />
          <Slider label="Max. Drawdown" desc="Alle Trades blockiert" min={2} max={20} defaultVal={8} suffix="%" />
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Aktive Plattformen</div></div>
          <div className="row-2" style={{ marginBottom:'16px' }}>
            {[['Binance','USDT Paare'],['Kraken','EUR Paare']].map(([p,sub]) => (
              <div key={p} style={{ padding:'12px', borderRadius:'8px', border:'1px solid var(--blue)', background:'rgba(184,151,90,.07)', cursor:'pointer' }}>
                <div style={{ fontSize:'13px', fontWeight:500 }}>{p}</div>
                <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{sub}</div>
              </div>
            ))}
          </div>
          <div className="card-head" style={{ marginBottom:'10px' }}><div className="card-title">KI-Modelle</div></div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {MODELS.map(m => (
              <div key={m} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface)', borderRadius:'7px', border:'1px solid var(--border)' }}>
                <span style={{ fontSize:'12px' }}>{m}</span>
                <div className="badge b-green">Aktiv</div>
              </div>
            ))}
          </div>
          <button className={`save-btn ${saved?'saved':''}`} onClick={handleSave}>
            {saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
