const LESSONS = [
  { type:'Schlechte Prognose', c:'b-red', text:'Crypto-Märkte reagieren stärker auf Social-Media-Sentiment. Grok-Gewichtung bei Crypto auf 35% erhöhen.', meta:'28.03.2026 · SOL/USDT · Verlust: -43 EUR' },
  { type:'Schlechtes Timing', c:'b-yellow', text:'Zentralbank-Entscheidungen sollten frühestens 48h vor dem Termin gehandelt werden. Zu früher Einstieg führt zu erhöhter Volatilität.', meta:'25.03.2026 · Aktien · Verlust: -67 EUR' },
  { type:'Externer Schock', c:'b-blue', text:'Unerwartete Aussagen können Märkte in Minuten um 20%+ verschieben. Stop-Loss bei 3% setzen.', meta:'20.03.2026 · BTC/USDT · Verlust: -112 EUR' },
  { type:'Gute Prognose', c:'b-green', text:'Earnings-Plays mit hohem KI-Konsens über 70% lieferten zuverlässig positive Ergebnisse. Muster beibehalten.', meta:'15.03.2026 · NVIDIA · Gewinn: +201 EUR' },
];

export default function Knowledge() {
  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Lektionen</div><div className="mval">47</div><div className="msub c-muted">90 Tage</div></div>
        <div className="mcard"><div className="mlabel">Schlechte Prognose</div><div className="mval c-red">18</div><div className="msub c-red">38%</div></div>
        <div className="mcard"><div className="mlabel">Schlechtes Timing</div><div className="mval c-yellow">14</div><div className="msub c-muted">30%</div></div>
        <div className="mcard"><div className="mlabel">Externer Schock</div><div className="mval">15</div><div className="msub c-muted">32%</div></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Bot-Lernprotokoll</div><div className="badge b-blue">47 Einträge</div></div>
        {LESSONS.map((l,i) => (
          <div className="learn-item" key={i}>
            <div className={`badge ${l.c}`} style={{ marginBottom:'10px', display:'inline-block' }}>{l.type}</div>
            <div style={{ fontSize:'13px', lineHeight:1.7 }}>{l.text}</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'10px', color:'var(--muted)', marginTop:'10px' }}>{l.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
