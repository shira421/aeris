import UIKit
import WebKit

/// Hosts the bundled Aeris web app. Pages are served from the app bundle through the
/// `aeris://app/` scheme so the app works offline and keeps a stable origin for storage.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let net = NetBridge()
    private let device = DeviceBridge()
    private let selfTest = ProcessInfo.processInfo.arguments.contains("-AerisSelfTest")

    override func loadView() {
        let config = WKWebViewConfiguration()
        let webRoot = Bundle.main.url(forResource: "web", withExtension: nil)!
        config.setURLSchemeHandler(AssetSchemeHandler(root: webRoot), forURLScheme: AssetSchemeHandler.scheme)
        config.userContentController.addScriptMessageHandler(net, contentWorld: .page, name: "aerisNet")
        config.userContentController.addScriptMessageHandler(device, contentWorld: .page, name: "aerisDevice")
        // Record script errors from the first line on, so a failed start can be diagnosed.
        let errorHook = "window.__aerisErrors=[];addEventListener('error',function(e){__aerisErrors.push(String(e.message)+' @'+String(e.filename||'').split('/').pop()+':'+e.lineno)});addEventListener('unhandledrejection',function(e){__aerisErrors.push('rejection: '+String(e.reason&&e.reason.message||e.reason))});"
        config.userContentController.addUserScript(WKUserScript(source: errorHook, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.applicationNameForUserAgent = "AerisApp/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0")"

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 0.988, green: 0.988, blue: 0.980, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        // The page lays itself out with env(safe-area-inset-*); stop UIKit adding its own insets.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let page = selfTest ? "index.html?selftest=1" : "index.html"
        webView.load(URLRequest(url: URL(string: "\(AssetSchemeHandler.scheme)://app/\(page)")!))
        if selfTest { scheduleSelfTest() }
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    // Keep app pages inside the web view; open everything else in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if url.scheme == AssetSchemeHandler.scheme || url.scheme == "blob" || url.scheme == "about" || url.scheme == "data" {
            return decisionHandler(.allow)
        }
        if ["http", "https", "mailto"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    // target="_blank" links arrive here; send them to Safari instead of opening a new web view.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
        return nil
    }

    private var terminations: [Date] = []

    // iOS may stop the web content process under memory pressure. Reload, but not in a loop.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let now = Date()
        terminations = terminations.filter { now.timeIntervalSince($0) < 60 } + [now]
        print("AERIS_EVENT web content process terminated (\(terminations.count) in the last minute)"); fflush(stdout)
        if terminations.count <= 3 { webView.reload() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("AERIS_EVENT page loaded \(webView.url?.absoluteString ?? "")"); fflush(stdout)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("AERIS_EVENT navigation failed: \(error.localizedDescription)"); fflush(stdout)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("AERIS_EVENT provisional navigation failed: \(error.localizedDescription)"); fflush(stdout)
    }

    /// CI smoke test: prints what the app shows after start-up, so a simulator run can
    /// confirm the bundle loads and live data arrives through the native bridge.
    private func scheduleSelfTest() {
        for delay in [10.0, 25.0, 45.0, 70.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                let js = "JSON.stringify(window.__aerisSelfTest ? Object.assign(window.__aerisSelfTest(), {errors: window.__aerisErrors}) : {loaded: !!document.querySelector('#app .topbar'), readyState: document.readyState, href: location.href, scripts: document.scripts.length, body: document.body ? document.body.innerHTML.length : -1, errors: window.__aerisErrors})"
                self?.webView.evaluateJavaScript(js) { result, error in
                    print("AERIS_SELFTEST t=\(Int(delay)) \(result as? String ?? "nil") \(error.map { String(describing: $0) } ?? "")")
                    fflush(stdout)
                }
            }
        }
    }
}
