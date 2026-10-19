// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.2"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../../persist/node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorCommunitySafeArea", path: "../../../../persist/node_modules/@capacitor-community/safe-area"),
        .package(name: "CapacitorApp", path: "../../../../persist/node_modules/@capacitor/app"),
        .package(name: "CapacitorAppLauncher", path: "../../../../persist/node_modules/@capacitor/app-launcher"),
        .package(name: "CapacitorBrowser", path: "../../../../persist/node_modules/@capacitor/browser"),
        .package(name: "CapacitorKeyboard", path: "../../../../persist/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPushNotifications", path: "../../../../persist/node_modules/@capacitor/push-notifications"),
        .package(name: "CapacitorSplashScreen", path: "../../../../persist/node_modules/@capacitor/splash-screen"),
        .package(name: "CapgoCapacitorSocialLogin", path: "../../../../persist/node_modules/@capgo/capacitor-social-login"),
        .package(name: "AelixtoGamNative", path: "../../../../persist/node_modules/aelixto-gam-native"),
        .package(name: "SendIntent", path: "../../../../persist/node_modules/send-intent")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityInAppReview", package: "CapacitorCommunityInAppReview"),
                .product(name: "CapacitorCommunitySafeArea", package: "CapacitorCommunitySafeArea"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorAppLauncher", package: "CapacitorAppLauncher"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapgoCapacitorSocialLogin", package: "CapgoCapacitorSocialLogin"),
                .product(name: "AelixtoGamNative", package: "AelixtoGamNative"),
                .product(name: "SendIntent", package: "SendIntent")
            ]
        )
    ]
)
