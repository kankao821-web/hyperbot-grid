"use strict";
// Deterministic Spot GRID paper engine. Never sends orders to an exchange.
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function valid(c){return c&&[c.capital,c.levels,c.rangePct,c.allocationPct,c.minOrder,c.maxOrder,c.feeBps].every(finite)&&c.capital>=20&&c.capital<=10000&&Number.isInteger(c.levels)&&c.levels>=2&&c.levels<=30&&c.rangePct>=0.2&&c.rangePct<=30&&c.allocationPct>=1&&c.allocationPct<=80&&c.minOrder>=1&&c.maxOrder>=c.minOrder&&c.maxOrder<=1000&&c.feeBps>=0&&c.feeBps<=100&&c.capital*c.allocationPct/100/c.levels>=c.minOrder}
function budget(s){const c=s.config;return Math.min(c.maxOrder,c.capital*c.allocationPct/100/c.levels)}
function fill(s,side,price,notional,seed=false){if(!finite(price)||price<=0||!finite(notional)||notional<=0)return false;const fee=notional*s.config.feeBps/10000,quantity=notional/price;if(side==="BUY"){if(notional+fee>s.usdt+1e-8)return false;s.usdt-=notional+fee;s.btc+=quantity}else if(side==="SELL"){if(quantity>s.btc+1e-10)return false;s.btc-=quantity;s.usdt+=notional-fee}else return false;s.reference=price;s.lastFillAt=new Date().toISOString();s.trades.push({at:s.lastFillAt,side,price,qty:quantity,notional,fee,seed,market:"spot",symbol:s.symbol,simulation:true});s.trades=s.trades.slice(-500);return true}
function triggers(s) {
  if (!finite(s.reference) || s.reference <= 0) return null;
  const fraction = s.config.rangePct / s.config.levels / 100;
  return {
    reference: s.reference,
    buy: s.reference * (1 - fraction),
    sell: s.reference * (1 + fraction),
  };
}
function step(s,price){if(!s.running||!finite(price)||price<=0||!finite(s.reference)||s.reference<=0)return null;if(!finite(s.usdt)||!finite(s.btc)||s.usdt<0||s.btc<0){s.running=false;s.marketError="Simulation stoppée : inventaire invalide";return null}if(Math.abs(price/s.reference-1)>0.15){s.running=false;s.marketError="Simulation stoppée : variation supérieure à 15 % depuis le dernier ordre";return null}if(s.usdt+s.btc*price<s.config.capital*0.9){s.running=false;s.marketError="Simulation stoppée : perte supérieure à 10 % du capital initial";return null}const b=budget(s),levels=triggers(s);if(b<s.config.minOrder)return null;if(price<=levels.buy)return fill(s,"BUY",price,b)?"BUY":null;if(price>=levels.sell)return fill(s,"SELL",price,b)?"SELL":null;return null}
function initialize(symbol,config,price){if(!valid(config)||!finite(price)||price<=0||!/^[A-Z0-9]{2,25}USDT$/.test(symbol))throw Error("Invalid paper GRID configuration");const s={mode:"paper",running:true,market:"spot",symbol,config,usdt:config.capital,btc:0,reference:price,lastPrice:price,updatedAt:new Date().toISOString(),lastFillAt:null,marketError:null,trades:[],startedAt:new Date().toISOString()};const seed=Math.min(config.maxOrder,config.capital*config.allocationPct/200);if(seed>=config.minOrder)fill(s,"BUY",price,seed,true);return s}
function nav(s){return s.usdt+s.btc*s.lastPrice}
module.exports={valid,budget,fill,step,initialize,nav,triggers};
