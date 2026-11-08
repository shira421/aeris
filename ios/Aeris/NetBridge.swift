import Foundation
import WebKit

/// Lets the web app fetch flight data natively. Browsers block many public ADS-B
/// endpoints with CORS; native requests are not subject to it. Only HTTPS requests to
/// the hosts below are allowed, and responses are returned as text.
final class NetBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let allowedHosts: Set<String> = [
        "api.adsb.lol", "api.airplanes.live", "opendata.adsb.fi", "opensky-network.org",
        "api.adsbdb.com", "api.planespotters.net", "hexdb.io"
    ]
    private static let maxBytes = 32 * 1024 * 1024 // OpenSky's worldwide list is a few MB

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 12
        config.timeoutIntervalForResource = 30
        config.httpMaximumConnectionsPerHost = 4
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpAdditionalHeaders = [
            "User-Agent": "Aeris/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0") (iOS; +https://github.com/shira421/aeris)",
            "Accept": "application/json"
        ]
        return URLSession(configuration: config)
    }()

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any],
              let raw = body["url"] as? String,
              let url = URL(string: raw),
              url.scheme == "https",
              let host = url.host, Self.allowedHosts.contains(host) else {
            replyHandler(nil, "Request refused: only HTTPS flight-data hosts are allowed.")
            return
        }
        var request = URLRequest(url: url)
        if let timeout = body["timeout"] as? Double { request.timeoutInterval = max(1, min(timeout / 1000, 30)) }
        let started = Date()
        session.dataTask(with: request) { data, response, error in
            let reply: (Any?, String?)
            if let error = error {
                reply = (nil, error.localizedDescription)
            } else if let http = response as? HTTPURLResponse {
                let bytes = data ?? Data()
                if bytes.count > Self.maxBytes {
                    reply = (nil, "Response too large")
                } else {
                    reply = ([
                        "status": http.statusCode,
                        "body": String(decoding: bytes, as: UTF8.self),
                        "date": http.value(forHTTPHeaderField: "Date") ?? "",
                        "ms": Date().timeIntervalSince(started) * 1000
                    ], nil)
                }
            } else {
                reply = (nil, "No response")
            }
            DispatchQueue.main.async { replyHandler(reply.0, reply.1) }
        }.resume()
    }
}
