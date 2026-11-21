
(() => {
"use strict";
const e=id=>document.getElementById(id),fmt=(n,d=2)=>Number(n).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}),currency=n=>fmt(n)+" USDT";
let chart=null,series=null,averages=[],macdSeries=[],volumeSeries=null,currentCandles=[],marketPending=null,chartPending=null,lastGrid=null;
let renderedChartKey=null, priceLines=[];
let draftDirty=false, previewLines=[], previewKey=null, pendingAutoFill=null;
const priceKeys=["lowerPrice","upperPrice"];
const configKeys=["capital","levels","rangePct","allocationPct","minOrder","maxOrder","feeBps","lowerPrice","upperPrice"];
const pairLabel = symbol => symbol.replace(/USDT$/, "/USDT");
const pricePrecision = price => Math.min(10, Math.max(2, 4 - Math.floor(Math.log10(Math.abs(price) || 1))));
const formatPrice = price => fmt(price, pricePrecision(price));
const marketKey = () => e("market").value + ":" + e("symbol").value;
const chartKey = () => marketKey() + ":" + e("interval").value;

function selectPair(select, symbol) {
  if (!Array.from(select.options).some(option => option.value === symbol)) {
    select.add(new Option(pairLabel(symbol), symbol));
  }
  select.value = symbol;
}

function draftConfig() {
  return Object.fromEntries(configKeys.map(key => {
    const value=String(e(key).value).trim();
    if (!priceKeys.includes(key)) return [key,value===""?NaN:Number(value)];
    const decimal=/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
    return [key,value===""?null:decimal.test(value)?Number(value.replace(",",".")):NaN];
  }));
}

function loadGridConfig(state) {
  for (const key of configKeys) e(key).value=state.config[key]??"";
  selectPair(e("gridSymbol"),state.symbol);
}

function renderPreview() {
  const engine=window.PaperGrid;
  if (!engine) return;
  const config=draftConfig(), symbol=e("gridSymbol").value;
  const matches=marketKey()==="spot:"+symbol && renderedChartKey===chartKey();
  const candles=matches ? currentCandles.slice(0,-1).filter(c=>Number.isFinite(c.close)&&c.close>0) : [];
  const valid=engine.valid(config);
  const hasBounds=config.lowerPrice!=null||config.upperPrice!=null;
  e("rangePct").disabled=hasBounds;
  e("fill-range").disabled=matches&&!candles.length;
  e("fill-range").textContent=matches?"Remplir auto":"Remplir depuis le Spot";
  e("restore-grid").hidden=!draftDirty||!lastGrid?.reference;
  e("preview-title").textContent="Aperçu · "+pairLabel(symbol);
  e("preview-budget").textContent=valid ? "Capital "+currency(config.capital)+" · "+currency(engine.budget({config}))+" par ordre" : "";
  if (!matches || previewKey!==renderedChartKey) previewLines=[];
  const geometryValid=engine.validGeometry(config);
  const anchor=candles.at(-1)?.close;
  if (geometryValid && anchor) {
    previewKey=renderedChartKey;
    if (config.lowerPrice!=null) {
      const distance=(config.upperPrice-config.lowerPrice)/config.levels;
      previewLines=Array.from({length:config.levels+1},(_,index)=>({
        price:index===config.levels?config.upperPrice:config.lowerPrice+distance*index,
        title:index===0?"Prix bas":index===config.levels?"Prix haut":"",
        color:(config.lowerPrice+distance*index)<anchor?"#45dbb1":"#f47787",
      }));
    } else {
      const {buy,reference,sell}=engine.triggers({config,reference:anchor});
      previewLines=[
        {price:buy,title:"Achat simulé",color:"#45dbb1"},
        {price:reference,title:"Référence simulée",color:"#e8bf74"},
        {price:sell,title:"Vente simulée",color:"#f47787"},
      ];
    }
  }
  if (valid && anchor) {
    const buy=config.lowerPrice==null ? engine.triggers({config,reference:anchor}).buy : config.lowerPrice;
    const next=config.lowerPrice==null ? anchor : buy+(config.upperPrice-buy)/config.levels;
    const feeRate=config.feeBps/10000;
    const cycle=engine.budget({config})*((next/buy)*(1-feeRate)-1-feeRate);
    e("preview-budget").textContent+=" · Achat-revente théorique "+(cycle>0?"+":"")+currency(cycle);
    const result=engine.replay(symbol,config,candles);
    const sign=result.pnl>0?"+":"";
    e("preview-result").textContent=sign+currency(result.pnl)+" ("+sign+fmt(100*result.pnl/config.capital)+" %) · "+result.orders+" ordres · Frais "+currency(result.fees);
  } else {
    const amount=engine.budget({config});
    let message="Vérifie le capital et les options avancées.";
    if (!geometryValid) {
      if (hasBounds && !(config.lowerPrice>0 && config.upperPrice>config.lowerPrice)) {
        message="Saisis deux prix positifs, avec un prix haut supérieur au prix bas.";
      } else if (!Number.isInteger(config.levels)||config.levels<2||config.levels>30) {
        message="Saisis un nombre entier de grilles entre 2 et 30.";
      } else {
        message="Vérifie l’amplitude dans les options avancées.";
      }
      if (previewLines.length) message+=" Dernier tracé conservé.";
    }
    else if (valid) message="Affiche la paire Spot du robot pour obtenir la simulation.";
    else if (amount<config.minOrder) {
      const required=Math.ceil(config.minOrder*config.levels*100/config.allocationPct);
      message=currency(amount)+" par ordre, minimum "+currency(config.minOrder)+". Capital requis : "+currency(required)+".";
    }
    e("preview-result").textContent=message;
  }
  const period=candles.length ? candles.length+" clôtures de "+e("interval").value+" · " : "";
  const outside=anchor&&geometryValid&&hasBounds&&(anchor<config.lowerPrice||anchor>config.upperPrice);
  e("preview-note").textContent=(outside?"Dernière clôture hors de la fourchette. ":"")+period+"Simulation historique aux clôtures, frais inclus. "+(lastGrid?.reference&&draftDirty?"Aperçu des nouveaux réglages. Réinitialise puis démarre pour les appliquer.":"");
}

function editDraft() {
  draftDirty=true;
  syncChartToGrid();
}

function currentGridLines() {
  if ((draftDirty||!lastGrid?.reference) && marketKey()==="spot:"+e("gridSymbol").value) return previewLines;
  if (marketKey() !== "spot:" + lastGrid?.symbol || !lastGrid.gridTriggers) return [];
  const { buy, reference, sell } = lastGrid.gridTriggers;
  return [
    { price: buy, title: "Achat", color: "#45dbb1" },
    { price: reference, title: "Référence", color: "#e8bf74" },
    { price: sell, title: "Vente", color: "#f47787" },
  ].filter(line=>line.price!=null);
}

function chartScale(original) {
  const info=original();
  if (!e("fit-grid").checked || !info?.priceRange) return info;
  const prices=currentGridLines().map(line=>line.price);
  return {...info,priceRange:{
    minValue:Math.min(info.priceRange.minValue,...prices),
    maxValue:Math.max(info.priceRange.maxValue,...prices),
  }};
}

function drawGridLines() {
  renderPreview();
  const lines = currentGridLines();
  e("grid-levels").textContent = lines.filter(line=>line.title).map(line => line.title + " " + formatPrice(line.price)).join(" · ");
  if (renderedChartKey !== chartKey()) return;
  if (chart && series) {
    for (const line of priceLines) series.removePriceLine(line);
    priceLines = lines.map(line => series.createPriceLine({ ...line, lineWidth: 1, lineStyle: 1, axisLabelVisible: !!line.title }));
  } else if (currentCandles.length) {
    fallback(currentCandles);
  }
}

function refreshSelection() {
  if (renderedChartKey !== chartKey()) {
    if (chart) chart.remove();
    chart = null;
    priceLines = [];
    renderedChartKey = null;
    currentCandles = [];
    e("fallback").style.display = "none";
    e("chart-info").textContent = "Chargement de " + pairLabel(e("symbol").value) + "…";
    e("price").textContent = "—";
    e("change").textContent = "—";
    e("price-market").textContent = pairLabel(e("symbol").value);
  }
  void refreshMarket();
  void refreshChart();
}

function syncChartToGrid() {
  const before = chartKey();
  if (e("follow-grid").checked) {
    e("market").value = "spot";
    selectPair(e("symbol"), lastGrid?.reference && !draftDirty ? lastGrid.symbol : e("gridSymbol").value || "BTCUSDT");
  }
  if (chartKey() !== before) refreshSelection();
  drawGridLines();
}

const priorityPairs = ["BTCUSDT", "ASTERUSDT", "HYPEUSDT", "ETHUSDT", "LTCUSDT"];

function marketOptions(pairs) {
  const rank = symbol => {
    const index = priorityPairs.indexOf(symbol);
    return index === -1 ? priorityPairs.length : index;
  };
  return [...pairs].sort((a, b) => rank(a.symbol) - rank(b.symbol))
    .map(pair => new Option(pairLabel(pair.symbol), pair.symbol));
}

async function loadSymbols(market = e("market").value) {
  try {
    const d = await api("/api/symbols?market=" + market);
    if (market !== "spot" && market !== e("market").value) return;
    if (!d.all.length) {
      e("diag").textContent = "Catalogue Aster indisponible : " + (d.error || "aucune paire");
      return;
    }
    if (market === "spot") {
      const grid = e("gridSymbol");
      const configured = lastGrid?.reference && !draftDirty ? lastGrid.symbol : grid.value;
      grid.replaceChildren(...marketOptions(d.all));
      selectPair(grid, configured || "BTCUSDT");
    }
    if (market !== e("market").value) return;
    const select = e("symbol");
    const selected = select.value;
    select.replaceChildren(...marketOptions(d.all));
    const followed = e("follow-grid").checked && market === "spot";
    selectPair(select, followed || d.all.some(pair => pair.symbol === selected) ? selected : select.options[0].value);
    syncChartToGrid();
    if (selected !== select.value) refreshSelection();
  } catch (err) {
    errorMessage(err, "diag");
  }
}

async function api(path,options){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);try{const r=await fetch(path,{...options,signal:ctl.signal,headers:{"accept":"application/json",...(options?.body?{"content-type":"application/json"}:{})},cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"HTTP "+r.status);return data}finally{clearTimeout(timer)}}
function errorMessage(err,target="grid-msg"){e(target).textContent="✕ "+err.message;e(target).style.color="#ff99a5"}
async function refreshState(){try{const s=await api("/api/state");lastGrid=s;const base=s.symbol.replace(/USDT$/,"");e("nav-assets").textContent="USDT + "+base+" valorisés";e("trade-quantity").textContent="Quantité ("+base+")";e("cloud-status").textContent=s.marketError?"● Prix indisponible":"● Serveur opérationnel";e("cloud-status").style.color=s.marketError?"#f3bb72":"#80e2c6";e("bot-state").textContent=s.running?"ACTIF 24 H/24":"ARRÊTÉ";e("bot-state").style.color=s.running?"#58deb9":"#b0c4dc";e("usdt").textContent=fmt(s.usdt);e("btc").textContent=fmt(s.btc,6);const assetLabel=e("base-asset-label");if(assetLabel)assetLabel.textContent=(s.symbol||"BTCUSDT").replace(/USDT$/,"")+" virtuel";e("reference").textContent=s.reference?formatPrice(s.reference):"—";e("step").textContent=s.config?.lowerPrice!=null?formatPrice((s.config.upperPrice-s.config.lowerPrice)/s.config.levels)+" USDT":fmt(s.stepPct,2)+" %";e("nav").textContent=currency(s.nav);const pnl=e("pnl");pnl.textContent=(s.pnl>=0?"+":"")+currency(s.pnl);pnl.className="stat "+(s.pnl>=0?"green":"red");e("reset").textContent=s.reference?"↺ Réinitialiser la simulation":"↺ Réinitialiser les réglages";e("start").disabled=s.running;e("start").textContent=s.reference?"▶ Reprendre la simulation":"▶ Démarrer la simulation";e("stop").disabled=!s.running;if(s.reference&&!draftDirty)loadGridConfig(s);e("grid-msg").textContent=!s.running&&s.reference?"Simulation en pause. Clique sur Reprendre, ou Réinitialiser pour appliquer de nouveaux réglages.":s.running?"Simulation active sur le serveur Railway.":"Modifie les paramètres, puis clique sur Démarrer.";syncChartToGrid();e("trade-count").textContent=s.trades.length+" dernières opérations";e("trades").innerHTML=s.trades.length?s.trades.map(t=>'<tr><td>'+new Date(t.at).toLocaleString("fr-FR")+'</td><td class="'+(t.side==="BUY"?"green":"red")+'">'+(t.side==="BUY"?"ACHAT":"VENTE")+(t.seed?" initial":"")+'</td><td>'+formatPrice(t.price)+'</td><td>'+fmt(t.qty,7)+'</td><td>'+fmt(t.notional,2)+'</td><td>'+fmt(t.fee,3)+'</td></tr>').join(""):'<tr><td colspan="6" class="muted">Aucune transaction virtuelle.</td></tr>';}catch(err){e("cloud-status").textContent="● Serveur indisponible";errorMessage(err,"diag")}}
async function refreshMarket(){const key=marketKey();if(marketPending?.key===key)return;const request={key};marketPending=request;try{const [market,symbol]=key.split(":");const data=await api("/api/market?market="+market+"&symbol="+symbol);if(marketPending!==request||marketKey()!==key)return;e("price").textContent=formatPrice(data.price)+" USDT";e("price-market").textContent=pairLabel(symbol)+" · "+(market==="spot"?"Spot":"Perpétuel")+" · API Aster "+data.version;const ch=e("change");ch.textContent=(data.changePct>=0?"+":"")+fmt(data.changePct,2)+" %";ch.className="stat "+(data.changePct>=0?"green":"red");e("last-refresh").textContent=new Date(data.at).toLocaleTimeString("fr-FR")}catch(err){if(marketPending===request&&marketKey()===key)e("price-market").textContent=pairLabel(e("symbol").value)+" · "+err.message}finally{if(marketPending===request)marketPending=null}}
function fallback(data){const canvas=e("fallback");canvas.style.display="block";const root=e("chart");const dpr=window.devicePixelRatio||1,w=root.clientWidth,h=root.clientHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const pts=data.slice(-90);if(!pts.length)return;const lines=currentGridLines(),levels=e("fit-grid").checked?lines.map(line=>line.price):[];const lo=Math.min(...pts.map(x=>x.low),...levels),hi=Math.max(...pts.map(x=>x.high),...levels);const X=i=>52+i*(w-65)/pts.length,Y=v=>20+(hi-v)/(hi-lo||1)*(h-60);for(let j=0;j<5;j++){const y=20+j*(h-60)/4;c.strokeStyle="#2b3a50";c.beginPath();c.moveTo(50,y);c.lineTo(w-8,y);c.stroke();c.fillStyle="#aabbd0";c.font="11px system-ui";c.textAlign="right";c.fillText(formatPrice(hi-(hi-lo)*j/4),46,y+3)}pts.forEach((p,i)=>{let x=X(i),up=p.close>=p.open;c.strokeStyle=up?"#4cddad":"#ef778a";c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(x,Y(p.high));c.lineTo(x,Y(p.low));c.stroke();const y1=Y(Math.max(p.open,p.close)),y2=Y(Math.min(p.open,p.close));c.fillRect(x-2,y1,4,Math.max(1,y2-y1))});for(const line of lines){if(line.price<lo||line.price>hi)continue;const y=Y(line.price);c.strokeStyle=line.color;c.setLineDash([5,4]);c.beginPath();c.moveTo(50,y);c.lineTo(w-8,y);c.stroke();c.setLineDash([])}for(let i=0;i<4;i++){const idx=Math.floor(i*(pts.length-1)/3);c.fillStyle="#9aacc1";c.textAlign="center";c.fillText(new Date(pts[idx].time*1000).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}),X(idx),h-15)}}
function macdData(candles) {
  let fast=candles[0].close, slow=fast, signal=0;
  return candles.map(({time,close})=>{
    fast+=(close-fast)*2/13;
    slow+=(close-slow)*2/27;
    const macd=fast-slow;
    signal+=(macd-signal)*2/10;
    return {time,macd,signal,histogram:macd-signal};
  }).slice(33);
}
async function refreshChart(){const key=chartKey();if(chartPending?.key===key)return;const request={key};chartPending=request;try{const [market,symbol,interval]=key.split(":");const d=await api("/api/candles?market="+market+"&symbol="+symbol+"&interval="+interval);if(chartPending!==request||chartKey()!==key)return;const firstView=renderedChartKey!==key||!chart;currentCandles=d.candles;renderedChartKey=key;if(!currentCandles.length)throw Error("Aucune bougie retournée");const lib=window.LightweightCharts;let advanced=false;try{if(lib){if(!chart){chart=lib.createChart(e("chart"),{autoSize:true,layout:{background:{type:"solid",color:"#14161a"},textColor:"#a6bdd1"},grid:{vertLines:{color:"#252932"},horzLines:{color:"#252932"}},timeScale:{timeVisible:true,secondsVisible:false,borderColor:"#33506a"},rightPriceScale:{borderColor:"#33506a"}});series=chart.addSeries(lib.CandlestickSeries,{upColor:"#45dbb1",downColor:"#f47787",wickUpColor:"#45dbb1",wickDownColor:"#f47787",borderVisible:false});averages=[[7,"#a78bfa"],[30,"#f4ca59"],[99,"#54a9ff"]].map(([period,color])=>({period,line:chart.addSeries(lib.LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false})}));macdSeries=[[lib.HistogramSeries,"histogram","#64748b"],[lib.LineSeries,"macd","#54a9ff"],[lib.LineSeries,"signal","#f4ca59"]].map(([type,key,color])=>({key,line:chart.addSeries(type,{color,priceLineVisible:false,lastValueVisible:false},1)}));volumeSeries=chart.addSeries(lib.HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"",lastValueVisible:false,priceLineVisible:false});volumeSeries.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}})}const precision=pricePrecision(currentCandles.at(-1).close);series.applyOptions({priceFormat:{type:"price",precision,minMove:10**-precision},autoscaleInfoProvider:chartScale});series.setData(currentCandles.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close})));volumeSeries.setData(currentCandles.map(x=>({time:x.time,value:x.volume,color:x.close>=x.open?"#245f55":"#6c3b4b"})));for(const {period,line} of averages)line.setData(currentCandles.slice(period-1).map(({time},index)=>({time,value:currentCandles.slice(index,index+period).reduce((sum,candle)=>sum+candle.close,0)/period})));const momentum=macdData(currentCandles);for(const {key,line} of macdSeries)line.setData(momentum.map(point=>({time:point.time,value:point[key]})));if(firstView)chart.timeScale().fitContent();advanced=true;e("fallback").style.display="none"}}catch{chart?.remove();chart=null}
if(pendingAutoFill===key){pendingAutoFill=null;fillRecentRange()}drawGridLines();e("chart-info").textContent=currentCandles.length+" bougies réelles · "+pairLabel(symbol)+" · "+(market==="spot"?"Spot":"Perpétuel")+" · "+interval+" · "+d.version+" · "+new Date().toLocaleTimeString("fr-FR")+(advanced?"":" · graphique de secours")}catch(err){if(chartPending===request&&chartKey()===key)errorMessage(err,"chart-info")}finally{if(chartPending===request)chartPending=null}}
async function command(which){if(which==="reset"&&lastGrid&&!lastGrid.reference){
  draftDirty=false;
  pendingAutoFill=null;
  previewLines=[];
  for(const key of configKeys)e(key).value=e(key).defaultValue;
  syncChartToGrid();
  e("grid-msg").textContent="Réglages réinitialisés.";
  return;
}const b=e(which);b.disabled=true;e("grid-msg").style.color="#9baec2";e("grid-msg").textContent="Exécution côté serveur…";try{if(which==="reset"&&!confirm("Réinitialiser la simulation et effacer son historique virtuel ?"))return;const body=which==="start"?JSON.stringify({resume:!!lastGrid?.reference,...(lastGrid?.reference?lastGrid.config:draftConfig()),symbol:lastGrid?.reference?lastGrid.symbol:e("gridSymbol").value,market:"spot",mode:"paper"}):"{}";if(which==="start"&&!lastGrid?.reference&&!window.PaperGrid?.valid(draftConfig()))throw Error("Vérifie les paramètres de la grille avant de démarrer.");await api("/api/grid/"+which,{method:"POST",body});if(which==="start"&&!lastGrid?.reference)draftDirty=false;e("grid-msg").textContent=which==="start"?"Simulation active sur Railway, indépendante de ce navigateur.":which==="stop"?"Robot virtuel arrêté.":"Simulation réinitialisée.";await refreshState()}catch(err){errorMessage(err)}finally{b.disabled=which==="start"?!!lastGrid?.running:which==="stop"?!lastGrid?.running:false}}
e("start").onclick=()=>command("start");e("stop").onclick=()=>command("stop");e("reset").onclick=()=>command("reset");e("refresh").onclick=()=>Promise.all([refreshMarket(),refreshState(),refreshChart()]);
e("market").onchange=()=>{pendingAutoFill=null;e("follow-grid").checked=false;refreshSelection();drawGridLines();void loadSymbols()};
e("symbol").onchange=()=>{pendingAutoFill=null;e("follow-grid").checked=false;refreshSelection();drawGridLines()};
e("interval").onchange=()=>{pendingAutoFill=null;refreshSelection()};
e("gridSymbol").onchange=()=>{
  pendingAutoFill=null;
  for(const key of priceKeys)e(key).value="";
  e("fit-grid").checked=false;
  e("follow-grid").checked=true;
  editDraft();
};
for (const key of configKeys) e(key).oninput=()=>{
  if(priceKeys.includes(key)&&e("fit-grid").checked){
    e("fit-grid").checked=false;
    if(chart)series.applyOptions({autoscaleInfoProvider:chartScale});
  }
  editDraft();
};
e("restore-grid").onclick=()=>{draftDirty=false;loadGridConfig(lastGrid);syncChartToGrid()};
function fillRecentRange() {
  const recent=currentCandles.slice(-31,-1);
  if (!recent.length) return;
  e("lowerPrice").value=Math.min(...recent.map(c=>c.low));
  e("upperPrice").value=Math.max(...recent.map(c=>c.high));
  editDraft();
}
e("fill-range").onclick=()=>{
  const spotKey="spot:"+e("gridSymbol").value+":"+e("interval").value;
  if (renderedChartKey===spotKey && chartKey()===spotKey) return fillRecentRange();
  pendingAutoFill=spotKey;
  draftDirty=true;
  e("follow-grid").checked=true;
  syncChartToGrid();
  void refreshChart();
};
e("fit-grid").onchange=()=>{
  if(chart)series.applyOptions({autoscaleInfoProvider:chartScale});
  drawGridLines();
};
e("follow-grid").onchange=()=>{const market=e("market").value;syncChartToGrid();if(market!==e("market").value)void loadSymbols()};

window.addEventListener("error",ev=>{const box=e("api-message");if(box)box.textContent="Erreur JavaScript : "+String(ev.message||"inconnue")});
window.addEventListener("unhandledrejection",ev=>{const box=e("api-message");if(box)box.textContent="Erreur de chargement : "+String(ev.reason?.message||ev.reason||"inconnue")});
void refreshState();
void refreshMarket();
void refreshChart();
void loadSymbols();if(e("market").value!=="spot")void loadSymbols("spot");setInterval(()=>{if(!document.hidden){refreshState();refreshMarket()}},10000);setInterval(()=>{if(!document.hidden)refreshChart()},30000);
})();
