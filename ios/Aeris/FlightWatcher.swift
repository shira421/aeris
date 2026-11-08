import BackgroundTasks
import Foundation
import UserNotifications

/// Checks saved flights that have alerts on while Aeris is in the background, and posts
/// take-off, landing and emergency notifications. iOS decides when background refresh runs
/// (from about 15 minutes to several hours apart); while Aeris is open, the web app checks
/// every minute itself and hands its latest state over here.
final class FlightWatcher {
    static let shared = FlightWatcher()
    static let taskIdentifier = "com.shira421.aeris.refresh"
    private static let storageKey = "aeris.watch"
    private static let emergencies = ["7500": "unlawful interference", "7600": "radio failure", "7700": "general emergency"]

    struct Item: Codable {
        var callsign: String
        var label: String
        var state: String?   // airborne | ground | unseen
        var squawk: String?
        var altitude: Double?
    }

    private enum Lookup {
        case failed
        case notFound
        case found(airborne: Bool, altitude: Double?, squawk: String?)
    }

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

    // MARK: Watch list

    private func load() -> [Item] {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey) else { return [] }
        return (try? JSONDecoder().decode([Item].self, from: data)) ?? []
    }

    private func save(_ items: [Item]) {
        if let data = try? JSONEncoder().encode(items) { UserDefaults.standard.set(data, forKey: Self.storageKey) }
    }

    /// Called by the web app with the flights that have alerts on and their last known state.
    func setWatchList(_ raw: [[String: Any]]) {
        let previous = Dictionary(load().map { ($0.callsign, $0) }, uniquingKeysWith: { first, _ in first })
        let items: [Item] = raw.compactMap { entry in
            guard let callsign = entry["callsign"] as? String, !callsign.isEmpty else { return nil }
            let old = previous[callsign]
            return Item(callsign: callsign,
                        label: entry["label"] as? String ?? callsign,
                        state: entry["state"] as? String ?? old?.state,
                        squawk: entry["squawk"] as? String ?? old?.squawk,
                        altitude: old?.altitude)
        }
        save(items)
        if items.isEmpty {
            BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
        } else {
            schedule()
        }
    }

    // MARK: Background refresh

    func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskIdentifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            self.handle(refresh)
        }
    }

    func schedule() {
        guard !load().isEmpty else { return }
        let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("AERIS_EVENT background refresh not scheduled: \(error.localizedDescription)")
        }
    }

    private func handle(_ task: BGAppRefreshTask) {
        schedule()
        let work = Task {
            await self.checkAll()
            task.setTaskCompleted(success: !Task.isCancelled)
        }
        task.expirationHandler = { work.cancel() }
    }

    func checkAll() async {
        var items = load()
        for index in items.indices {
            if Task.isCancelled { break }
            let item = items[index]
            switch await lookup(item.callsign) {
            case .failed:
                continue
            case .notFound:
                if item.state == "airborne", let altitude = item.altitude, altitude < 3000 {
                    notify(item, "has probably landed",
                           "Last seen at \(Int(altitude)) ft. Coverage close to the ground is limited.", kind: "probably-landed")
                }
                items[index].state = "unseen"
            case let .found(airborne, altitude, squawk):
                let now = airborne ? "airborne" : "ground"
                if item.state == "ground" && airborne {
                    notify(item, "took off", "Now airborne.", kind: "takeoff")
                } else if item.state == "unseen" && airborne {
                    notify(item, "is in the air", altitude.map { "At \(Int($0)) ft." } ?? "Now airborne.", kind: "airborne")
                } else if item.state == "airborne" && !airborne {
                    notify(item, "has landed", "On the ground.", kind: "landed")
                }
                if let squawk = squawk, let meaning = Self.emergencies[squawk], item.squawk != squawk {
                    notify(item, "is squawking \(squawk)", "Transponder code \(squawk) means \(meaning).", kind: "emergency")
                }
                items[index].state = now
                items[index].squawk = squawk
                items[index].altitude = altitude
            }
            try? await Task.sleep(nanoseconds: 1_200_000_000) // stay under the provider's rate limit
        }
        save(items)
    }

    private func lookup(_ callsign: String) async -> Lookup {
        guard let encoded = callsign.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
              let url = URL(string: "https://api.adsb.lol/v2/callsign/\(encoded)") else { return .failed }
        do {
            let (data, response) = try await session.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .failed }
            let aircraft = (json["ac"] as? [[String: Any]]) ?? []
            guard let match = aircraft.first(where: { $0["lat"] is NSNumber }) else { return .notFound }
            let onGround = (match["alt_baro"] as? String) == "ground"
            let altitude = (match["alt_baro"] as? NSNumber)?.doubleValue ?? (match["alt_geom"] as? NSNumber)?.doubleValue
            return .found(airborne: !onGround, altitude: onGround ? 0 : altitude, squawk: match["squawk"] as? String)
        } catch {
            return .failed
        }
    }

    private func notify(_ item: Item, _ title: String, _ body: String, kind: String) {
        Self.post(title: "\(item.label) \(title)", body: body, id: "\(item.callsign)-\(kind)") { _ in }
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
