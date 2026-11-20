"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { createRequire } = require("node:module");

test("paper grid commands supersede pending starts and stale quotes", async t => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbot-grid-"));
  t.after(() => fs.rmSync(storage, { recursive: true, force: true }));
  const filename = path.resolve(__dirname, "../server.js");
  const serverRequire = createRequire(filename);
  const quotes = [];
  let handler;
  let tick;

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    __dirname: path.dirname(filename),
    require(name) {
      if (name !== "node:http") return serverRequire(name);
      return { createServer(fn) { handler = fn; return { listen() {} }; } };
    },
    process: { env: {
      DATA_DIR: storage,
      DASHBOARD_PASSWORD: "test-password",
      ASTER_CREDENTIALS_ENCRYPTION_KEY: "test-encryption-key",
    } },
    Buffer,
    URL,
    AbortController,
    console: { log() {}, error() {} },
    setTimeout() {},
    clearTimeout() {},
    setInterval(fn, delay) { if (delay === 15000) tick = fn; },
    async fetch(url) {
      if (url.endsWith("/exchangeInfo")) {
        return { ok: true, json: async () => ({
          symbols: [{ symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING" }],
        }) };
      }
      assert.match(url, /ticker\/price\?symbol=BTCUSDT$/);
      return new Promise(resolve => {
        quotes.push(price => resolve({ ok: true, json: async () => ({ price }) }));
      });
    },
  }, { filename });

  function request(url, method = "POST", payload = {}) {
    const req = Object.assign(new EventEmitter(), {
      url, method,
      headers: { authorization: "Basic " + Buffer.from("admin:test-password").toString("base64") },
    });
    let status;
    let body;
    const completion = handler(req, {
      writeHead(value) { status = value; },
      end(value) { body = JSON.parse(value); },
    });
    req.emit("data", JSON.stringify(payload));
    req.emit("end");
    return completion.then(() => ({ status, body }));
  }

  const start = () => request("/api/grid/start");
  const stop = () => request("/api/grid/stop");
  const flushRequests = () => new Promise(resolve => setImmediate(resolve));

  // Resolve the initial price polling before exercising the command races.
  await flushRequests();
  assert.equal(quotes.length, 1);
  quotes.shift()(100);
  await flushRequests();

  const first = start();
  const second = start();
  await flushRequests();
  assert.equal(quotes.length, 2);
  quotes.shift()(110);
  assert.equal((await first).status, 200);
  quotes.shift()(120);
  assert.equal((await second).status, 409);
  assert.equal((await request("/api/state", "GET")).body.price, 110);

  await stop();
  const pending = start();
  await flushRequests();
  assert.equal(quotes.length, 1);
  await stop();
  quotes.shift()(130);
  assert.equal((await pending).status, 409);

  const polling = tick();
  assert.equal(quotes.length, 1);
  await request("/api/grid/reset");
  quotes.shift()(140);
  await polling;
  const reset = await request("/api/state", "GET");
  assert.equal(reset.body.running, false);
  assert.equal(reset.body.price, 0);
  assert.equal((await request("/api/grid/start", "POST", { mode: "live" })).status, 403);
});
