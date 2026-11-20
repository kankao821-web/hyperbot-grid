"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),net=require("node:net"),{spawn}=require("node:child_process");
const root=path.resolve(__dirname,"..");
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,"127.0.0.1",r));const n=server.address().port;await new Promise(r=>server.close(r));return n}
test("API security, credentials lifecycle, paper mode and browser assets",async t=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aster-e2e-")),p=await port(),password="test-password-only",key="unit-test-encryption-key";
const child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,PORT:String(p),DATA_DIR:dir,DASHBOARD_PASSWORD:password,ASTER_CREDENTIALS_ENCRYPTION_KEY:key},stdio:["ignore","pipe","pipe"]});
let logs="";child.stdout.on("data",x=>logs+=x);child.stderr.on("data",x=>logs+=x);
t.after(()=>{child.kill("SIGTERM");fs.rmSync(dir,{recursive:true,force:true})});
const base="http://127.0.0.1:"+p,auth="Basic "+Buffer.from("admin:"+password).toString("base64");
async function request(url,opts={}){const res=await fetch(base+url,{...opts,headers:{Authorization:auth,...opts.headers},signal:AbortSignal.timeout(3000)});let data;const txt=await res.text();try{data=JSON.parse(txt)}catch{data=txt}return {status:res.status,data,headers:res.headers}}
let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)break;try{const r=await fetch(base+"/health",{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,80))}
assert.ok(ready,"server did not start: "+logs);
const unauthorized=await fetch(base+"/api/aster/credentials");assert.equal(unauthorized.status,401);
const health=await request("/health");assert.equal(health.status,200);assert.equal(health.data.ok,true);assert.ok(health.data.checks.every(x=>x.ok));
const html=await request("/");assert.equal(html.status,200);assert.match(html.data,/api-form/);assert.match(html.data,/dashboard\.js/);assert.match(html.data,/connection\.js/);assert.match(html.data,/id="api-form"[^>]*novalidate/);
const connection=await request("/connection.js");assert.equal(connection.status,200);assert.match(connection.data,/addEventListener\("submit"/);assert.match(connection.data,/agentPrivateKey"\)\.value=""/);const js=await request("/dashboard.js");assert.equal(js.status,200);assert.match(js.data,/refreshAssets/);
let status=await request("/api/aster/credentials");assert.equal(status.data.configured,false);const emptyAssets=await request("/api/assets");assert.equal(emptyAssets.data.connected,false);
const {Wallet}=require("ethers");const fakeKey="0x"+"3".repeat(64);const fake={userAddress:"0x"+"1".repeat(40),agentAddress:new Wallet(fakeKey).address,agentPrivateKey:fakeKey};
const invalid=await request("/api/aster/credentials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fake,agentPrivateKey:"invalid"})});assert.equal(invalid.status,400);
const mismatch=await request("/api/aster/credentials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fake,agentAddress:"0x"+"2".repeat(40)})});assert.equal(mismatch.status,400);assert.match(mismatch.data.error,/correspond pas/);
const saved=await request("/api/aster/credentials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(fake)});assert.equal(saved.status,200);assert.equal(saved.data.configured,true);assert.equal(saved.data.agentPrivateKey,undefined);assert.equal(saved.data.privateKeyStored,true);
const disk=fs.readFileSync(path.join(dir,"aster-agent.enc"),"utf8");assert.ok(!disk.includes(fake.agentPrivateKey),"secret stored in plaintext");assert.ok(!disk.includes(fake.userAddress),"address stored in plaintext");
status=await request("/api/aster/credentials");assert.equal(status.data.configured,true);assert.equal(status.data.agentPrivateKey,undefined);
// Do not query real Aster accounts with test credentials in CI. Test local signer verification instead.

const live=await request("/api/grid/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mode:"live",market:"spot",symbol:"BTCUSDT"})});assert.equal(live.status,403);
const futures=await request("/api/grid/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({market:"futures",symbol:"BTCUSDT"})});assert.equal(futures.status,403);
const reset=await request("/api/grid/reset",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});assert.equal(reset.status,200);assert.equal(reset.data.running,false);
const deleted=await request("/api/aster/credentials",{method:"DELETE"});assert.equal(deleted.status,200);assert.equal(deleted.data.configured,false);assert.equal(fs.existsSync(path.join(dir,"aster-agent.enc")),false);
});
