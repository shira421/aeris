import {
  airports
} from "./chunk-OWLWEMHF.js";
import {
  distance
} from "./chunk-GS7HUSXL.js";
import "./chunk-WFOFGCSX.js";

// src/airports.js
var db = null;
var byCode = /* @__PURE__ */ new Map();
var loading = null;
function expand(a) {
  return { icao: a[0], iata: a[1], id: a[1] || a[0], name: a[2], city: a[3], country: a[4], lat: a[5], lon: a[6], elevation: a[7], size: a[8], tz: a[9] || null, runways: (a[10] || []).map((r) => ({ ident: r[0], length: r[1], width: r[2], surface: r[3], heading: r[4], ends: r.length >= 9 ? [[r[5], r[6]], [r[7], r[8]]] : null })), website: a[11] || null };
}
function index(list) {
  db = list;
  byCode = /* @__PURE__ */ new Map();
  for (const a of list) {
    if (a.iata) byCode.set(a.iata, a);
    byCode.set(a.icao, a);
  }
  return db;
}
index(airports.map((a) => ({ icao: a.icao, iata: a.id, id: a.id, name: a.name, city: a.city, country: "", lat: a.lat, lon: a.lon, elevation: a.elevation / 0.3048, size: "L", tz: a.tz, runways: a.runways.map((r) => ({ ident: r[0], length: r[1], width: r[2], surface: "", heading: null })), website: a.website })));
function loadAirports(url = "./airports.json") {
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = globalThis.__AERIS_AIRPORTS__ || await (await fetch(url)).json();
      if (Array.isArray(raw?.airports) && raw.airports.length) index(raw.airports.map(expand));
    } catch {
    }
    return db;
  })();
  return loading;
}
var allAirports = () => db;
var airportByCode = (code) => code ? byCode.get(String(code).toUpperCase()) || null : null;
function searchAirports(q, limit = 6) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = [], starts = [], contains = [];
  for (const a of db) {
    const codes = [a.iata, a.icao].map((s) => (s || "").toLowerCase());
    if (codes.includes(q)) exact.push(a);
    else if ((a.city || "").toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q)) starts.push(a);
    else if (a.name.toLowerCase().includes(q) || (a.city || "").toLowerCase().includes(q)) contains.push(a);
    if (exact.length + starts.length >= limit * 3) break;
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}
function nearestAirports(lat, lon, n = 12, sizes = "LM") {
  return db.filter((a) => sizes.includes(a.size)).map((a) => ({ a, d: distance([lat, lon], [a.lat, a.lon]) })).sort((x, y) => x.d - y.d).slice(0, n).map((x) => ({ ...x.a, distanceKm: x.d / 1e3 }));
}
function airportsGeoJSON() {
  return { type: "FeatureCollection", features: db.map((a) => ({ type: "Feature", properties: { id: a.id, code: a.iata || a.icao, size: a.size, rank: a.size === "L" ? 0 : a.size === "M" ? 1 : 2 }, geometry: { type: "Point", coordinates: [a.lon, a.lat] } })) };
}
function localTime(a, date = /* @__PURE__ */ new Date()) {
  if (!a.tz) return null;
  try {
    return date.toLocaleTimeString("en-GB", { timeZone: a.tz, hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}
export {
  airportByCode,
  airportsGeoJSON,
  allAirports,
  loadAirports,
  localTime,
  nearestAirports,
  searchAirports
};
