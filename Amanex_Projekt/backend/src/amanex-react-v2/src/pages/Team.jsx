import { useState } from 'react';

const INITIAL_TEAM = [
  { initials:'AM', name:'Aman (Du)', email:'aman@amanex.de', role:'admin', color:'linear-gradient(135deg,#b8975a,#00d68f)' },
  { initials:'MK', name:'Max Kaufmann', email:'max@example.com', role:'viewer', color:'#3498db' },
  { initials:'SL', name:'Sara Lindner', email:'sara@example.com', role:'viewer', color:'#9b59b6' },
];

export default function Team() {
  const [team, setTeam] = useState(INITIAL_TEAM);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [sent, setSent] = useState(false);

  const remove = (i) => setTeam(t => t.filter((_,j) => j !== i));

  const invite = () => {
    if (!email) return;
    const initials = email.substring(0,2).toUpperCase();
    const colors = ['#e74c3c','#3498db','#9b59b6','#f39c12','#1abc9c'];
    const color = colors[Math.floor(Math.random()*colors.length)];
    setTeam(t => [...t, { initials, name:email, email, role, color }]);
    setEmail(''); setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div className="page-scroll">
      <div className="row-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Team-Mitglieder</div><div className="badge b-blue">{team.length} aktiv</div></div>
          {team.map((m,i) => (
            <div className="team-item" key={i}>
              <div className="team-ava" style={{ background:m.color }}>{m.initials}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:500 }}>{m.name}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)' }}>{m.email}</div>
              </div>
              <div className={m.role==='admin'?'r-admin':'r-viewer'}>{m.role==='admin'?'Admin':'Viewer'}</div>
              {m.role !== 'admin' && (
                <button className="remove-btn" onClick={() => remove(i)}>Entfernen</button>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Mitglied einladen</div></div>
          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>E-Mail</div>
            <input className="field-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@beispiel.com" />
          </div>
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Rolle</div>
            <div className="filter-row">
              <button className={`filter-btn ${role==='admin'?'on':''}`} onClick={() => setRole('admin')}>Admin</button>
              <button className={`filter-btn ${role==='viewer'?'on':''}`} onClick={() => setRole('viewer')}>Viewer</button>
            </div>
          </div>
          <div style={{ padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px', color:'var(--muted)', lineHeight:1.8 }}>
            <span style={{ color:'var(--blue)' }}>Admin:</span> Voller Zugriff auf alle Funktionen<br/>
            Viewer: Nur lesen, keine Änderungen
          </div>
          <button className={`save-btn ${sent?'saved':''}`} onClick={invite}>
            {sent ? 'Einladung gesendet ✓' : 'Einladung senden'}
          </button>
        </div>
      </div>
    </div>
  );
}
