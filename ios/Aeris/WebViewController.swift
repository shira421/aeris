import UIKit
import WebKit

/// Hosts the bundled Aeris web app. Pages are served from the app bundle through the
/// `aeris://app/` scheme so the app works offline and keeps a stable origin for storage.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let net = NetBridge()
    private let selfTest = ProcessInfo.processInfo.arguments.contains("-AerisSelfTest")

    override func loadView() {
        let config = WKWebViewConfiguration()
        let webRoot = Bundle.main.url(forResource: "web", withExtension: nil)!
        config.setURLSchemeHandler(AssetSchemeHandler(root: webRoot), forURLScheme: AssetSchemeHandler.scheme)
        config.userContentController.addScriptMessageHandler(net, contentWorld: .page, name: "aerisNet")
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

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    /// CI smoke test: prints what the app shows after start-up, so a simulator run can
    /// confirm the bundle loads and live data arrives through the native bridge.
    private func scheduleSelfTest() {
        for delay in [8.0, 20.0, 35.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                let js = "JSON.stringify(window.__aerisSelfTest ? window.__aerisSelfTest() : {loaded: !!document.querySelector('#app .topbar')})"
                self?.webView.evaluateJavaScript(js) { result, error in
                    print("AERIS_SELFTEST t=\(Int(delay)) \(result as? String ?? "nil") \(error.map { String(describing: $0) } ?? "")")
                    fflush(stdout)
                }
            }
        }
    }
}
