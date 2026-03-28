const DEMO_LESSONS = [
  {type:'b-red',label:'Schlechte Prognose',text:'Krypto-Maerkte reagieren staerker auf Social-Media-Sentiment. Grok-Gewichtung erhoehen.',meta:'28.03.2026 - Trade: BTC ueber 90k - Verlust: -43 EUR'},
  {type:'b-yellow',label:'Schlechtes Timing',text:'EZB-Entscheidungen sollten fruehestens 48h vor dem Termin gehandelt werden.',meta:'25.03.2026 - Trade: EZB Zinsen Maerz - Verlust: -67 EUR'},
  {type:'b-blue',label:'Externer Schock',text:'Unerwartete Zentralbank-Aussagen koennen Maerkte in Minuten um 20%+ verschieben.',meta:'20.03.2026 - Trade: Fed Statement - Verlust: -112 EUR'},
  {type:'b-red',label:'Schlechte Prognose',text:'Reddit-Sentiment fuer Earnings ist weniger verlasslich als Twitter/X.',meta:'15.03.2026 - Trade: NVIDIA Q4 - Verlust: -88 EUR'},
];

const TYPE_MAP = {
  bad_prediction: { label: 'Schlechte Prognose', badge: 'b-red' },
  bad_timing:     { label: 'Schlechtes Timing',  badge: 'b-yellow' },
  external_shock: { label: 'Externer Schock',    badge: 'b-blue' },
  execution:      { label: 'Ausfuehrungsfehler', badge: 'b-red' },
};

export default function Knowledge({ data }) {
  const lessons = (data && data.length > 0) ? data : null;

  const normalize = (l) => {
    if (l.failure_type) {
      const type = TYPE_MAP[l.failure_type] || { label: l.failure_type, badge: 'b-blue' };
      return {
        type:  type.badge,
        label: type.label,
        text:  l.lesson,
        meta:  new Date(l.created_at).toLocaleDateString('de-DE') + ' - Verlust: ' + Math.round(l.pnl || 0) + ' EUR',
      };
    }
    return l;
  };

  const items = lessons ? lessons.map(normalize) : DEMO_LESSONS;
  const counts = { bad_prediction: 0, bad_timing: 0, external_shock: 0 };
  if (lessons) lessons.forEach(l => { if (counts[l.failure_type] !== undefined) counts[l.failure_type]++; });

  return (
    <div className="page-scroll">
      <div className="row-4">
        <div className="mcard"><div className="mlabel">Lektionen gesamt</div><div className="mval c-blue">{items.length}</div><div className="msub c-muted">90 Tage</div></div>
        <div className="mcard"><div className="mlabel">Schlechte Prognose</div><div className="mval c-red">{lessons ? counts.bad_prediction : 18}</div><div className="msub c-red">38%</div></div>
        <div className="mcard"><div className="mlabel">Schlechtes Timing</div><div className="mval c-yellow">{lessons ? counts.bad_timing : 14}</div><div className="msub c-yellow">30%</div></div>
        <div className="mcard"><div className="mlabel">Externer Schock</div><div className="mval c-muted">{lessons ? counts.external_shock : 15}</div><div className="msub c-muted">32%</div></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Bot-Lernprotokoll</div><div className="badge b-blue">{items.length} Eintraege</div></div>
        {items.map((l,i) => (
          <div className="learn-item" key={i}>
            <div className={`badge ${l.type}`} style={{marginBottom:'8px',display:'inline-block'}}>{l.label}</div>
            <div style={{fontSize:'12px',lineHeight:1.6}}>{l.text}</div>
            <div style={{fontSize:'10px',color:'var(--muted)',marginTop:'6px',fontFamily:'JetBrains Mono,monospace'}}>{l.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
