
const STEPS_KALSHI = ['kalshi.com oeffnen - Account - Withdraw','Betrag eingeben und Bankkonto waehlen','Bestaetigen - Ueberweisung in 1-3 Werktagen'];
const STEPS_POLY = ['USDC von Wallet auf Krypto-Boerse senden','Auf Coinbase / Kraken in EUR tauschen','EUR auf dein Bankkonto ueberweisen'];

function PlatCard({ logo, bg, title, balance, eur, detail, label, steps, stepColor, onWithdraw }) {
  return (
    <div className="plat-card">
      <div className="plat-logo" style={{background:bg}}>{logo}</div>
      <div style={{fontSize:'12px',color:'var(--muted)'}}>{title}</div>
      <div style={{fontSize:'28px',fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:'var(--green)',margin:'8px 0 4px'}}>{balance}</div>
      <div style={{fontSize:'11px',color:'var(--muted)'}}>{eur}</div>
      <div style={{marginTop:'14px',padding:'12px',background:'var(--card)',borderRadius:'8px',border:'1px solid var(--border)'}}>
        <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'6px'}}>{detail.label}</div>
        <div style={{fontSize:'13px',fontWeight:500}}>{detail.value}</div>
        <div style={{fontSize:'10px',color:'var(--muted)',marginTop:'3px'}}>{detail.sub}</div>
      </div>
      <button className="wd-btn" style={{background:bg,color:bg==='#2ecc71'?'#000':'#fff',fontWeight:700}} onClick={onWithdraw}>{label}</button>
      <div style={{marginTop:'12px'}}>
        <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'6px',fontWeight:500}}>So geht es:</div>
        {steps.map((s,i) => (
          <div className="step-item" key={i}>
            <div className="step-num" style={{background:stepColor+'22',color:stepColor}}>{i+1}</div>
            <div style={{fontSize:'11px',color:'var(--muted)'}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Withdraw() {
  return (
    <div className="page-scroll">
      <div className="row-2">
        <PlatCard logo="KA" bg="#2ecc71" title="Kalshi Guthaben" balance="$8.240" eur="ca. 7.620 EUR - Verfuegbar"
          detail={{label:'Auszahlungsmethode',value:'Bankkonto (ACH/Wire)',sub:'IBAN: DE** **** **** **** **12'}}
          label="Auf Kalshi auszahlen" steps={STEPS_KALSHI} stepColor="var(--green)"
          onWithdraw={() => alert('Weiterleitung zu kalshi.com/withdraw')} />
        <PlatCard logo="PM" bg="#9b59b6" title="Polymarket Wallet" balance="$4.607" eur="ca. 4.260 EUR - USDC auf Polygon"
          detail={{label:'Wallet-Adresse',value:'0x1a2b...8f9e',sub:'Polygon Network - USDC'}}
          label="Auf Polymarket auszahlen" steps={STEPS_POLY} stepColor="#9b59b6"
          onWithdraw={() => alert('Weiterleitung zu app.polymarket.com')} />
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Gesamt verfuegbar</div></div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'16px'}}>
          <div>
            <div style={{fontSize:'32px',fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:'var(--green)'}}>11.880 EUR</div>
            <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px'}}>Kalshi 7.620 EUR + Polymarket 4.260 EUR</div>
          </div>
          <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
            {[['Eingezahlt','10.000 EUR','var(--text)'],['Gewinn','+1.880 EUR','var(--green)'],['Rendite','+18.8%','var(--green)']].map(([label,val,col]) => (
              <div key={label} style={{padding:'12px 18px',background:col==='var(--text)'?'var(--surface)':'rgba(0,214,143,.06)',border:'1px solid '+(col==='var(--text)'?'var(--border)':'rgba(0,214,143,.2)'),borderRadius:'8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'4px'}}>{label}</div>
                <div style={{fontSize:'16px',fontWeight:600,fontFamily:'JetBrains Mono,monospace',color:col}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
