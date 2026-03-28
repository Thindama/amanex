
export const MARKETS = [
  {name:'EZB senkt Zinsen April',plat:'Kalshi',pc:'b-blue',mkt:'62%',ai:'69%',aiPos:true,edge:'+7.2%',ePct:72,vol:'5.400',exp:'12 Tage',status:'TRADE',sc:'b-green'},
  {name:'BTC ueber 95k April',plat:'Polymarket',pc:'b-yellow',mkt:'41%',ai:'47%',aiPos:true,edge:'+6.1%',ePct:61,vol:'12.200',exp:'4 Tage',status:'TRADE',sc:'b-green'},
  {name:'US Arbeitslosigkeit unter 4%',plat:'Kalshi',pc:'b-blue',mkt:'58%',ai:'64%',aiPos:true,edge:'+5.8%',ePct:58,vol:'3.800',exp:'18 Tage',status:'TRADE',sc:'b-green'},
  {name:'Fed senkt Zinsen Mai',plat:'Kalshi',pc:'b-blue',mkt:'33%',ai:'38%',aiPos:true,edge:'+5.1%',ePct:51,vol:'8.100',exp:'29 Tage',status:'TRADE',sc:'b-green'},
  {name:'Apple Q2 Erwartungen',plat:'Polymarket',pc:'b-yellow',mkt:'73%',ai:'76%',aiPos:false,edge:'+3.1%',ePct:30,vol:'6.500',exp:'22 Tage',status:'WATCH',sc:'b-yellow'},
  {name:'EUR/USD ueber 1.10',plat:'Polymarket',pc:'b-yellow',mkt:'48%',ai:'50%',aiPos:false,edge:'+2.1%',ePct:20,vol:'2.200',exp:'25 Tage',status:'SKIP',sc:'b-red'},
];

export const TRADES = [
  {date:'28.03 07:29',name:'EZB senkt Zinsen April',plat:'Kalshi',pc:'b-blue',side:'JA',stake:'312',fc:'69%',won:true,pnl:'124'},
  {date:'28.03 07:14',name:'BTC ueber 95k',plat:'Polymarket',pc:'b-yellow',side:'NEIN',stake:'218',fc:'53%',won:true,pnl:'87'},
  {date:'28.03 06:51',name:'Fed haelt Zinsen stabil',plat:'Kalshi',pc:'b-blue',side:'JA',stake:'180',fc:'66%',won:false,pnl:'43'},
  {date:'28.03 05:22',name:'Apple Q2 Erwartungen',plat:'Polymarket',pc:'b-yellow',side:'JA',stake:'402',fc:'74%',won:true,pnl:'201'},
  {date:'27.03 22:10',name:'US Arbeitslosigkeit',plat:'Kalshi',pc:'b-blue',side:'JA',stake:'290',fc:'64%',won:true,pnl:'158'},
  {date:'27.03 19:45',name:'EUR/USD ueber 1.10',plat:'Polymarket',pc:'b-yellow',side:'NEIN',stake:'150',fc:'58%',won:false,pnl:'67'},
];

export const PNL_DATA = [120,-40,210,180,-80,310,90,250,-30,190,280,150,340,87];
export const PERF_DATA = [200,480,310,720,550,900,1100,800,1300,1600,1200,1900,2400,3100,4120];
export const PERF_MONTHS = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez','Jan','Feb','Mrz'];

export const NOTIFS = [
  {id:1,icon:'checkmark',type:'ni-green',text:'Trade ausgefuehrt: EZB Zinsen JA +124 EUR',time:'vor 8 Min.',unread:true},
  {id:2,icon:'alert',type:'ni-red',text:'Trade verloren: Fed Zinsen -43 EUR',time:'vor 1 Std.',unread:true},
  {id:3,icon:'warning',type:'ni-yellow',text:'Exposure bei 75% - nah am Limit',time:'vor 2 Std.',unread:true},
  {id:4,icon:'scan',type:'ni-blue',text:'Scanner: 312 Maerkte, 8 Chancen',time:'vor 4 Min.',unread:false},
];
