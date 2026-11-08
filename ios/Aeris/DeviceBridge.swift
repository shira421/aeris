import CoreLocation
import Foundation
import UserNotifications
import WebKit

/// Calls a WebKit reply handler exactly once, on the main thread. WebKit stops the app when a reply
/// handler is called twice or released without being called, so every answer goes through here.
final class Reply {
    private var handler: ((Any?, String?) -> Void)?

    init(_ handler: @escaping (Any?, String?) -> Void) { self.handler = handler }

    func send(_ value: Any?) { finish(value ?? NSNull(), nil) }
    func fail(_ message: String) { finish(nil, message) }

    private func finish(_ value: Any?, _ error: String?) {
        let deliver = { [self] in
            guard let handler = handler else { return }
            self.handler = nil
            handler(value, error)
        }
        if Thread.isMainThread { deliver() } else { DispatchQueue.main.async(execute: deliver) }
    }

    deinit {
        if let handler = handler {
            DispatchQueue.main.async { handler(nil, "No answer from the app.") }
        }
    }
}

/// Location, notifications and the background flight checks for the web app
/// (`window.webkit.messageHandlers.aerisDevice`). Each message carries an `action`.
final class DeviceBridge: NSObject, WKScriptMessageHandlerWithReply, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var locationReplies: [Reply] = []
    private var awaitingAuthorization = false

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let reply = Reply(replyHandler)
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            reply.fail("Bad request")
            return
        }
        switch action {
        case "location":
            requestLocation(reply)
        case "notifyPermission":
            notificationPermission(request: (body["request"] as? Bool) ?? false, reply)
        case "notify":
            FlightWatcher.post(title: body["title"] as? String ?? "Aeris",
                               body: body["body"] as? String ?? "",
                               id: body["id"] as? String ?? UUID().uuidString) { error in
                if let error = error { reply.fail(error.localizedDescription) } else { reply.send(true) }
            }
        case "watch":
            FlightWatcher.shared.setItems(body["items"] as? [[String: Any]] ?? [])
            reply.send(true)
        case "watchState":
            FlightWatcher.shared.items { reply.send($0) }
        case "runChecks":
            // Used by the simulator test: one background check, now.
            FlightWatcher.shared.runNow { reply.send($0) }
        default:
            reply.fail("Unknown action \(action)")
        }
    }

    // MARK: Location (when in use)

    private func requestLocation(_ reply: Reply) {
        locationReplies.append(reply)
        guard locationReplies.count == 1 else { return } // already looking
        switch locationManager.authorizationStatus {
        case .notDetermined:
            awaitingAuthorization = true
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            finishLocation(nil, "Location is off for Aeris. You can turn it on in Settings › Aeris › Location.")
        default:
            locationManager.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard awaitingAuthorization else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            return
        case .denied, .restricted:
            awaitingAuthorization = false
            finishLocation(nil, "Location permission was not given.")
        default:
            awaitingAuthorization = false
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        finishLocation(["lat": last.coordinate.latitude, "lon": last.coordinate.longitude,
                        "accuracy": last.horizontalAccuracy], nil)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finishLocation(nil, "Your location could not be found.")
    }

    private func finishLocation(_ value: [String: Double]?, _ error: String?) {
        let replies = locationReplies
        locationReplies = []
        for reply in replies {
            if let value = value { reply.send(value) } else { reply.fail(error ?? "Your location could not be found.") }
        }
    }

    // MARK: Notifications

    private func notificationPermission(request: Bool, _ reply: Reply) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                reply.send("granted")
            case .denied:
                reply.send("denied")
            case .notDetermined:
                guard request else { reply.send("default"); return }
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    reply.send(granted ? "granted" : "denied")
                }
            @unknown default:
                reply.send("default")
            }
        }
    }
}
