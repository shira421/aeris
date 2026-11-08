import CoreLocation
import Foundation
import UserNotifications
import WebKit

/// Location, notifications and the background watch list for the web app
/// (`window.webkit.messageHandlers.aerisDevice`). Each message carries an `action`.
final class DeviceBridge: NSObject, WKScriptMessageHandlerWithReply, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var locationReplies: [(Any?, String?) -> Void] = []
    private var awaitingAuthorization = false

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "Bad request")
            return
        }
        switch action {
        case "location":
            requestLocation(replyHandler)
        case "notifyPermission":
            notificationPermission(request: body["request"] as? Bool ?? false, replyHandler)
        case "notify":
            post(title: body["title"] as? String ?? "Aeris",
                 body: body["body"] as? String ?? "",
                 id: body["id"] as? String ?? UUID().uuidString,
                 replyHandler)
        case "watch":
            FlightWatcher.shared.setWatchList(body["items"] as? [[String: Any]] ?? [])
            replyHandler(true, nil)
        default:
            replyHandler(nil, "Unknown action \(action)")
        }
    }

    // MARK: Location (when in use)

    private func requestLocation(_ reply: @escaping (Any?, String?) -> Void) {
        locationReplies.append(reply)
        guard locationReplies.count == 1 else { return } // a request is already running
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

    private func finishLocation(_ value: Any?, _ error: String?) {
        let replies = locationReplies
        locationReplies = []
        replies.forEach { $0(value, error) }
    }

    // MARK: Notifications

    private func notificationPermission(request: Bool, _ reply: @escaping (Any?, String?) -> Void) {
        let center = UNUserNotificationCenter.current()
        let answer: (String) -> Void = { value in DispatchQueue.main.async { reply(value, nil) } }
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                answer("granted")
            case .denied:
                answer("denied")
            case .notDetermined:
                if request {
                    center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                        answer(granted ? "granted" : "denied")
                    }
                } else {
                    answer("default")
                }
            @unknown default:
                answer("default")
            }
        }
    }

    private func post(title: String, body: String, id: String, _ reply: @escaping (Any?, String?) -> Void) {
        FlightWatcher.post(title: title, body: body, id: id) { error in
            DispatchQueue.main.async {
                if let error = error { reply(nil, error.localizedDescription) } else { reply(true, nil) }
            }
        }
    }
}
