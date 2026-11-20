const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const grid = require("../paper-grid");
test("the dashboard follows the paper grid pair and displays the engine thresholds", async () => {
  const config = { capital:100, levels:4, rangePct:6, allocationPct:60, minOrder:10, maxOrder:25, feeBps:10 };
  const state = grid.initialize("ASTERUSDT", config, 0.5037);
  const before = grid.triggers(state);
  assert.equal(before.buy, 0.5037 * 0.985);
  assert.equal(before.sell, 0.5037 * 1.015);
  assert.equal(grid.step(state, before.buy), "BUY");
  assert.equal(grid.triggers(state).reference, before.buy);
  const ids = [...fs.readFileSync(path.join(__dirname, "..", "dashboard.html"), "utf8").matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const beats = [];
  const elements = Object.fromEntries(ids.map(id => [id, {
    style:{}, value:"", options:[], clientWidth:800, clientHeight:300,
    add(option){this.options.push(option)},
    replaceChildren(...options){this.options=options},
    getContext(){return new Proxy({}, {get:(_, key)=>()=>{if(key==="setLineDash")beats.push(key)}})}
  }]));
  elements.market.value="spot"; elements.symbol.value="BTCUSDT";
  elements.gridSymbol.value="BTCUSDT";elements.interval.value="5m";elements["follow-grid"].checked=true;
  let resolveBtc;
  const btc = new Promise(resolve=>{resolveBtc=resolve});
  const requests=[];
  function reply(payload){return {ok:true,json:async()=>payload}}
  const response = {...state,gridTriggers:grid.triggers(state),stepPct:1.5,nav:grid.nav(state),pnl:grid.nav(state)-100,price:state.lastPrice};
  const list = [{symbol:"BTCUSDT"},{symbol:"ASTERUSDT"}];
  const candle = {time:1700000000,open:.49,close:.50,low:.48,high:.51,volume:1};
  vm.runInNewContext(fs.readFileSync("dashboard.js","utf8"),{
    document:{getElementById:id=>elements[id]},window:{addEventListener(){}},
    Option:class{constructor(text,value){Object.assign(this,{text,value})}},
    AbortController,setTimeout:()=>0,clearTimeout(){},setInterval(){},fetch:async url=>{
      requests.push(url);
      if(url==="/api/state")return reply(response);
      if(url.startsWith("/api/symbols"))return reply({all:list});
      if(url.includes("BTCUSDT"))await btc;
      if(url.startsWith("/api/candles"))return reply({candles:[candle],version:"v3"});
      return reply({price:url.includes("BTCUSDT")?62000:.5,changePct:1,at:Date.now(),version:"v3"});
    }
  });
    await new Promise(setImmediate);
    assert.equal(elements.symbol.value,"ASTERUSDT");
    assert.match(elements["chart-info"].textContent,/ASTER\/USDT/);
    assert.match(elements["grid-levels"].textContent,/Achat.*Référence.*Vente/);
    assert.equal(beats.length,6);
    assert.match(elements.reference.textContent,/0,49/);
    assert.equal(elements["trade-quantity"].textContent,"Quantité (ASTER)");
    assert.match(elements["nav-assets"].textContent,/ASTER/);
    assert.equal(elements.start.disabled,true);
    resolveBtc();
    await new Promise(setImmediate);
    assert.match(elements["chart-info"].textContent,/ASTER\/USDT/);
    assert.match(elements["price-market"].textContent,/ASTER\/USDT/);
    elements.symbol.value="BTCUSDT"; elements.symbol.onchange();
    await new Promise(setImmediate);
    assert.equal(elements["grid-levels"].textContent,"");
    assert.match(elements["chart-info"].textContent,/BTC\/USDT/);
    elements["follow-grid"].checked=true;elements["follow-grid"].onchange();
    await new Promise(setImmediate);
    assert.match(elements["chart-info"].textContent,/ASTER\/USDT/);
});
