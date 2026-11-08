import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = WebViewController()
        window.backgroundColor = UIColor(red: 0.988, green: 0.988, blue: 0.980, alpha: 1)
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
