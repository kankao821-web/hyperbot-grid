(() => {
"use strict";
// Deterministic Spot GRID paper engine. Never sends orders to an exchange.
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function validBounds(c) {
  return c.lowerPrice == null && c.upperPrice == null ||
    finite(c.lowerPrice) && finite(c.upperPrice) && c.lowerPrice > 0 && c.upperPrice > c.lowerPrice;
}
function valid(c){return c&&validBounds(c)&&[c.capital,c.levels,c.rangePct,c.allocationPct,c.minOrder,c.maxOrder,c.feeBps].every(finite)&&c.capital>=20&&c.capital<=10000&&Number.isInteger(c.levels)&&c.levels>=2&&c.levels<=30&&c.rangePct>=0.2&&c.rangePct<=30&&c.allocationPct>=1&&c.allocationPct<=80&&c.minOrder>=1&&c.maxOrder>=c.minOrder&&c.maxOrder<=1000&&c.feeBps>=0&&c.feeBps<=100&&c.capital*c.allocationPct/100/c.levels>=c.minOrder}
function budget(s){const c=s.config;return Math.min(c.maxOrder,c.capital*c.allocationPct/100/c.levels)}
function fill(s,side,price,notional,seed=false){if(!finite(price)||price<=0||!finite(notional)||notional<=0)return false;const fee=notional*s.config.feeBps/10000,quantity=notional/price;if(side==="BUY"){if(notional+fee>s.usdt+1e-8)return false;s.usdt-=notional+fee;s.btc+=quantity}else if(side==="SELL"){if(quantity>s.btc+1e-10)return false;s.btc-=quantity;s.usdt+=notional-fee}else return false;s.reference=price;s.lastFillAt=new Date().toISOString();s.trades.push({at:s.lastFillAt,side,price,qty:quantity,notional,fee,seed,market:"spot",symbol:s.symbol,simulation:true});s.trades=s.trades.slice(-500);return true}
function triggers(s) {
  if (!finite(s.reference) || s.reference <= 0) return null;
  const { lowerPrice, upperPrice, rangePct, levels } = s.config;
  if (lowerPrice == null) {
    const fraction = rangePct / levels / 100;
    return { reference: s.reference, buy: s.reference * (1 - fraction), sell: s.reference * (1 + fraction) };
  }
  const distance = (upperPrice - lowerPrice) / levels;
  const position = (s.reference - lowerPrice) / distance;
  const buyIndex = Math.min(levels, Math.ceil(position - 1e-10) - 1);
  const sellIndex = Math.max(0, Math.floor(position + 1e-10) + 1);
  return {
    reference: s.reference,
    buy: buyIndex >= 0 ? lowerPrice + buyIndex * distance : null,
    sell: sellIndex <= levels ? lowerPrice + sellIndex * distance : null,
  };
}
function step(s,price){if(!s.running||!finite(price)||price<=0||!finite(s.reference)||s.reference<=0)return null;if(!finite(s.usdt)||!finite(s.btc)||s.usdt<0||s.btc<0){s.running=false;s.marketError="Simulation stoppée : inventaire invalide";return null}if(Math.abs(price/s.reference-1)>0.15){s.running=false;s.marketError="Simulation stoppée : variation supérieure à 15 % depuis le dernier ordre";return null}if(s.usdt+s.btc*price<s.config.capital*0.9){s.running=false;s.marketError="Simulation stoppée : perte supérieure à 10 % du capital initial";return null}if(s.config.lowerPrice!=null&&(price<s.config.lowerPrice||price>s.config.upperPrice))return null;const b=budget(s),levels=triggers(s);if(b<s.config.minOrder)return null;if(levels.buy!==null&&price<=levels.buy)return fill(s,"BUY",price,b)?"BUY":null;if(levels.sell!==null&&price>=levels.sell)return fill(s,"SELL",price,b)?"SELL":null;return null}
function initialize(symbol,config,price){if(!valid(config)||!finite(price)||price<=0||!/^[A-Z0-9]{2,25}USDT$/.test(symbol))throw Error("Invalid paper GRID configuration");const s={mode:"paper",running:true,market:"spot",symbol,config,usdt:config.capital,btc:0,reference:price,lastPrice:price,updatedAt:new Date().toISOString(),lastFillAt:null,marketError:null,trades:[],startedAt:new Date().toISOString()};const seed=Math.min(config.maxOrder,config.capital*config.allocationPct/200);if(seed>=config.minOrder&&(config.lowerPrice==null||price>=config.lowerPrice&&price<=config.upperPrice))fill(s,"BUY",price,seed,true);return s}
function nav(s){return s.usdt+s.btc*s.lastPrice}
function replay(symbol, config, candles) {
  if (!valid(config) || !candles.length) return null;
  const state = initialize(symbol, config, candles[0].close);
  for (const {close} of candles.slice(1)) {
    state.lastPrice = close;
    step(state, close);
  }
  return {
    pnl: nav(state) - config.capital,
    orders: state.trades.length,
    fees: state.trades.reduce((sum, trade) => sum + trade.fee, 0),
  };
}
const engine = {valid,budget,fill,step,initialize,nav,triggers,replay};
if (typeof module === "object" && module.exports) module.exports = engine;
else window.PaperGrid = engine;
})();
