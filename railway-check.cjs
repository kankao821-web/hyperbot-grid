"use strict";
const http = require("node:http");
const {readFuturesAccount} = require("./check-futures.cjs");

const credentials = {
  userAddress: process.env.ASTER_USER_ADDRESS,
  agentAddress: process.env.ASTER_AGENT_ADDRESS,
  agentPrivateKey: process.env.ASTER_AGENT_PRIVATE_KEY,
};
const checks = () => {
  if (Object.values(credentials).some(value => !value)) {
    console.log("Diagnostic Aster en attente des trois variables privées.");
    return;
  }
  readFuturesAccount(credentials).then(report => {
    for (const [name, check] of Object.entries(report)) {
      console.log(name + " " + (check.ok ? "OK" : "ÉCHEC " + check.diagnostic));
    }
  }).catch(() => console.log("Échec de validation des identifiants Agent."));
};

http.createServer((req, res) => {
  const healthy = req.method === "GET" && req.url === "/health";
  res.writeHead(healthy ? 200 : 404, {"Cache-Control":"no-store"});
  res.end(healthy ? "OK" : "");
}).listen(Number(process.env.PORT || 8080), "0.0.0.0", checks);
