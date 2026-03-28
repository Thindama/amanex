import { useState } from 'react';
import { auth } from '../api/client';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e && e.preventDefault();
    if (!email || !password) {
      setError('Bitte alle Felder ausfuellen');
      return;
    }
    setLoading(true);
    setError('');
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
    setEmail('demo@amanex.de');
    setPassword('demo1234');
    setTimeout(handleLogin, 200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '24px', letterSpacing: '3px', color: 'var(--blue)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textTransform: 'uppercase' }}>
            Amanex
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>
            Willkommen zurueck
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '32px' }}>

          {/* Hinweis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(245,166,35,.06)', border: '1px solid rgba(245,166,35,.15)', borderRadius: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '14px' }}>🔒</span>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--yellow)' }}>Eingeschraenkter Zugang</div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Nur eingeladene Personen koennen sich anmelden</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(255,77,106,.08)', border: '1px solid rgba(255,77,106,.2)', borderRadius: '7px', padding: '10px 14px', fontSize: '12px', color: 'var(--red)', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          {/* Form */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-Mail</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="deine@email.de"
              style={{ width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Passwort</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? 'var(--sub)' : 'var(--blue)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>oder</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleDemo}
            style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
          >
            Demo-Zugang verwenden
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: 'var(--muted)' }}>
          Geschuetzte Verbindung · Invite-Only Platform
        </div>
      </div>
    </div>
  );
}
