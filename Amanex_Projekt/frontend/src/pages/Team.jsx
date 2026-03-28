
import { useState } from 'react';
import { t } from '../i18n';

const COLORS = ['#e74c3c','#3498db','#9b59b6','#f39c12','#1abc9c'];
const INIT_MEMBERS = [
  {initials:'AM',name:'Aman (Du)',email:'aman@amanex.de',role:'admin',bg:'linear-gradient(135deg,var(--blue),var(--green))'},
  {initials:'MK',name:'Max Kaufmann',email:'max@example.com',role:'viewer',bg:'linear-gradient(135deg,var(--yellow),var(--red))'},
  {initials:'SL',name:'Sara Lindner',email:'sara@example.com',role:'viewer',bg:'linear-gradient(135deg,var(--green),var(--blue))'},
];

export default function Team({ lang }) {
  const [members, setMembers] = useState(INIT_MEMBERS);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [sent, setSent] = useState(false);

  const remove = (idx) => setMembers(members.filter((_,i) => i !== idx));

  const invite = () => {
    if (!email.trim()) return;
    const initials = email.substring(0,2).toUpperCase();
    const bg = COLORS[Math.floor(Math.random()*COLORS.length)];
    setMembers([...members, {initials, name:email, email, role, bg}]);
    setEmail('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div className="page-scroll">
      <div className="row-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Team-Mitglieder</div>
            <div className="badge b-blue">{members.length} {lang==='de'?'aktiv':'active'}</div>
          </div>
          {members.map((m,i) => (
            <div className="team-item" key={i}>
              <div className="team-ava" style={{background:m.bg}}>{m.initials}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{m.name}</div>
                <div style={{fontSize:'11px',color:'var(--muted)'}}>{m.email}</div>
              </div>
              <div className={`r-${m.role}`}>{m.role==='admin'?'Admin':'Viewer'}</div>
              {i > 0 && <button className="remove-btn" onClick={() => remove(i)}>{t(lang,'rem')}</button>}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">{lang==='de'?'Mitglied einladen':'Invite Member'}</div></div>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div>
              <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'6px'}}>E-Mail</div>
              <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.com" />
            </div>
            <div>
              <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'8px'}}>{lang==='de'?'Rolle':'Role'}</div>
              <div style={{display:'flex',gap:'8px'}}>
                <button className={`filter-btn ${role==='admin'?'on':''}`} onClick={() => setRole('admin')}>Admin</button>
                <button className={`filter-btn ${role==='viewer'?'on':''}`} onClick={() => setRole('viewer')}>Viewer</button>
              </div>
            </div>
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',padding:'12px',fontSize:'11px',color:'var(--muted)',lineHeight:1.8}}>
              <span style={{color:'var(--blue)'}}>Admin:</span> {lang==='de'?'Voller Zugriff':'Full access'}<br />
              Viewer: {lang==='de'?'Nur lesen':'Read only'}
            </div>
            <button className={`save-btn ${sent?'saved':''}`} onClick={invite} style={{marginTop:0}}>
              {sent ? (lang==='de'?'Gesendet':'Sent') + ' ✓' : t(lang,'sendInvite')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
