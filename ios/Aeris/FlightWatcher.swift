import BackgroundTasks
import Foundation
import JavaScriptCore
import UserNotifications

/// Checks watched flights while Aeris is in the background. The alert rules are the web app's own
/// (web/rules.js, run in JavaScriptCore), so a flight is described the same way open or closed, and
/// each alert is sent once per flight whichever side notices first. iOS decides when background
/// refresh runs, from about 15 minutes to several hours apart.
final class FlightWatcher {
    static let shared = FlightWatcher()
    static let taskIdentifier = "com.shira421.aeris.refresh"
    private static let storageKey = "aeris.watch.v2"

    /// All item state lives on this queue.
    private let queue = DispatchQueue(label: "com.shira421.aeris.flight-watcher")
    private var rules: JSContext?

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        config.httpAdditionalHeaders = [
            "User-Agent": "Aeris/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0") (iOS background; +https://github.com/shira421/aeris)",
            "Accept": "application/json"
        ]
        return URLSession(configuration: config)
    }()

    final class Cancel {
        private let lock = NSLock()
        private var cancelled = false
        var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
        func cancel() { lock.lock(); cancelled = true; lock.unlock() }
    }

    // MARK: Items: [{callsign, label, notify, route, state}], the same shape the web app sends

    private func load() -> [[String: Any]] {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
        return items
    }

    private func save(_ items: [[String: Any]]) {
        guard JSONSerialization.isValidJSONObject(items),
              let data = try? JSONSerialization.data(withJSONObject: items) else { return }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }

    private static func checkedAt(_ item: [String: Any]) -> Double {
        ((item["state"] as? [String: Any])?["t"] as? NSNumber)?.doubleValue ?? 0
    }

    /// From the web app. Where a background check saw a flight more recently, its state is kept.
    func setItems(_ incoming: [[String: Any]]) {
        queue.async {
            var known: [String: [String: Any]] = [:]
            for item in self.load() { if let callsign = item["callsign"] as? String { known[callsign] = item } }
            let merged: [[String: Any]] = incoming.compactMap { item in
                guard let callsign = item["callsign"] as? String else { return nil }
                var out = item
                if let old = known[callsign], Self.checkedAt(old) > Self.checkedAt(item) { out["state"] = old["state"] }
                return out
            }
            self.save(merged)
        }
    }

    /// For the web app when it opens: what the background checks saw.
    func items(_ done: @escaping ([[String: Any]]) -> Void) {
        queue.async { done(self.load()) }
    }

    // MARK: Background refresh

    func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskIdentifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            self.handle(refresh)
        }
    }

    /// Ask iOS for the next background check (when there is anything to watch).
    func schedule() {
        queue.async {
            if self.load().isEmpty {
                BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
                return
            }
            let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
            request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
            do {
                try BGTaskScheduler.shared.submit(request)
            } catch {
                print("AERIS_EVENT background refresh not scheduled: \(error.localizedDescription)")
            }
        }
    }

    private func handle(_ task: BGAppRefreshTask) {
        schedule()
        let cancel = Cancel()
        task.expirationHandler = { cancel.cancel() }
        queue.async {
            _ = self.checkAll(cancel)
            task.setTaskCompleted(success: !cancel.isCancelled)
        }
    }

    /// One check of every item, now (the simulator test uses this).
    func runNow(_ done: @escaping ([String: Any]) -> Void) {
        queue.async { done(self.checkAll(Cancel())) }
    }

    // MARK: Checking

    private func loadRules() -> JSContext? {
        if let rules = rules { return rules }
        guard let web = Bundle.main.url(forResource: "web", withExtension: nil),
              let source = try? String(contentsOf: web.appendingPathComponent("rules.js"), encoding: .utf8),
              let context = JSContext() else { return nil }
        context.exceptionHandler = { _, exception in
            print("AERIS_EVENT rules error: \(exception?.toString() ?? "unknown")")
        }
        context.evaluateScript(source)
        guard let api = context.objectForKeyedSubscript("AerisRules"), !api.isUndefined else { return nil }
        if let airports = try? String(contentsOf: web.appendingPathComponent("airports.json"), encoding: .utf8) {
            _ = api.invokeMethod("init", withArguments: [airports])
        }
        rules = context
        return context
    }

    /// Runs on `queue`. Returns a short summary.
    private func checkAll(_ cancel: Cancel) -> [String: Any] {
        guard let api = loadRules()?.objectForKeyedSubscript("AerisRules") else { return ["rules": false] }
        var items = load()
        var checked = 0, alerts = 0
        for index in items.indices {
            if cancel.isCancelled { break }
            guard let callsign = items[index]["callsign"] as? String,
                  JSONSerialization.isValidJSONObject(items[index]),
                  let itemData = try? JSONSerialization.data(withJSONObject: items[index]),
                  let itemText = String(data: itemData, encoding: .utf8) else { continue }
            guard let response = fetch(callsign) else { continue } // network trouble: try again next time
            let now = Date().timeIntervalSince1970
            guard let resultText = api.invokeMethod("check", withArguments: [itemText, response, now])?.toString(),
                  let resultData = resultText.data(using: .utf8),
                  let result = try? JSONSerialization.jsonObject(with: resultData) as? [String: Any],
                  let item = result["item"] as? [String: Any] else { continue }
            items[index] = item
            checked += 1
            for alert in (result["alerts"] as? [[String: Any]]) ?? [] {
                guard let title = alert["title"] as? String else { continue }
                Self.post(title: title, body: alert["body"] as? String ?? "", id: alert["tag"] as? String ?? UUID().uuidString) { _ in }
                alerts += 1
            }
            if index < items.count - 1 { Thread.sleep(forTimeInterval: 1.2) } // stay under the provider's rate limit
        }
        save(items)
        return ["rules": true, "items": items.count, "checked": checked, "alerts": alerts]
    }

    /// adsb.lol's answer for a callsign (an empty list when it is not in the air), or nil on failure.
    private func fetch(_ callsign: String) -> String? {
        guard let encoded = callsign.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
              let url = URL(string: "https://api.adsb.lol/v2/callsign/\(encoded)") else { return nil }
        let done = DispatchSemaphore(value: 0)
        var text: String?
        session.dataTask(with: url) { data, response, _ in
            if (response as? HTTPURLResponse)?.statusCode == 200, let data = data { text = String(data: data, encoding: .utf8) }
            done.signal()
        }.resume()
        _ = done.wait(timeout: .now() + 16)
        return text
    }

    static func post(title: String, body: String, id: String, completion: @escaping (Error?) -> Void) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.threadIdentifier = "flights"
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: nil),
                                               withCompletionHandler: completion)
    }
}
