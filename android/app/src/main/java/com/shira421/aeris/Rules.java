package com.shira421.aeris;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The alert rules of src/collection.js (evaluate, alertText, step), for Android's background check.
 * Keep the two in step: one alert of each kind per flight leg, only observed facts, a silent first look.
 */
final class Rules {
    private static final double R_EARTH = 6371008.8, DEG = Math.PI / 180;
    private static final Map<String, String> EMERGENCY = new HashMap<>();
    static {
        EMERGENCY.put("7500", "unlawful interference");
        EMERGENCY.put("7600", "radio failure");
        EMERGENCY.put("7700", "general emergency");
    }

    private Rules() { }

    // ——— Geometry (as in core.ts)

    static double distance(double lat1, double lon1, double lat2, double lon2) {
        double p1 = lat1 * DEG, p2 = lat2 * DEG, dp = (lat2 - lat1) * DEG, dl = (lon2 - lon1) * DEG;
        double h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    static double bearing(double lat1, double lon1, double lat2, double lon2) {
        double p = lat1 * DEG, q = lat2 * DEG, d = (lon2 - lon1) * DEG;
        return (Math.atan2(Math.sin(d) * Math.cos(q), Math.cos(p) * Math.sin(q) - Math.sin(p) * Math.cos(q) * Math.cos(d)) / DEG + 360) % 360;
    }

    private static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }

    /** routeFit(...).plausible from core.ts. */
    static boolean routeFits(Obs f, JSONObject o, JSONObject d) {
        double oLat = o.optDouble("lat"), oLon = o.optDouble("lon"), dLat = d.optDouble("lat"), dLon = d.optDouble("lon");
        double total = distance(oLat, oLon, dLat, dLon), fromOrigin = distance(oLat, oLon, f.lat, f.lon), toDest = distance(f.lat, f.lon, dLat, dLon);
        double d13 = fromOrigin / R_EARTH, t13 = bearing(oLat, oLon, f.lat, f.lon) * DEG, t12 = bearing(oLat, oLon, dLat, dLon) * DEG;
        double xtd = Math.asin(clamp(Math.sin(d13) * Math.sin(t13 - t12), -1, 1)) * R_EARTH;
        double atd = Math.acos(clamp(Math.cos(d13) / Math.cos(xtd / R_EARTH), -1, 1)) * R_EARTH;
        double progress = total > 0 ? clamp(Math.cos(t13 - t12) < 0 ? -atd / total : atd / total, -1, 2) : 0;
        double tolerance = Math.max(150000, total * .15);
        boolean heading = true;
        if (f.track != null && !f.ground && toDest > 120000) {
            double diff = Math.abs(((bearing(f.lat, f.lon, dLat, dLon) - f.track) + 540) % 360 - 180);
            heading = diff < 80;
        }
        boolean nearEnd = fromOrigin < 40000 || toDest < 40000;
        return nearEnd || (Math.abs(xtd) < tolerance && progress > -.05 && progress < 1.05 && heading);
    }

    // ——— Observations (the fields of normalizeADSB used here)

    static final class Obs {
        double lat, lon;
        Double alt, geom, gs, vr, track;
        boolean ground;
        String squawk, type, reg, id;
    }

    private static String text(JSONObject o, String k) {
        if (o == null || o.isNull(k)) return null;
        Object v = o.opt(k);
        if (!(v instanceof String)) return null;
        String s = ((String) v).trim();
        return s.isEmpty() ? null : s;
    }

    private static Double num(JSONObject o, String k) {
        if (o == null) return null;
        Object v = o.opt(k);
        return v instanceof Number ? ((Number) v).doubleValue() : null;
    }

    /** The first aircraft with a position in a readsb answer, or null. */
    static Obs first(JSONObject payload) {
        JSONArray list = payload == null ? null : payload.optJSONArray("ac");
        for (int i = 0; list != null && i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            Double lat = num(a, "lat"), lon = num(a, "lon");
            if (a == null || lat == null || lon == null || !(a.opt("hex") instanceof String)) continue;
            Obs f = new Obs();
            f.lat = lat;
            f.lon = lon;
            f.ground = "ground".equals(a.opt("alt_baro"));
            f.alt = num(a, "alt_baro");
            f.geom = num(a, "alt_geom");
            f.gs = num(a, "gs");
            f.vr = num(a, "baro_rate") != null ? num(a, "baro_rate") : num(a, "geom_rate");
            f.track = num(a, "track");
            f.squawk = text(a, "squawk");
            f.type = text(a, "t");
            f.reg = text(a, "r");
            f.id = a.optString("hex").toLowerCase(Locale.ROOT);
            return f;
        }
        return null;
    }

    // ——— Airports (the app's airports.json), for naming where a flight took off or landed

    static final class Airports {
        double[] lat, lon;
        String[] icao, iata, name, city, tz;
    }

    private static Airports airports;

    static synchronized Airports airports(Context context) {
        if (airports != null) return airports;
        Airports a = new Airports();
        try (InputStream in = context.getAssets().open("airports.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[65536];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            JSONArray list = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8)).getJSONArray("airports");
            int size = list.length();
            a.lat = new double[size]; a.lon = new double[size];
            a.icao = new String[size]; a.iata = new String[size]; a.name = new String[size]; a.city = new String[size]; a.tz = new String[size];
            for (int i = 0; i < size; i++) {
                JSONArray r = list.getJSONArray(i);
                a.icao[i] = r.optString(0); a.iata[i] = r.optString(1); a.name[i] = r.optString(2); a.city[i] = r.optString(3);
                a.lat[i] = r.optDouble(5); a.lon[i] = r.optDouble(6); a.tz[i] = r.isNull(9) ? null : r.optString(9, null);
            }
        } catch (Exception error) {
            a.lat = new double[0]; a.lon = new double[0];
            a.icao = a.iata = a.name = a.city = a.tz = new String[0];
        }
        airports = a;
        return a;
    }

    static JSONObject nearAirport(Airports a, double lat, double lon, double km) throws JSONException {
        if (a == null) return null;
        int best = -1;
        double bestDistance = Double.MAX_VALUE, box = km / 90 + .05, lonBox = box / Math.max(.1, Math.cos(lat * DEG));
        for (int i = 0; i < a.lat.length; i++) {
            if (Math.abs(a.lat[i] - lat) > box || Math.abs(a.lon[i] - lon) > lonBox) continue;
            double d = distance(lat, lon, a.lat[i], a.lon[i]);
            if (d < bestDistance) { bestDistance = d; best = i; }
        }
        if (best < 0 || bestDistance > km * 1000) return null;
        JSONObject p = new JSONObject();
        p.put("code", a.iata[best] != null && !a.iata[best].isEmpty() ? a.iata[best] : a.icao[best]);
        p.put("icao", a.icao[best]);
        p.put("name", a.name[best]);
        p.put("city", a.city[best]);
        p.put("lat", a.lat[best]);
        p.put("lon", a.lon[best]);
        p.put("tz", a.tz[best] == null ? JSONObject.NULL : a.tz[best]);
        return p;
    }

    /** place() from collection.js. */
    static JSONObject place(JSONObject a) throws JSONException {
        if (a == null) return null;
        String code = text(a, "iata");
        if (code == null) code = text(a, "code");
        if (code == null) code = text(a, "icao");
        JSONObject p = new JSONObject();
        p.put("code", code == null ? "" : code);
        p.put("icao", text(a, "icao") == null ? JSONObject.NULL : text(a, "icao"));
        p.put("name", a.optString("name", ""));
        p.put("city", a.optString("city", ""));
        p.put("lat", a.optDouble("lat"));
        p.put("lon", a.optDouble("lon"));
        p.put("tz", text(a, "tz") == null ? JSONObject.NULL : text(a, "tz"));
        return p;
    }

    private static boolean near(JSONObject p, double lat, double lon, double km) {
        if (p == null || Double.isNaN(p.optDouble("lat"))) return false;
        return distance(p.optDouble("lat"), p.optDouble("lon"), lat, lon) <= km * 1000;
    }

    // ——— evaluate / alertText / step

    private static final class Event {
        String kind, code;
        Double alt, km, time;
        JSONObject place;
    }

    private static boolean has(JSONObject leg, String kind) {
        JSONArray alerted = leg.optJSONArray("alerted");
        for (int i = 0; alerted != null && i < alerted.length(); i++) if (kind.equals(alerted.optString(i))) return true;
        return false;
    }

    private static Event tell(JSONObject leg, String kind, boolean first, List<Event> events) throws JSONException {
        if (has(leg, kind)) return new Event();
        JSONArray alerted = leg.optJSONArray("alerted");
        if (alerted == null) { alerted = new JSONArray(); leg.put("alerted", alerted); }
        alerted.put(kind);
        Event e = new Event();
        e.kind = kind;
        if (!first) events.add(e);
        return e;
    }

    private static Object orNull(Object v) { return v == null ? JSONObject.NULL : v; }

    static final class Result {
        JSONObject state;
        final List<String[]> alerts = new ArrayList<>(); // title, body, tag
    }

    /** One check of one watched item: {callsign, label, notify, route, state}. */
    static Result step(JSONObject item, Obs f, double now, Airports airports) throws JSONException {
        JSONObject route = item.optJSONObject("route");
        if (route != null && (route.optJSONObject("origin") == null || route.optJSONObject("destination") == null)) route = null;
        if (route != null && f != null && !f.ground && !routeFits(f, route.getJSONObject("origin"), route.getJSONObject("destination"))) route = null;
        JSONObject prev = item.optJSONObject("state");
        JSONObject s = prev == null ? new JSONObject() : new JSONObject(prev.toString());
        s.put("t", now);
        List<Event> events = new ArrayList<>();
        Result result = new Result();
        result.state = s;
        String prevStatus = text(prev, "status");
        if (f == null) {
            s.put("status", prevStatus != null ? "unseen" : JSONObject.NULL);
            return result;
        }
        boolean first = prevStatus == null;
        Double alt = f.alt != null ? f.alt : f.geom;
        Double prevSeen = num(prev, "seen");
        JSONObject leg = s.optJSONObject("leg");
        if (!f.ground) {
            boolean ended = leg != null && leg.optBoolean("landed") && now - leg.optDouble("endSeen", 0) > 15 * 60;
            boolean lost = prevSeen == null || now - prevSeen > 4 * 3600;
            if (leg == null || ended || lost) {
                boolean wasGround = "ground".equals(prevStatus) && prevSeen != null && now - prevSeen <= 30 * 60;
                leg = new JSONObject();
                leg.put("id", Math.round(now)); leg.put("start", now); leg.put("alerted", new JSONArray());
                leg.put("takeoffAt", JSONObject.NULL); leg.put("from", JSONObject.NULL); leg.put("to", JSONObject.NULL);
                leg.put("landed", false); leg.put("landedAt", JSONObject.NULL); leg.put("endSeen", JSONObject.NULL);
                leg.put("at", JSONObject.NULL); leg.put("logged", false);
                if (wasGround) {
                    double pLat = prev.optDouble("lat"), pLon = prev.optDouble("lon");
                    JSONObject from = nearAirport(airports, pLat, pLon, 8);
                    if (from == null && route != null && near(route.optJSONObject("origin"), pLat, pLon, 10)) from = place(route.optJSONObject("origin"));
                    leg.put("from", orNull(from));
                    if (now - prevSeen <= 5 * 60) leg.put("takeoffAt", now);
                    Event e = tell(leg, "takeoff", first, events);
                    e.alt = alt; e.place = from; e.time = leg.isNull("takeoffAt") ? null : now;
                } else {
                    tell(leg, "airborne", first, events).alt = alt;
                }
            }
            if (route != null && leg.isNull("to")) leg.put("to", place(route.optJSONObject("destination")));
            if (route != null && leg.isNull("from") && !has(leg, "takeoff")) leg.put("from", place(route.optJSONObject("origin")));
            if (!leg.isNull("to") && !leg.optBoolean("landed") && alt != null && alt < 10000 && (f.vr != null ? f.vr : 0) < -200) {
                JSONObject to = leg.getJSONObject("to");
                double km = distance(f.lat, f.lon, to.optDouble("lat"), to.optDouble("lon")) / 1000;
                if (km < 60) { Event e = tell(leg, "approach", first, events); e.alt = alt; e.km = km; e.place = to; }
            }
        } else if (leg != null && !leg.optBoolean("landed")) {
            JSONObject at = nearAirport(airports, f.lat, f.lon, 8);
            if (at == null && near(leg.optJSONObject("to"), f.lat, f.lon, 10)) at = leg.optJSONObject("to");
            if (at == null && route != null && near(route.optJSONObject("destination"), f.lat, f.lon, 10)) at = place(route.optJSONObject("destination"));
            if (at != null && (f.gs == null || f.gs < 100)) {
                leg.put("landed", true); leg.put("at", at); leg.put("endSeen", now);
                if ("airborne".equals(prevStatus) && prevSeen != null && now - prevSeen <= 5 * 60) leg.put("landedAt", now);
                Event e = tell(leg, "landed", first, events);
                e.place = at; e.time = leg.isNull("landedAt") ? null : now;
            }
        }
        if (leg != null && f.squawk != null && EMERGENCY.containsKey(f.squawk)) tell(leg, "squawk-" + f.squawk, first, events).code = f.squawk;
        s.put("status", f.ground ? "ground" : "airborne");
        s.put("seen", now); s.put("lat", f.lat); s.put("lon", f.lon);
        s.put("alt", orNull(alt)); s.put("gs", orNull(f.gs)); s.put("squawk", orNull(f.squawk));
        s.put("leg", orNull(leg));
        if (f.type != null) s.put("type", f.type);
        if (f.reg != null) s.put("reg", f.reg);
        if (f.id != null) s.put("hex", f.id);
        if (item.optBoolean("notify") && leg != null) {
            String label = item.optString("label", item.optString("callsign"));
            for (Event e : events) {
                String[] words = words(e, label);
                result.alerts.add(new String[] {words[0], words[1], item.optString("callsign") + "-" + leg.optLong("id") + "-" + e.kind});
            }
        }
        return result;
    }

    private static String code(JSONObject p) {
        String c = text(p, "code");
        if (c == null) c = text(p, "icao");
        return c == null ? p.optString("name") : c;
    }

    private static String ft(double v) { return String.format(Locale.UK, "%,d", Math.round(v)); }

    private static String timeAt(double t, String tz) {
        SimpleDateFormat format = new SimpleDateFormat("HH:mm", Locale.UK);
        if (tz != null) format.setTimeZone(TimeZone.getTimeZone(tz));
        return format.format(new Date((long) (t * 1000)));
    }

    /** alertText() from collection.js: title and body. */
    private static String[] words(Event e, String label) {
        JSONObject p = e.place;
        String tz = p == null ? null : text(p, "tz");
        switch (e.kind) {
            case "takeoff": {
                StringBuilder body = new StringBuilder();
                if (p != null) body.append("Left ").append(p.optString("name")).append('.');
                if (e.time != null) body.append(body.length() > 0 ? " " : "").append("In the air by ").append(timeAt(e.time, tz)).append(" local time.");
                if (e.alt != null) body.append(body.length() > 0 ? " " : "").append("Climbing through ").append(ft(e.alt)).append(" ft.");
                return new String[] {label + " took off" + (p != null ? " from " + code(p) : ""), body.length() > 0 ? body.toString() : "Now in the air."};
            }
            case "airborne":
                return new String[] {label + " is in the air", e.alt != null ? "Flying at " + ft(e.alt) + " ft." : "Now airborne."};
            case "approach": {
                String city = p == null ? "" : p.optString("city", "");
                return new String[] {label + " is descending into " + (city.isEmpty() ? code(p) : city),
                    Math.round(e.km) + " km from " + code(p) + ", at " + ft(e.alt) + " ft."};
            }
            case "landed":
                return new String[] {label + " landed at " + code(p),
                    p.optString("name") + "." + (e.time != null ? " On the ground by " + timeAt(e.time, tz) + " local time." : "")};
            default:
                if (e.kind.startsWith("squawk-"))
                    return new String[] {label + " is squawking " + e.code, "Transponder code " + e.code + " means " + EMERGENCY.get(e.code) + "."};
                return new String[] {label, ""};
        }
    }
}
