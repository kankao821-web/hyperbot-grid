"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {Wallet,verifyTypedData}=require("ethers");
const {DOMAIN,TYPES,nextNonce,verifyAgent}=require("../aster-auth");
test("EIP-712 Agent signing uses Aster domain and recovers Agent address",async()=>{
const privateKey="0x"+"4".repeat(64),agent=new Wallet(privateKey),user="0x"+"1".repeat(40);
assert.equal(verifyAgent({agentPrivateKey:privateKey,agentAddress:agent.address}).address,agent.address);
assert.throws(()=>verifyAgent({agentPrivateKey:privateKey,agentAddress:"0x"+"2".repeat(40)}),/correspond pas/);
const msg=new URLSearchParams([["user",user],["signer",agent.address],["nonce",nextNonce()]]).toString();
const signature=await agent.signTypedData(DOMAIN,TYPES,{msg});
assert.equal(verifyTypedData(DOMAIN,TYPES,{msg},signature),agent.address);
assert.notEqual(verifyTypedData(DOMAIN,TYPES,{msg:msg+"&tampered=true"},signature),agent.address);
assert.equal(DOMAIN.chainId,1666);
assert.ok(BigInt(nextNonce())>BigInt(nextNonce())-2n);
});
