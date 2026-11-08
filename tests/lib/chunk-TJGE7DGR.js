// src/net.js
var pending = /* @__PURE__ */ new Map();
var seq = 0;
var proxyBase = null;
var g = typeof window !== "undefined" ? window : globalThis;
var CORS_OK = /* @__PURE__ */ new Set(["api.adsbdb.com", "hexdb.io", "api.planespotters.net"]);
if (typeof window !== "undefined") window.__aerisNetReply = (id, reply) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  clearTimeout(p.timer);
  reply && !reply.error ? p.resolve(reply) : p.reject(new Error(reply?.error || "Native request failed"));
};
function bridge() {
  if (g.webkit?.messageHandlers?.aerisNet) return "ios";
  if (g.AerisNative?.request) return "android";
  return null;
}
function setProxy(url) {
  proxyBase = url ? String(url).replace(/\/+$/, "") : null;
}
function getProxy() {
  return proxyBase;
}
function route(url) {
  const host = new URL(url).host;
  if (bridge()) return "native";
  if (CORS_OK.has(host)) return "direct";
  if (proxyBase) return "proxy";
  return null;
}
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
async function nativeRequest(url, timeout) {
  const kind = bridge();
  if (kind === "ios") return g.webkit.messageHandlers.aerisNet.postMessage({ url, timeout });
  return new Promise((resolve, reject) => {
    const id = "r" + ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The request timed out."));
    }, timeout + 2e3);
    pending.set(id, { resolve, reject, timer });
    g.AerisNative.request(id, url, timeout);
  });
}
async function getJSON(url, { timeout = 9e3, signal, maxBytes = 12e6 } = {}) {
  const started = g.performance?.now?.() ?? Date.now();
  const host = new URL(url).host;
  const via = route(url) || "direct";
  let status, text, serverDate = null;
  if (via === "native") {
    const reply = await nativeRequest(url, timeout);
    if (signal?.aborted) throw new Error("Cancelled.");
    status = reply.status;
    text = reply.body;
    serverDate = reply.date ? Date.parse(reply.date) / 1e3 || null : null;
  } else {
    const target = via === "proxy" ? `${proxyBase}?url=${encodeURIComponent(url)}` : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const r = await fetch(target, { signal: controller.signal, cache: "no-store", credentials: "omit", mode: "cors", headers: { Accept: "application/json" }, priority: "high" });
      status = r.status;
      serverDate = Date.parse(r.headers.get("date") || "") / 1e3 || null;
      text = await r.text();
    } catch (err) {
      if (err.name === "AbortError") throw new Error(signal?.aborted ? "Cancelled." : "The request to " + host + " timed out.");
      throw Object.assign(new Error(via === "proxy" ? "Cannot reach the data proxy." : "Cannot reach " + host + " from this browser (network or CORS)."), { blocked: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  const ms = (g.performance?.now?.() ?? Date.now()) - started;
  if (status < 200 || status >= 300) throw new HttpError(status, status === 429 ? "Rate limited by " + host + "." : `${host} returned HTTP ${status}.`);
  if (text.length > maxBytes) throw new Error("Response too large.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(host + " returned invalid JSON.");
  }
  return { data, status, ms, via, serverDate };
}

export {
  bridge,
  setProxy,
  getProxy,
  route,
  HttpError,
  getJSON
};
