"use strict";
const {Wallet}=require("ethers");
const DOMAIN=Object.freeze({name:"AsterSignTransaction",version:"1",chainId:1666,verifyingContract:"0x0000000000000000000000000000000000000000"});
const TYPES=Object.freeze({Message:[{name:"msg",type:"string"}]});
let lastNonce=0;
function nextNonce(){const now=Date.now()*1000;lastNonce=Math.max(now,lastNonce+1);return String(lastNonce)}
function verifyAgent(creds){const wallet=new Wallet("0x"+creds.agentPrivateKey.replace(/^0x/,""));if(wallet.address.toLowerCase()!==creds.agentAddress.toLowerCase())throw Error("La clé privée ne correspond pas à l'adresse publique Agent. Aucune requête envoyée.");return wallet}
async function signedGet(market,endpoint,creds,params={}){
if(!["spot","futures"].includes(market))throw Error("Marché invalide");
if(!/^[a-zA-Z0-9/]+$/.test(endpoint)||endpoint.includes("/"))throw Error("Endpoint invalide");
const wallet=verifyAgent(creds);
const entries=[["user",creds.userAddress],["signer",creds.agentAddress],["nonce",nextNonce()],...Object.entries(params)];
const query=new URLSearchParams(entries).toString();
const signature=await wallet.signTypedData(DOMAIN,TYPES,{msg:query});
const base=market==="spot"?"https://sapi.asterdex.com/api/v3/":"https://fapi.asterdex.com/fapi/v3/";
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
try{
const response=await fetch(base+endpoint+"?"+query+"&signature="+encodeURIComponent(signature),{signal:controller.signal,headers:{accept:"application/json","user-agent":"HyperBot-AsterCloud/1.1"}});
const data=await response.json().catch(()=>null);
if(!response.ok||data&&typeof data.code==="number"&&data.code<0)throw Error("Aster "+market+" : "+(data?.msg||"HTTP "+response.status)+" (code "+(data?.code??response.status)+")");
return data;
}finally{clearTimeout(timer)}
}
module.exports={DOMAIN,TYPES,nextNonce,verifyAgent,signedGet};
