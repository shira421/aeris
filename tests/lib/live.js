import {
  LIMITS,
  coverageCircles,
  distance,
  mergeReport,
  normalizeADSB,
  normalizeOpenSky,
  predicted,
  quality
} from "./chunk-JBDCKWCY.js";
import {
  getJSON,
  route
} from "./chunk-TJGE7DGR.js";
import "./chunk-WFOFGCSX.js";

// src/providers.js
var f = (n) => Number(n).toFixed(3);
var PROVIDERS = [
  {
    id: "adsblol",
    name: "adsb.lol",
    kind: "readsb",
    cors: false,
    maxRadius: 250,
    minGap: 900,
    area: (c) => `https://api.adsb.lol/v2/lat/${f(c.lat)}/lon/${f(c.lon)}/dist/${Math.round(c.nm)}`,
    hex: (id) => `https://api.adsb.lol/v2/hex/${id}`,
    callsign: (cs) => `https://api.adsb.lol/v2/callsign/${encodeURIComponent(cs)}`,
    reg: (r) => `https://api.adsb.lol/v2/reg/${encodeURIComponent(r)}`,
    licence: "ODbL 1.0",
    site: "https://adsb.lol",
    terms: "Open data (ODbL). Best-effort community service."
  },
  {
    id: "adsbfi",
    name: "adsb.fi",
    kind: "readsb",
    cors: false,
    maxRadius: 250,
    minGap: 1100,
    area: (c) => `https://opendata.adsb.fi/api/v3/lat/${f(c.lat)}/lon/${f(c.lon)}/dist/${Math.round(c.nm)}`,
    hex: (id) => `https://opendata.adsb.fi/api/v2/hex/${id}`,
    callsign: (cs) => `https://opendata.adsb.fi/api/v2/callsign/${encodeURIComponent(cs)}`,
    reg: (r) => `https://opendata.adsb.fi/api/v2/registration/${encodeURIComponent(r)}`,
    licence: "Personal, non-commercial use with attribution",
    site: "https://adsb.fi",
    terms: "1 request per second. Personal, non-commercial use; attribution required."
  },
  {
    id: "airplaneslive",
    name: "airplanes.live",
    kind: "readsb",
    cors: false,
    maxRadius: 250,
    minGap: 1100,
    area: (c) => `https://api.airplanes.live/v2/point/${f(c.lat)}/${f(c.lon)}/${Math.round(c.nm)}`,
    hex: (id) => `https://api.airplanes.live/v2/hex/${id}`,
    callsign: (cs) => `https://api.airplanes.live/v2/callsign/${encodeURIComponent(cs)}`,
    reg: (r) => `https://api.airplanes.live/v2/reg/${encodeURIComponent(r)}`,
    licence: "Non-commercial use",
    site: "https://airplanes.live",
    terms: "1 request per second. Non-commercial use. Blocks some networks."
  },
  {
    id: "opensky",
    name: "OpenSky Network",
    kind: "opensky",
    cors: false,
    minGap: 12e3,
    bbox: (b) => `https://opensky-network.org/api/states/all?lamin=${f(b.south)}&lomin=${f(b.west)}&lamax=${f(b.north)}&lomax=${f(b.east)}&extended=1`,
    hex: (id) => `https://opensky-network.org/api/states/all?icao24=${id}&extended=1`,
    licence: "Research and non-commercial use",
    site: "https://opensky-network.org",
    terms: "Anonymous use: 400 credits a day, 10-second resolution."
  }
];
function openSkyCost(b) {
  const area = Math.max(0, b.north - b.south) * Math.max(0, b.east - b.west);
  return area <= 25 ? 1 : area <= 100 ? 2 : area <= 400 ? 3 : 4;
}

// src/live.js
var TRACK_STRIDE = 8;
var TRACK_MAX = 60;
var FOCUS_MAX = 2400;
var SMOOTH_TAU = 0.7;
var OPENSKY_BUDGET = 380;
var LiveFeed = class {
  constructor({ onUpdate = () => {
  }, onStatus = () => {
  }, storage = null, now = () => Date.now() / 1e3 } = {}) {
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.storage = storage;
    this.now = now;
    this.flights = /* @__PURE__ */ new Map();
    this.tracks = /* @__PURE__ */ new Map();
    this.offsets = /* @__PURE__ */ new Map();
    this.focus = null;
    this.view = null;
    this.circles = [];
    this.circleState = /* @__PURE__ */ new Map();
    this.running = false;
    this.timer = null;
    this.paused = false;
    this.enabled = new Set(PROVIDERS.map((p) => p.id));
    this.health = new Map(PROVIDERS.map((p) => [p.id, { id: p.id, name: p.name, state: "idle", ok: 0, fail: 0, ms: null, aircraft: null, lastOk: null, error: null, nextAt: 0, backoff: 0, busy: false }]));
    this.lastUpdate = null;
    this.lastData = null;
  }
  providers() {
    return PROVIDERS.filter((p) => this.enabled.has(p.id));
  }
  /** Providers this environment can actually reach (native app, proxy, or CORS-enabled host). */
  reachable() {
    return this.providers().filter((p) => route(p.kind === "opensky" ? p.hex("000000") : p.area({ lat: 0, lon: 0, nm: 10 })));
  }
  setEnabled(id, on) {
    on ? this.enabled.add(id) : this.enabled.delete(id);
    this.onStatus(this.status());
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }
  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }
  setPaused(p) {
    this.paused = p;
  }
  setView(bounds, zoom) {
    this.view = { bounds, zoom };
    const circles = coverageCircles(bounds, 250, 36);
    const key = (c) => c.lat.toFixed(1) + "," + c.lon.toFixed(1) + "," + c.nm;
    const next = /* @__PURE__ */ new Map();
    for (const c of circles) {
      const k = key(c);
      next.set(k, this.circleState.get(k) || { last: 0, busy: false });
    }
    this.circles = circles.map((c) => ({ ...c, key: key(c) }));
    this.circleState = next;
  }
  setFocus(id) {
    this.focus = id;
  }
  /** Seconds between refreshes wanted for the i-th circle (nearest the centre first). */
  interval(i) {
    return i < 1 ? 1 : i < 3 ? 2 : i < 8 ? 4 : 8;
  }
  loop() {
    if (!this.running) return;
    if (!this.paused && !(typeof document !== "undefined" && document.hidden)) this.dispatch();
    this.prune();
    this.timer = setTimeout(() => this.loop(), 200);
  }
  dispatch() {
    const now = this.now() * 1e3;
    const readsb = this.reachable().filter((p) => p.kind === "readsb");
    for (const p of [...readsb].sort((a, b) => (this.health.get(a.id).lastUsed || 0) - (this.health.get(b.id).lastUsed || 0))) {
      const h = this.health.get(p.id);
      if (h.busy || now < h.nextAt) continue;
      const job = this.nextJob(p);
      if (!job) continue;
      this.run(p, job);
    }
    const os = this.reachable().find((p) => p.kind === "opensky");
    if (os && this.view) {
      const h = this.health.get(os.id);
      const wide = this.circles.length > 8;
      const noReadsb = !readsb.length || readsb.every((p) => ["error", "blocked", "refused", "limited"].includes(this.health.get(p.id).state));
      if (!h.busy && now >= h.nextAt && (wide || noReadsb)) this.runOpenSky(os);
    }
  }
  nextJob(p) {
    const now = this.now();
    if (this.focus && !this.focus.startsWith("demo")) {
      const f2 = this.flights.get(this.focus);
      const covered = f2 && this.circles.some((c, i) => i < 3 && distance([c.lat, c.lon], [f2.lat, f2.lon]) < c.nm * 1852 * 0.95);
      const st = this.circleState.get("focus") || { last: 0, busy: false };
      this.circleState.set("focus", st);
      if (!covered && !st.busy && now - st.last >= 1.5) return { kind: "hex", id: this.focus, state: st };
    }
    let best = null, score = -Infinity;
    this.circles.forEach((c, i) => {
      const st = this.circleState.get(c.key);
      if (!st || st.busy || c.nm > p.maxRadius) return;
      const overdue = now - st.last - this.interval(i);
      if (overdue >= 0 && overdue > score) {
        score = overdue;
        best = { kind: "area", circle: c, state: st };
      }
    });
    return best;
  }
  async run(p, job) {
    const h = this.health.get(p.id);
    h.busy = true;
    h.lastUsed = this.now();
    job.state.busy = true;
    const url = job.kind === "hex" ? p.hex(job.id) : p.area(job.circle);
    try {
      const { data, ms, serverDate } = await getJSON(url, { timeout: 8e3 });
      const flights = normalizeADSB(data, this.now(), p.name);
      job.state.last = this.now();
      this.ingest(flights);
      Object.assign(h, { state: "ok", ok: h.ok + 1, ms: Math.round(ms), aircraft: flights.length, lastOk: this.now(), error: null, backoff: 0, nextAt: this.now() * 1e3 + p.minGap, serverLag: serverDate ? Math.round(this.now() - serverDate) : null });
    } catch (err) {
      job.state.last = this.now() - this.interval(0) + 1.5;
      h.fail++;
      h.error = err.message;
      h.backoff = Math.min(3e5, Math.max(5e3, (h.backoff || 2500) * 2));
      h.state = err.status === 429 ? "limited" : err.status === 403 ? "refused" : err.blocked ? "blocked" : "error";
      h.nextAt = this.now() * 1e3 + (err.status === 403 ? 6e5 : h.backoff);
    } finally {
      h.busy = false;
      job.state.busy = false;
      this.onStatus(this.status());
    }
  }
  openSkyCredits() {
    const day = new Date(this.now() * 1e3).toISOString().slice(0, 10);
    let s = { day, used: 0 };
    try {
      s = JSON.parse(this.storage?.getItem("aeris-opensky") || "null") || s;
    } catch {
    }
    if (s.day !== day) s = { day, used: 0 };
    return s;
  }
  async runOpenSky(p) {
    const b = this.view.bounds, box = { west: Math.max(-180, b.west), east: Math.min(180, b.east), south: Math.max(-90, b.south), north: Math.min(90, b.north) };
    const cost = openSkyCost(box), credits = this.openSkyCredits(), h = this.health.get(p.id);
    if (credits.used + cost > OPENSKY_BUDGET) {
      h.state = "limited";
      h.error = "Daily anonymous credit budget used.";
      h.nextAt = this.now() * 1e3 + 6e5;
      return;
    }
    h.busy = true;
    try {
      const { data, ms } = await getJSON(p.bbox(box), { timeout: 12e3 });
      credits.used += cost;
      try {
        this.storage?.setItem("aeris-opensky", JSON.stringify(credits));
      } catch {
      }
      const flights = normalizeOpenSky(data, this.now(), p.name);
      this.ingest(flights);
      Object.assign(h, { state: "ok", ok: h.ok + 1, ms: Math.round(ms), aircraft: flights.length, lastOk: this.now(), error: null, backoff: 0, credits: OPENSKY_BUDGET - credits.used, nextAt: this.now() * 1e3 + Math.max(p.minGap, cost * 15e3) });
    } catch (err) {
      h.fail++;
      h.error = err.message;
      h.state = err.status === 429 ? "limited" : err.blocked ? "blocked" : "error";
      h.nextAt = this.now() * 1e3 + (err.status === 429 ? 9e5 : 6e4);
    } finally {
      h.busy = false;
      this.onStatus(this.status());
    }
  }
  ingest(list) {
    const now = this.now();
    let changed = 0;
    for (const next of list) {
      const prev = this.flights.get(next.id);
      if (prev && next.positionTime < prev.positionTime - 0.05 && next.positionTime > 0) {
        const { flight: flight2 } = mergeReport(prev, next);
        this.flights.set(next.id, flight2);
        continue;
      }
      const before = prev ? this.position(prev.id, now) : null;
      const { flight, fresh } = mergeReport(prev, next);
      this.flights.set(next.id, flight);
      if (!fresh) continue;
      changed++;
      if (before) {
        const after = predicted(flight, now);
        const dLat = before.lat - after.lat, dLon = before.lon - after.lon;
        if (Math.abs(dLat) < 0.02 && Math.abs(dLon) < 0.02) this.offsets.set(flight.id, { dLat, dLon, t: now });
        else this.offsets.delete(flight.id);
      }
      this.record(flight);
    }
    if (changed) {
      this.lastUpdate = now;
      this.onUpdate();
    }
  }
  record(f2) {
    if (!f2.positionTime) return;
    let t = this.tracks.get(f2.id);
    if (!t) {
      t = [];
      this.tracks.set(f2.id, t);
    }
    const focus = f2.id === this.focus, last = t.at(-1);
    if (last && f2.positionTime <= last.positionTime) return;
    if (!focus && last && f2.positionTime - last.positionTime < TRACK_STRIDE) return;
    t.push({ positionTime: f2.positionTime, lat: f2.lat, lon: f2.lon, altitude: f2.altitude, geometricAltitude: f2.geometricAltitude, groundSpeed: f2.groundSpeed, verticalRate: f2.verticalRate, track: f2.track, callsign: f2.callsign, onGround: f2.onGround, simulated: false });
    const max = focus ? FOCUS_MAX : TRACK_MAX;
    if (t.length > max) t.splice(0, t.length - max);
  }
  /** Display position: dead-reckoned to now, with any recent correction blended out. */
  position(id, now = this.now()) {
    const f2 = this.flights.get(id);
    if (!f2) return null;
    const p = predicted(f2, now);
    const o = this.offsets.get(id);
    if (o) {
      const k = Math.exp(-(now - o.t) / SMOOTH_TAU);
      if (k < 0.01) this.offsets.delete(id);
      else {
        p.lat += o.dLat * k;
        p.lon += o.dLon * k;
      }
    }
    return p;
  }
  prune() {
    const now = this.now();
    for (const [id, f2] of this.flights) {
      const age = now - f2.positionTime;
      if (age > LIMITS.lost * (id === this.focus ? 5 : 1)) {
        this.flights.delete(id);
        this.offsets.delete(id);
        if (id !== this.focus) this.tracks.delete(id);
      }
    }
    for (const [id, t] of this.tracks) {
      if (!this.flights.has(id) && id !== this.focus && (!t.length || now - t.at(-1).positionTime > 1800)) this.tracks.delete(id);
    }
  }
  list() {
    return [...this.flights.values()];
  }
  get(id) {
    return this.flights.get(id) || null;
  }
  track(id) {
    return this.tracks.get(id) || [];
  }
  /** Search every reachable provider for a callsign, registration or hex anywhere in the world. */
  async find(query) {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const isHex = /^[0-9A-F]{6}$/.test(q), looksReg = /^[A-Z0-9]{1,3}-[A-Z0-9]{1,5}$|^N[0-9][0-9A-Z]{0,4}$/.test(q);
    for (const p of this.reachable().filter((p2) => p2.kind === "readsb")) {
      const url = isHex ? p.hex(q.toLowerCase()) : looksReg && p.reg ? p.reg(q) : p.callsign(q);
      try {
        const { data } = await getJSON(url, { timeout: 8e3 });
        const flights = normalizeADSB(data, this.now(), p.name);
        if (flights.length) {
          this.ingest(flights);
          return flights.map((f2) => f2.id);
        }
      } catch {
      }
    }
    return [];
  }
  status() {
    const hs = [...this.health.values()];
    const reachable = new Set(this.reachable().map((p) => p.id));
    const live = hs.some((h) => h.state === "ok" && this.now() - (h.lastOk || 0) < 20);
    return { live, providers: hs.map((h) => ({ ...h, enabled: this.enabled.has(h.id), reachable: reachable.has(h.id) })), aircraft: this.flights.size, lastUpdate: this.lastUpdate, circles: this.circles.length, anyReachable: reachable.size > 0 };
  }
  visibleCount() {
    let n = 0;
    const now = this.now();
    for (const f2 of this.flights.values()) if (quality(f2, now).age <= LIMITS.lost) n++;
    return n;
  }
};
export {
  LiveFeed
};
