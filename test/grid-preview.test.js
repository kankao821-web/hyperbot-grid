const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const grid = require("../paper-grid");
test("editing bounds and fees recalculates the grid and replay while the robot is running", async () => {
  const grid = require("../paper-grid");
  const config = {capital:100,levels:4,rangePct:6,allocationPct:60,minOrder:10,maxOrder:25,feeBps:10};
  assert.deepEqual(grid.triggers({reference:2.1,config:{...config,lowerPrice:1,upperPrice:3}}),{reference:2.1,buy:2,sell:2.5});
  const ids = [...fs.readFileSync(path.join(__dirname,"..","dashboard.html"),"utf8").matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  const nodes = Object.fromEntries(ids.map(id=>[id,{
    style:{}, options:[], value:"", clientWidth:800, clientHeight:300,
    add(option){this.options.push(option)},
    replaceChildren(...options){this.options=options},
    getContext(){return new Proxy({}, {get:()=>()=>{}})}
  }]));
  Object.assign(nodes.market,{value:"spot"});
  Object.assign(nodes.symbol,{value:"ASTERUSDT"});
  Object.assign(nodes.gridSymbol,{value:"ASTERUSDT"});
  Object.assign(nodes.interval,{value:"5m"});
  nodes["follow-grid"].checked=true;
  const state=grid.initialize("ASTERUSDT",config,2);
  const usd=[2,1.98,2.02,2.01];
  const candles=usd.map((close,i)=>({time:1700000000+i*300,open:close,low:close-.01,high:close+.01,close,volume:1}));
  const requests=[];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","dashboard.js"),"utf8"),{
    document:{getElementById:id=>nodes[id]},
    window:{addEventListener(){},PaperGrid:grid},
    Option:class{constructor(label,value){Object.assign(this,{label,value})}},
    AbortController,setTimeout:()=>0,clearTimeout(){},setInterval(){},
    fetch:async url=>{
      requests.push(url);
      const data=url==="/api/state"?{...state,gridTriggers:grid.triggers(state),stepPct:1.5,nav:100,pnl:0}:
        url.startsWith("/api/candles")?{candles,version:"v3"}:url.startsWith("/api/symbols")?{all:[{symbol:"ASTERUSDT"}]}:
        {price:2,changePct:0,at:Date.now(),version:"v3"};
      return {ok:true,json:async()=>data};
    }
  });
  await new Promise(setImmediate);
  const startingRequests=requests.length;
  nodes.lowerPrice.value="1.93";
  nodes.lowerPrice.oninput();
  assert.match(nodes["preview-result"].textContent,/Vérifie/);
  nodes.upperPrice.value="2.09";
  nodes.upperPrice.oninput();
  assert.match(nodes["grid-levels"].textContent,/Prix bas.*Prix haut/);
  const previous=nodes["preview-result"].textContent;
  nodes.feeBps.value="100";
  nodes.feeBps.oninput();
  assert.notEqual(nodes["preview-result"].textContent,previous);
  nodes.levels.value="20";
  nodes.levels.oninput();
  assert.match(nodes["preview-result"].textContent,/minimum/);
  assert.match(nodes["grid-levels"].textContent,/Prix bas.*Prix haut/);
  assert.equal(nodes.fallback.style.display,"block");
  nodes.levels.value="";
  nodes.levels.oninput();
  assert.match(nodes["preview-result"].textContent,/Dernier tracé conservé/);
  assert.equal(nodes.fallback.style.display,"block");
  assert.equal(requests.length,startingRequests);
  assert.equal(state.config.lowerPrice,undefined);
  nodes["restore-grid"].onclick();
  assert.equal(nodes.lowerPrice.value,"");
  assert.match(nodes["grid-levels"].textContent,/Achat.*Vente/);
});
