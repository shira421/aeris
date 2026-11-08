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
 * Watched flights and the checks that run while Aeris is closed (every 15 minutes or so; Android
 * decides exactly when). Items have the web app's shape: {callsign, label, notify, route, state}.
 * While Aeris is open the web app checks every minute and hands its latest states here.
 */
final class FlightWatch {
    static final int JOB_ID = 4201;
    private static final String PREFS = "aeris.watch";
    private static final String KEY = "items.v2";
    private static final String CHANNEL = "flights";
    private static final Object LOCK = new Object();

    private FlightWatch() { }

    private static JSONArray load(Context context) {
        synchronized (LOCK) {
            try {
                return new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
            } catch (Exception error) {
                return new JSONArray();
            }
        }
    }

    private static void save(Context context, JSONArray items) {
        synchronized (LOCK) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, items.toString()).apply();
        }
    }

    private static double checkedAt(JSONObject item) {
        JSONObject state = item == null ? null : item.optJSONObject("state");
        return state == null ? 0 : state.optDouble("t", 0);
    }

    private static Map<String, JSONObject> byCallsign(JSONArray items) {
        Map<String, JSONObject> map = new HashMap<>();
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null) map.put(item.optString("callsign"), item);
        }
        return map;
    }

    /** From the web app. Where a background check saw a flight more recently, its state is kept. */
    static void setItems(Context context, JSONArray incoming) {
        JSONArray merged = new JSONArray();
        synchronized (LOCK) {
            Map<String, JSONObject> known = byCallsign(load(context));
            for (int i = 0; incoming != null && i < incoming.length(); i++) {
                JSONObject item = incoming.optJSONObject(i);
                if (item == null || item.optString("callsign").isEmpty()) continue;
                JSONObject old = known.get(item.optString("callsign"));
                try {
                    if (old != null && checkedAt(old) > checkedAt(item)) item.put("state", old.opt("state"));
                } catch (Exception ignored) { }
                merged.put(item);
            }
            save(context, merged);
        }
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (merged.length() == 0) {
            scheduler.cancel(JOB_ID);
        } else if (scheduler.getPendingJob(JOB_ID) == null) {
            scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, FlightCheckJob.class))
                .setPeriodic(15 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build());
        }
    }

    /** For the web app when it opens: what the background checks saw. */
    static JSONArray items(Context context) {
        return load(context);
    }

    /** Runs on a background thread. Network requests happen outside the lock. */
    static JSONObject checkAll(Context context) {
        Rules.Airports airports = Rules.airports(context);
        JSONArray items = load(context);
        Map<String, JSONObject> updated = new HashMap<>();
        int checked = 0, alerts = 0;
        for (int i = 0; i < items.length(); i++) {
            if (Thread.currentThread().isInterrupted()) break;
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String callsign = item.optString("callsign");
            JSONObject answer;
            try {
                answer = lookup(callsign);
            } catch (Exception error) {
                continue; // network trouble: try again next time
            }
            try {
                Rules.Result result = Rules.step(item, Rules.first(answer), System.currentTimeMillis() / 1000.0, airports);
                item.put("state", result.state);
                updated.put(callsign, item);
                checked++;
                for (String[] alert : result.alerts) {
                    post(context, alert[0], alert[1], alert[2]);
                    alerts++;
                }
            } catch (Exception ignored) { }
            if (i < items.length() - 1) {
                try {
                    Thread.sleep(1200); // stay under the provider's rate limit
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        // Write back only newer states: the web app may have sent fresher ones meanwhile.
        synchronized (LOCK) {
            JSONArray current = load(context);
            for (int i = 0; i < current.length(); i++) {
                JSONObject item = current.optJSONObject(i);
                JSONObject mine = item == null ? null : updated.get(item.optString("callsign"));
                try {
                    if (mine != null && checkedAt(mine) > checkedAt(item)) item.put("state", mine.opt("state"));
                } catch (Exception ignored) { }
            }
            save(context, current);
        }
        JSONObject summary = new JSONObject();
        try {
            summary.put("items", items.length());
            summary.put("checked", checked);
            summary.put("alerts", alerts);
        } catch (Exception ignored) { }
        return summary;
    }

    /** The live sources' answer for a callsign: adsb.lol, or adsb.fi when adsb.lol is busy. Throws when neither answers. */
    private static JSONObject lookup(String callsign) throws Exception {
        Exception last = null;
        for (String base : new String[] {"https://api.adsb.lol/v2/callsign/", "https://opendata.adsb.fi/api/v2/callsign/"}) {
            try {
                return fetchJson(base + URLEncoder.encode(callsign, "UTF-8"));
            } catch (Exception error) {
                last = error;
            }
        }
        throw last;
    }

    private static JSONObject fetchJson(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
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
            return new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
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
            channel.setDescription("Take-off, landing and emergencies for your flights");
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
