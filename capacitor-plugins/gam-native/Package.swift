// swift-tools-version: 5.9
import PackageDescription

// Swift Package Manager manifest so Capacitor 8 iOS projects (SPM by default)
// can link this plugin. Google SDKs pinned to the 11.x / 2.x API names the
// Swift source uses (GADMobileAds, UMPConsentInformation…).
let package = Package(
    name: "AelixtoGamNative",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "AelixtoGamNative", targets: ["GamNativePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git", "11.10.0"..<"12.0.0"),
        .package(url: "https://github.com/googleads/swift-package-manager-google-user-messaging-platform.git", "2.6.0"..<"3.0.0")
    ],
    targets: [
        .target(
            name: "GamNativePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads"),
                .product(name: "GoogleUserMessagingPlatform", package: "swift-package-manager-google-user-messaging-platform")
            ],
            path: "ios/Plugin")
    ]
)
