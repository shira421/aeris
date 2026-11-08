package com.shira421.aeris;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Saved flights with alerts on, and the checks that run while Aeris is in the background
 * (every 15 minutes or so; Android decides exactly when). While Aeris is open the web app
 * checks every minute itself and passes its latest state here.
 */
final class FlightWatch {
    static final int JOB_ID = 4201;
    private static final String PREFS = "aeris.watch";
    private static final String CHANNEL = "flights";
    private static final Map<String, String> EMERGENCIES = new HashMap<>();
    static {
        EMERGENCIES.put("7500", "unlawful interference");
        EMERGENCIES.put("7600", "radio failure");
        EMERGENCIES.put("7700", "general emergency");
    }

    private FlightWatch() { }

    private static String text(JSONObject o, String key) {
        return o == null || o.isNull(key) ? null : o.optString(key, null);
    }

    private static JSONArray load(Context context) {
        try {
            return new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("items", "[]"));
        } catch (Exception error) {
            return new JSONArray();
        }
    }

    private static void save(Context context, JSONArray items) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("items", items.toString()).apply();
    }

    /** The web app's list of flights with alerts on, with their last known state. */
    static synchronized void setList(Context context, JSONArray raw) {
        JSONArray previous = load(context);
        Map<String, JSONObject> old = new HashMap<>();
        for (int i = 0; i < previous.length(); i++) {
            JSONObject item = previous.optJSONObject(i);
            if (item != null) old.put(item.optString("callsign"), item);
        }
        JSONArray items = new JSONArray();
        for (int i = 0; raw != null && i < raw.length(); i++) {
            JSONObject entry = raw.optJSONObject(i);
            String callsign = text(entry, "callsign");
            if (callsign == null || callsign.isEmpty()) continue;
            JSONObject before = old.get(callsign);
            try {
                JSONObject item = new JSONObject();
                item.put("callsign", callsign);
                item.put("label", entry.optString("label", callsign));
                String state = text(entry, "state");
                item.put("state", state != null ? state : text(before, "state"));
                String squawk = text(entry, "squawk");
                item.put("squawk", squawk != null ? squawk : text(before, "squawk"));
                if (before != null && !before.isNull("altitude")) item.put("altitude", before.optDouble("altitude"));
                items.put(item);
            } catch (Exception ignored) { }
        }
        save(context, items);
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (items.length() == 0) {
            scheduler.cancel(JOB_ID);
        } else if (scheduler.getPendingJob(JOB_ID) == null) {
            scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, FlightCheckJob.class))
                .setPeriodic(15 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build());
        }
    }

    /** Runs on a background thread. */
    static synchronized void checkAll(Context context) {
        JSONArray items = load(context);
        for (int i = 0; i < items.length(); i++) {
            if (Thread.currentThread().isInterrupted()) break;
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String callsign = item.optString("callsign");
            String label = item.optString("label", callsign);
            String before = text(item, "state");
            JSONObject found;
            try {
                found = lookup(callsign);
            } catch (Exception error) {
                continue; // network trouble: try again next time
            }
            try {
                if (found == null) {
                    if ("airborne".equals(before) && !item.isNull("altitude") && item.optDouble("altitude") < 3000) {
                        post(context, label + " has probably landed",
                            "Last seen at " + Math.round(item.optDouble("altitude")) + " ft. Coverage close to the ground is limited.",
                            callsign + "-probably-landed");
                    }
                    item.put("state", "unseen");
                } else {
                    Object baro = found.opt("alt_baro");
                    boolean onGround = "ground".equals(baro);
                    Object geometric = found.opt("alt_geom");
                    Double altitude = null;
                    if (onGround) altitude = 0.0;
                    else if (baro instanceof Number) altitude = ((Number) baro).doubleValue();
                    else if (geometric instanceof Number) altitude = ((Number) geometric).doubleValue();
                    String squawk = text(found, "squawk");
                    if ("ground".equals(before) && !onGround) {
                        post(context, label + " took off", "Now airborne.", callsign + "-takeoff");
                    } else if ("unseen".equals(before) && !onGround) {
                        post(context, label + " is in the air", altitude != null ? "At " + Math.round(altitude) + " ft." : "Now airborne.", callsign + "-airborne");
                    } else if ("airborne".equals(before) && onGround) {
                        post(context, label + " has landed", "On the ground.", callsign + "-landed");
                    }
                    if (squawk != null && EMERGENCIES.containsKey(squawk) && !squawk.equals(text(item, "squawk"))) {
                        post(context, label + " is squawking " + squawk,
                            "Transponder code " + squawk + " means " + EMERGENCIES.get(squawk) + ".", callsign + "-emergency");
                    }
                    item.put("state", onGround ? "ground" : "airborne");
                    item.put("squawk", squawk == null ? JSONObject.NULL : squawk);
                    item.put("altitude", altitude == null ? JSONObject.NULL : altitude);
                }
            } catch (Exception ignored) { }
            try {
                Thread.sleep(1200); // stay under the provider's rate limit
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        }
        save(context, items);
    }

    /** The aircraft flying this callsign now, or null if none is. Throws on network errors. */
    private static JSONObject lookup(String callsign) throws Exception {
        URL url = new URL("https://api.adsb.lol/v2/callsign/" + URLEncoder.encode(callsign, "UTF-8"));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "Aeris/" + BuildConfig.VERSION_NAME + " (Android background; +https://github.com/shira421/aeris)");
            if (connection.getResponseCode() != 200) throw new IllegalStateException("HTTP " + connection.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = connection.getInputStream()) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            }
            JSONArray aircraft = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8)).optJSONArray("ac");
            for (int i = 0; aircraft != null && i < aircraft.length(); i++) {
                JSONObject a = aircraft.optJSONObject(i);
                if (a != null && a.opt("lat") instanceof Number) return a;
            }
            return null;
        } finally {
            connection.disconnect();
        }
    }

    static boolean notificationsAllowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33
            && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        return context.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    /** Shows a flight alert. The same tag replaces an earlier alert of the same kind. */
    static void post(Context context, String title, String body, String tag) {
        if (!notificationsAllowed(context)) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Flight alerts", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Take-off, landing and emergencies for your saved flights");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setCategory(Notification.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .build();
        manager.notify(tag, 1, notification);
    }
}
