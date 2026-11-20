
(() => {
"use strict";
const e=id=>document.getElementById(id),fmt=(n,d=2)=>Number(n).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}),currency=n=>fmt(n)+" USDT";
let chart=null,series=null,sma=null,volumeSeries=null,currentCandles=[],marketPending=null,chartPending=null,lastGrid=null;
let renderedChartKey=null, priceLines=[];
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

function currentGridLines() {
  if (marketKey() !== "spot:" + lastGrid?.symbol || !lastGrid.gridTriggers) return [];
  const { buy, reference, sell } = lastGrid.gridTriggers;
  return [
    { price: buy, title: "Achat", color: "#45dbb1" },
    { price: reference, title: "Référence", color: "#e8bf74" },
    { price: sell, title: "Vente", color: "#f47787" },
  ];
}

function drawGridLines() {
  const lines = currentGridLines();
  e("grid-levels").textContent = lines.map(line => line.title + " " + formatPrice(line.price)).join(" · ");
  if (renderedChartKey !== chartKey()) return;
  if (chart && series) {
    for (const line of priceLines) series.removePriceLine(line);
    priceLines = lines.map(line => series.createPriceLine({ ...line, lineWidth: 1, axisLabelVisible: true }));
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
    selectPair(e("symbol"), lastGrid?.reference ? lastGrid.symbol : e("gridSymbol").value || "BTCUSDT");
  }
  if (chartKey() !== before) refreshSelection();
  drawGridLines();
}

async function loadSymbols() {
  const market = e("market").value;
  try {
    const d = await api("/api/symbols?market=" + market);
    if (market !== e("market").value) return;
    if (!d.all.length) {
      e("diag").textContent = "Catalogue Aster indisponible : " + (d.error || "aucune paire");
      return;
    }
    const select = e("symbol");
    const selected = select.value;
    select.replaceChildren(...d.all.map(pair => new Option(pairLabel(pair.symbol), pair.symbol)));
    const followed = e("follow-grid").checked && market === "spot";
    selectPair(select, followed || d.all.some(pair => pair.symbol === selected) ? selected : select.options[0].value);
    if (market === "spot") {
      const grid = e("gridSymbol");
      const configured = lastGrid?.reference ? lastGrid.symbol : grid.value;
      grid.replaceChildren(...d.all.map(pair => new Option(pairLabel(pair.symbol), pair.symbol)));
      selectPair(grid, configured || "BTCUSDT");
    }
    syncChartToGrid();
    if (selected !== select.value) refreshSelection();
  } catch (err) {
    errorMessage(err, "diag");
  }
}

async function api(path,options){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);try{const r=await fetch(path,{...options,signal:ctl.signal,headers:{"accept":"application/json",...(options?.body?{"content-type":"application/json"}:{})},cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"HTTP "+r.status);return data}finally{clearTimeout(timer)}}
function errorMessage(err,target="grid-msg"){e(target).textContent="✕ "+err.message;e(target).style.color="#ff99a5"}
async function refreshState(){try{const s=await api("/api/state");lastGrid=s;const base=s.symbol.replace(/USDT$/,"");e("nav-assets").textContent="USDT + "+base+" valorisés";e("trade-quantity").textContent="Quantité ("+base+")";e("cloud-status").textContent=s.marketError?"● Prix indisponible":"● Serveur opérationnel";e("cloud-status").style.color=s.marketError?"#f3bb72":"#80e2c6";e("bot-state").textContent=s.running?"ACTIF 24 H/24":"ARRÊTÉ";e("bot-state").style.color=s.running?"#58deb9":"#b0c4dc";e("usdt").textContent=fmt(s.usdt);e("btc").textContent=fmt(s.btc,6);const assetLabel=e("base-asset-label");if(assetLabel)assetLabel.textContent=(s.symbol||"BTCUSDT").replace(/USDT$/,"")+" virtuel";e("reference").textContent=s.reference?formatPrice(s.reference):"—";e("step").textContent=fmt(s.stepPct,2)+" %";e("nav").textContent=currency(s.nav);const pnl=e("pnl");pnl.textContent=(s.pnl>=0?"+":"")+currency(s.pnl);pnl.className="stat "+(s.pnl>=0?"green":"red");e("start").disabled=s.running;e("start").textContent=s.reference?"▶ Reprendre la simulation":"▶ Démarrer la simulation";e("stop").disabled=!s.running;for(const key of ["capital","levels","rangePct","allocationPct","minOrder","maxOrder","feeBps"]){e(key).disabled=s.running;if(s.running||!!s.reference)e(key).value=s.config[key]}e("grid-msg").textContent=!s.running&&s.reference?"Simulation en pause. Clique sur Reprendre, ou Réinitialiser pour changer les paramètres.":s.running?"Simulation active sur le serveur Railway.":"Modifie les paramètres, puis clique sur Démarrer.";e("gridSymbol").disabled=s.running||!!s.reference;if(s.reference)selectPair(e("gridSymbol"),s.symbol);syncChartToGrid();e("trade-count").textContent=s.trades.length+" dernières opérations";e("trades").innerHTML=s.trades.length?s.trades.map(t=>'<tr><td>'+new Date(t.at).toLocaleString("fr-FR")+'</td><td class="'+(t.side==="BUY"?"green":"red")+'">'+(t.side==="BUY"?"ACHAT":"VENTE")+(t.seed?" initial":"")+'</td><td>'+formatPrice(t.price)+'</td><td>'+fmt(t.qty,7)+'</td><td>'+fmt(t.notional,2)+'</td><td>'+fmt(t.fee,3)+'</td></tr>').join(""):'<tr><td colspan="6" class="muted">Aucune transaction virtuelle.</td></tr>';}catch(err){e("cloud-status").textContent="● Serveur indisponible";errorMessage(err,"diag")}}
async function refreshMarket(){const key=marketKey();if(marketPending?.key===key)return;const request={key};marketPending=request;try{const [market,symbol]=key.split(":");const data=await api("/api/market?market="+market+"&symbol="+symbol);if(marketPending!==request||marketKey()!==key)return;e("price").textContent=formatPrice(data.price)+" USDT";e("price-market").textContent=pairLabel(symbol)+" · "+(market==="spot"?"Spot":"Perpétuel")+" · API Aster "+data.version;const ch=e("change");ch.textContent=(data.changePct>=0?"+":"")+fmt(data.changePct,2)+" %";ch.className="stat "+(data.changePct>=0?"green":"red");e("last-refresh").textContent=new Date(data.at).toLocaleTimeString("fr-FR")}catch(err){if(marketPending===request&&marketKey()===key)e("price-market").textContent=pairLabel(e("symbol").value)+" · "+err.message}finally{if(marketPending===request)marketPending=null}}
function fallback(data){const canvas=e("fallback");canvas.style.display="block";const root=e("chart");const dpr=window.devicePixelRatio||1,w=root.clientWidth,h=root.clientHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const pts=data.slice(-90);if(!pts.length)return;const lines=currentGridLines(),levels=lines.map(line=>line.price);const lo=Math.min(...pts.map(x=>x.low),...levels),hi=Math.max(...pts.map(x=>x.high),...levels);const X=i=>52+i*(w-65)/pts.length,Y=v=>20+(hi-v)/(hi-lo||1)*(h-60);for(let j=0;j<5;j++){const y=20+j*(h-60)/4;c.strokeStyle="#2b3a50";c.beginPath();c.moveTo(50,y);c.lineTo(w-8,y);c.stroke();c.fillStyle="#aabbd0";c.font="11px system-ui";c.textAlign="right";c.fillText(formatPrice(hi-(hi-lo)*j/4),46,y+3)}pts.forEach((p,i)=>{let x=X(i),up=p.close>=p.open;c.strokeStyle=up?"#4cddad":"#ef778a";c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(x,Y(p.high));c.lineTo(x,Y(p.low));c.stroke();const y1=Y(Math.max(p.open,p.close)),y2=Y(Math.min(p.open,p.close));c.fillRect(x-2,y1,4,Math.max(1,y2-y1))});for(const line of lines){const y=Y(line.price);c.strokeStyle=line.color;c.setLineDash([5,4]);c.beginPath();c.moveTo(50,y);c.lineTo(w-8,y);c.stroke();c.setLineDash([])}for(let i=0;i<4;i++){const idx=Math.floor(i*(pts.length-1)/3);c.fillStyle="#9aacc1";c.textAlign="center";c.fillText(new Date(pts[idx].time*1000).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}),X(idx),h-15)}}
async function refreshChart(){const key=chartKey();if(chartPending?.key===key)return;const request={key};chartPending=request;try{const [market,symbol,interval]=key.split(":");const d=await api("/api/candles?market="+market+"&symbol="+symbol+"&interval="+interval);if(chartPending!==request||chartKey()!==key)return;currentCandles=d.candles;renderedChartKey=key;if(!currentCandles.length)throw Error("Aucune bougie retournée");const lib=window.LightweightCharts;let advanced=false;try{if(lib){if(!chart){chart=lib.createChart(e("chart"),{autoSize:true,layout:{background:{type:"solid",color:"#101c2c"},textColor:"#a6bdd1"},grid:{vertLines:{color:"#223247"},horzLines:{color:"#223247"}},timeScale:{timeVisible:true,secondsVisible:false,borderColor:"#33506a"},rightPriceScale:{borderColor:"#33506a"}});series=chart.addSeries(lib.CandlestickSeries,{upColor:"#45dbb1",downColor:"#f47787",wickUpColor:"#45dbb1",wickDownColor:"#f47787",borderVisible:false});sma=chart.addSeries(lib.LineSeries,{color:"#e8bf74",lineWidth:2,priceLineVisible:false,lastValueVisible:false});volumeSeries=chart.addSeries(lib.HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"",lastValueVisible:false,priceLineVisible:false});volumeSeries.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}})}const precision=pricePrecision(currentCandles.at(-1).close);series.applyOptions({priceFormat:{type:"price",precision,minMove:10**-precision},autoscaleInfoProvider:original=>{const info=original();const levels=currentGridLines().map(line=>line.price);if(info?.priceRange&&levels.length){info.priceRange.minValue=Math.min(info.priceRange.minValue,...levels);info.priceRange.maxValue=Math.max(info.priceRange.maxValue,...levels)}return info}});series.setData(currentCandles.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close})));volumeSeries.setData(currentCandles.map(x=>({time:x.time,value:x.volume,color:x.close>=x.open?"#245f55":"#6c3b4b"})));sma.setData(currentCandles.slice(19).map((x,i)=>({time:x.time,value:currentCandles.slice(i,i+20).reduce((sum,p)=>sum+p.close,0)/20})));chart.timeScale().fitContent();advanced=true;e("fallback").style.display="none"}}catch{chart?.remove();chart=null}
drawGridLines();e("chart-info").textContent=currentCandles.length+" bougies réelles · "+pairLabel(symbol)+" · "+(market==="spot"?"Spot":"Perpétuel")+" · "+interval+" · "+d.version+" · "+new Date().toLocaleTimeString("fr-FR")+(advanced?"":" · graphique de secours")}catch(err){if(chartPending===request&&chartKey()===key)errorMessage(err,"chart-info")}finally{if(chartPending===request)chartPending=null}}
async function command(which){const b=e(which);b.disabled=true;e("grid-msg").style.color="#9baec2";e("grid-msg").textContent="Exécution côté serveur…";try{if(which==="reset"&&!confirm("Réinitialiser la simulation et effacer son historique virtuel ?"))return;const body=which==="start"?JSON.stringify({resume:!!lastGrid?.reference,...Object.fromEntries(["capital","levels","rangePct","allocationPct","minOrder","maxOrder","feeBps"].map(k=>[k,Number(e(k).value)])),symbol:e("gridSymbol").value,market:"spot",mode:"paper"}):"{}";await api("/api/grid/"+which,{method:"POST",body});e("grid-msg").textContent=which==="start"?"Simulation active sur Railway, indépendante de ce navigateur.":which==="stop"?"Robot virtuel arrêté.":"Simulation réinitialisée.";await refreshState()}catch(err){errorMessage(err)}finally{b.disabled=which==="start"?!!lastGrid?.running:which==="stop"?!lastGrid?.running:false}}
e("start").onclick=()=>command("start");e("stop").onclick=()=>command("stop");e("reset").onclick=()=>command("reset");e("refresh").onclick=()=>Promise.all([refreshMarket(),refreshState(),refreshChart()]);
e("market").onchange=()=>{e("follow-grid").checked=false;refreshSelection();drawGridLines();void loadSymbols()};
e("symbol").onchange=()=>{e("follow-grid").checked=false;refreshSelection();drawGridLines()};
e("interval").onchange=refreshSelection;
e("gridSymbol").onchange=syncChartToGrid;
e("follow-grid").onchange=()=>{const market=e("market").value;syncChartToGrid();if(market!==e("market").value)void loadSymbols()};

window.addEventListener("error",ev=>{const box=e("api-message");if(box)box.textContent="Erreur JavaScript : "+String(ev.message||"inconnue")});
window.addEventListener("unhandledrejection",ev=>{const box=e("api-message");if(box)box.textContent="Erreur de chargement : "+String(ev.reason?.message||ev.reason||"inconnue")});
void refreshState();
void refreshMarket();
void refreshChart();
void loadSymbols().catch(() => {});setInterval(()=>{if(!document.hidden){refreshState();refreshMarket()}},10000);setInterval(()=>{if(!document.hidden)refreshChart()},30000);
})();
