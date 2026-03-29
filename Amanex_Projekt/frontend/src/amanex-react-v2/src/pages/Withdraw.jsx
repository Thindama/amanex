const PLATFORMS = [
  {
    name: 'Binance', color: '#f0b90b', sub: 'Crypto Wallet · USDT',
    amount: '$8.240', eur: 'ca. 7.620 EUR · Verfügbar',
    wallet: '0x1a2b...8f9e · USDT', btnLabel: 'Auf Binance auszahlen',
    btnColor: '#00d68f', btnText: '#000',
    link: 'https://www.binance.com/de/my/wallet/account/main/withdrawal',
    steps: ['USDT von Wallet auf Krypto-Börse senden','Auf Coinbase oder Kraken in EUR tauschen','EUR auf Bankkonto überweisen'],
  },
  {
    name: 'Kraken', color: '#5741d9', sub: 'EUR Wallet · Direkt',
    amount: '3.627 EUR', eur: 'Direkt verfügbar · EUR',
    wallet: 'SEPA-Überweisung · 1-3 Tage', btnLabel: 'Auf Kraken auszahlen',
    btnColor: '#b8975a', btnText: '#000',
    link: 'https://www.kraken.com/u/funding/withdraw',
    steps: ['kraken.com → Funding → Withdraw','Betrag und IBAN eingeben','Bestätigen · 1-3 Werktage'],
  },
];

export default function Withdraw() {
  return (
    <div className="page-scroll">
      <div className="row-2">
        {PLATFORMS.map(p => (
          <div className="plat-card" key={p.name}>
            <div className="plat-logo" style={{ background:p.color }}>{p.name[0]}</div>
            <div style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>{p.name}</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'16px' }}>{p.sub}</div>
            <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'JetBrains Mono, monospace', color:'var(--green)', marginBottom:'4px' }}>{p.amount}</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'16px' }}>{p.eur}</div>
            <div style={{ padding:'12px 14px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px' }}>
              <div style={{ fontSize:'10px', color:'var(--muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>Wallet / Methode</div>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'12px', color:'var(--blue)' }}>{p.wallet}</div>
            </div>
            <button className="wd-btn" style={{ background:p.btnColor, color:p.btnText }}
              onClick={() => window.open(p.link, '_blank')}>
              {p.btnLabel}
            </button>
            <div style={{ marginTop:'14px' }}>
              {p.steps.map((s,i) => (
                <div className="step-item" key={i}>
                  <div className="step-num" style={{ background:'var(--blue)', color:'#000' }}>{i+1}</div>
                  <div style={{ fontSize:'12px', color:'var(--muted)' }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
