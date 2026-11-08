package com.shira421.aeris;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int REQUEST_LOCATION = 1;
    private static final int REQUEST_NOTIFICATIONS = 2;
    private WebView webView;
    private final ExecutorService network = Executors.newFixedThreadPool(4);
    private final List<String> locationWaiting = new ArrayList<>();
    private final List<String> notifyWaiting = new ArrayList<>();

    /** Native HTTPS for flight data: public ADS-B endpoints often block browser (CORS) requests. */
    private final class NetBridge {
        private final Set<String> allowedHosts = new HashSet<>(Arrays.asList(
            "api.adsb.lol", "api.airplanes.live", "opendata.adsb.fi", "opensky-network.org",
            "api.adsbdb.com", "api.planespotters.net", "hexdb.io"));
        private static final int MAX_BYTES = 32 * 1024 * 1024; // OpenSky's worldwide list is a few MB

        @JavascriptInterface
        public void request(final String id, final String url, final int timeoutMs) {
            network.execute(() -> {
                long started = System.nanoTime();
                JSONObject reply = new JSONObject();
                HttpURLConnection connection = null;
                try {
                    URL target = new URL(url);
                    if (!"https".equals(target.getProtocol()) || !allowedHosts.contains(target.getHost())) {
                        throw new IllegalArgumentException("Request refused: only HTTPS flight-data hosts are allowed.");
                    }
                    connection = (HttpURLConnection) target.openConnection();
                    int timeout = Math.max(1000, Math.min(timeoutMs, 30000));
                    connection.setConnectTimeout(timeout);
                    connection.setReadTimeout(timeout);
                    connection.setUseCaches(false);
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("User-Agent", "Aeris/" + BuildConfig.VERSION_NAME + " (Android; +https://github.com/shira421/aeris)");
                    int status = connection.getResponseCode();
                    InputStream in = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    if (in != null) {
                        byte[] buffer = new byte[16384];
                        int n;
                        while ((n = in.read(buffer)) != -1) {
                            out.write(buffer, 0, n);
                            if (out.size() > MAX_BYTES) throw new IllegalStateException("Response too large");
                        }
                        in.close();
                    }
                    reply.put("status", status);
                    reply.put("body", new String(out.toByteArray(), StandardCharsets.UTF_8));
                    String date = connection.getHeaderField("Date");
                    reply.put("date", date == null ? "" : date);
                    reply.put("ms", (System.nanoTime() - started) / 1e6);
                } catch (Exception error) {
                    try { reply.put("error", String.valueOf(error.getMessage())); } catch (Exception ignored) { }
                } finally {
                    if (connection != null) connection.disconnect();
                }
                final String script = "window.__aerisNetReply&&window.__aerisNetReply(" + JSONObject.quote(id) + "," + reply + ")";
                webView.post(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
            });
        }

        /** Location, notifications and the saved-flight watch list. Replies through __aerisNetReply. */
        @JavascriptInterface
        public void device(final String id, final String json) {
            runOnUiThread(() -> handleDevice(id, json));
        }
    }

    private void handleDevice(String id, String json) {
        JSONObject message;
        try {
            message = new JSONObject(json);
        } catch (Exception error) {
            replyDevice(id, null, "Bad request");
            return;
        }
        switch (message.optString("action")) {
            case "location":
                requestLocation(id);
                break;
            case "notifyPermission":
                notificationPermission(id, message.optBoolean("request"));
                break;
            case "notify":
                FlightWatch.post(this, message.optString("title", "Aeris"), message.optString("body"), message.optString("id", "aeris"));
                replyDevice(id, true, null);
                break;
            case "watch":
                FlightWatch.setList(this, message.optJSONArray("items"));
                replyDevice(id, true, null);
                break;
            default:
                replyDevice(id, null, "Unknown action");
        }
    }

    private void replyDevice(String id, Object value, String error) {
        JSONObject reply = new JSONObject();
        try {
            if (error != null) reply.put("error", error);
            else reply.put("value", value == null ? JSONObject.NULL : value);
        } catch (Exception ignored) { }
        if (webView != null) webView.evaluateJavascript("window.__aerisNetReply&&window.__aerisNetReply(" + JSONObject.quote(id) + "," + reply + ")", null);
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocation(String id) {
        locationWaiting.add(id);
        if (locationWaiting.size() > 1) return; // already looking
        if (!hasLocationPermission()) {
            requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQUEST_LOCATION);
            return;
        }
        fetchLocation();
    }

    @SuppressLint("MissingPermission")
    private void fetchLocation() {
        final LocationManager manager = getSystemService(LocationManager.class);
        Location best = null;
        for (String provider : manager.getProviders(true)) {
            Location last = manager.getLastKnownLocation(provider);
            if (last != null && (best == null || last.getTime() > best.getTime())) best = last;
        }
        if (best != null && System.currentTimeMillis() - best.getTime() < 120000) {
            finishLocation(best, null);
            return;
        }
        String provider = manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER
            : manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER : null;
        if (provider == null) {
            finishLocation(best, best == null ? "Location is turned off on this device." : null);
            return;
        }
        final Location fallback = best;
        final Handler timeout = new Handler(Looper.getMainLooper());
        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                manager.removeUpdates(this);
                timeout.removeCallbacksAndMessages(null);
                finishLocation(location, null);
            }
            @Override public void onStatusChanged(String p, int status, Bundle extras) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        manager.requestLocationUpdates(provider, 0, 0, listener, Looper.getMainLooper());
        timeout.postDelayed(() -> {
            manager.removeUpdates(listener);
            finishLocation(fallback, fallback == null ? "Your location could not be found." : null);
        }, 15000);
    }

    private void finishLocation(Location location, String error) {
        JSONObject value = null;
        if (location != null) {
            value = new JSONObject();
            try {
                value.put("lat", location.getLatitude());
                value.put("lon", location.getLongitude());
                value.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 1000);
            } catch (Exception ignored) { }
        }
        List<String> waiting = new ArrayList<>(locationWaiting);
        locationWaiting.clear();
        for (String id : waiting) replyDevice(id, value, location == null ? (error != null ? error : "Your location could not be found.") : null);
    }

    private void notificationPermission(String id, boolean request) {
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (!request) {
                replyDevice(id, "default", null);
                return;
            }
            notifyWaiting.add(id);
            if (notifyWaiting.size() == 1) requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            return;
        }
        replyDevice(id, getSystemService(NotificationManager.class).areNotificationsEnabled() ? "granted" : "denied", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        boolean granted = false;
        for (int result : results) granted |= result == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQUEST_LOCATION) {
            if (granted) fetchLocation();
            else finishLocation(null, "Location permission was not given.");
        } else if (requestCode == REQUEST_NOTIFICATIONS) {
            List<String> waiting = new ArrayList<>(notifyWaiting);
            notifyWaiting.clear();
            String answer = granted && FlightWatch.notificationsAllowed(this) ? "granted" : "denied";
            for (String id : waiting) replyDevice(id, answer, null);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(0xfffcfcfa);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        webView.addJavascriptInterface(new NetBridge(), "AerisNative");
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("https".equals(scheme) && "appassets.androidplatform.net".equals(uri.getHost())
                    && uri.getPath() != null && uri.getPath().startsWith("/assets/")) return false;
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        // Devices without a browser keep the application open.
                    }
                }
                return true;
            }
        });
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    // Lets the page know it is hidden or visible again (it then refreshes saved flights quietly).
    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        network.shutdownNow();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
