import { useState } from 'react';
import { auth } from '../api/client';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Bitte alle Felder ausfüllen'); return; }
    setLoading(true); setError('');
    try {
      const data = await auth.login(email, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    setEmail('aman@amanex.de');
    setPassword('Amanex2026!');
    setTimeout(handleLogin, 200);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'stretch', fontFamily:'Inter, sans-serif' }}>

      {/* LEFT */}
      <div style={{ width:'50%', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px 56px' }}>
        <div>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'20px', letterSpacing:'6px', color:'var(--blue)', fontWeight:600 }}>AMANEX</div>
          <div style={{ fontSize:'11px', color:'var(--muted)', letterSpacing:'2px', marginTop:'4px', textTransform:'uppercase' }}>Private Trading Intelligence</div>
        </div>
        <div>
          <div style={{ fontSize:'56px', fontWeight:700, lineHeight:1, letterSpacing:'-2px', marginBottom:'24px' }}>
            Trading.<br/>
            <span style={{ color:'var(--blue)' }}>Neu gedacht.</span>
          </div>
          <p style={{ fontSize:'14px', color:'var(--muted)', lineHeight:1.8, maxWidth:'380px' }}>
            Fünf KI-Modelle. Ein gewichteter Konsens. Vollautomatisches Crypto-Trading — und präzise Aktien-Signale für erfahrene Anleger.
          </p>
        </div>
        <div style={{ display:'flex', gap:'40px' }}>
          {[['68%','Win-Rate'],['2.14','Sharpe'],['24/7','Aktiv']].map(([v,l]) => (
            <div key={l}>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'22px', color:'var(--text)', fontWeight:600 }}>{v}</div>
              <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px' }}>
        <div style={{ width:'100%', maxWidth:'380px' }}>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'9px', letterSpacing:'3px', color:'rgba(184,151,90,0.6)', marginBottom:'40px' }}>
            SYS-AMANEX-v2.1 · SECURE ACCESS
          </div>

          <div style={{ fontSize:'28px', fontWeight:700, marginBottom:'8px' }}>Willkommen zurück.</div>
          <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'40px', lineHeight:1.7 }}>
            Nur eingeladene Personen haben Zugang. Melde dich mit deinen Zugangsdaten an.
          </p>

          {error && (
            <div style={{ background:'rgba(255,77,106,.08)', border:'1px solid rgba(255,77,106,.2)', borderRadius:'7px', padding:'10px 14px', fontSize:'12px', color:'var(--red)', marginBottom:'16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'8px' }}>E-Mail</div>
            <input className="field-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleLogin()}
              placeholder="deine@email.de" />
          </div>

          <div style={{ marginBottom:'24px' }}>
            <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'8px' }}>Passwort</div>
            <input className="field-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleLogin()}
              placeholder="••••••••" />
          </div>

          <button
            onClick={handleLogin} disabled={loading}
            style={{ width:'100%', padding:'13px', background:loading?'var(--sub)':'var(--blue)', border:'none', borderRadius:'8px', color:'#000', fontSize:'13px', fontWeight:700, fontFamily:'Inter, sans-serif', cursor:loading?'not-allowed':'pointer', transition:'opacity .2s' }}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'20px 0' }}>
            <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
            <span style={{ fontSize:'11px', color:'var(--muted)' }}>oder</span>
            <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
          </div>

          <button onClick={handleDemo}
            style={{ width:'100%', padding:'12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--muted)', fontSize:'13px', fontFamily:'Inter, sans-serif', cursor:'pointer', transition:'all .2s' }}>
            Demo-Zugang verwenden
          </button>

          <div style={{ marginTop:'32px', paddingTop:'20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:'10px', color:'rgba(240,236,228,0.3)' }}>© 2026 Amanex</span>
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'10px', color:'rgba(184,151,90,0.4)' }}>RESTRICTED · v2.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
