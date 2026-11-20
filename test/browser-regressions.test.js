"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
test("API diagnostic displays real newline characters",()=>{const source=fs.readFileSync(path.join(root,"connection.js"),"utf8");assert.match(source,/results\.join\("\\n"\)/);assert.doesNotMatch(source,/results\.join\("\\\\n"\)/);new vm.Script(source)});
test("browser scripts parse independently",()=>{for(const name of ["dashboard.js","connection.js"]){const source=fs.readFileSync(path.join(root,name),"utf8");assert.doesNotThrow(()=>new vm.Script(source))}});
test("connection script never renders stored private keys",()=>{const source=fs.readFileSync(path.join(root,"connection.js"),"utf8");assert.doesNotMatch(source,/\.textContent\s*=\s*d\.agentPrivateKey/);assert.doesNotMatch(source,/\.innerHTML\s*=\s*d\.agentPrivateKey/)});
