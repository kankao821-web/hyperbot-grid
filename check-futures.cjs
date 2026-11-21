"use strict";

const { signedGet, verifyAgent } = require("./aster-auth.cjs");

async function readFuturesAccount(credentials, get = signedGet) {
  verifyAgent(credentials);
  const checks = [
    ["balances", "balance", {}],
    ["positions", "positionRisk", { symbol: "HYPEUSDT" }],
    ["openOrders", "openOrders", { symbol: "HYPEUSDT" }],
  ];
  const results = await Promise.allSettled(checks.map(async ([, endpoint, filters]) => {
    const data = await get("futures", endpoint, credentials, filters);
    if (!Array.isArray(data)) throw new Error("Format inattendu");
    return data;
  }));
  return Object.fromEntries(results.map((result, index) => [
    checks[index][0],
    result.status === "fulfilled"
      ? { ok: true, records: result.value.length }
      : { ok: false, diagnostic: result.reason?.message.match(/\(code (-?\d+)\)$/)?.[1] ?? "Réponse indisponible" },
  ]));
}

module.exports = { readFuturesAccount };

if (require.main === module) {
  const credentials = {
    userAddress: process.env.ASTER_USER_ADDRESS,
    agentAddress: process.env.ASTER_AGENT_ADDRESS,
    agentPrivateKey: process.env.ASTER_AGENT_PRIVATE_KEY,
  };
  const addressPattern = /^0x[\da-fA-F]{40}$/;
  if (!addressPattern.test(credentials.userAddress) || !addressPattern.test(credentials.agentAddress)
      || !/^(0x)?[\da-fA-F]{64}$/.test(credentials.agentPrivateKey)) {
    process.stderr.write("Renseigner les trois variables ASTER dans un environnement privé.\n");
    process.exitCode = 1;
  } else {
    readFuturesAccount(credentials).then(report => {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      if (Object.values(report).some(check => !check.ok)) process.exitCode = 1;
    }).catch(() => {
      process.stderr.write("Les identifiants Agent ne correspondent pas.\n");
      process.exitCode = 1;
    });
  }
}
