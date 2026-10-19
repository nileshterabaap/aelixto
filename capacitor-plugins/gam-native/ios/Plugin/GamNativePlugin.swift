import Foundation
import Capacitor
import GoogleMobileAds
import UserMessagingPlatform
import AppTrackingTransparency
import AdSupport

/**
 * Google Ad Manager (AdX) native ad plugin.
 *
 * Uses `GADAdLoader` with `GAMRequest` to request unified native ads from
 * Ad Manager `/NETWORK_CODE/unit_name` inventory. Creatives are cached by a
 * per-load `adId` handle so JS can trigger impression + click reporting.
 */
@objc(GamNativePlugin)
public class GamNativePlugin: CAPPlugin, CAPBridgedPlugin, GADNativeAdLoaderDelegate, GADAdLoaderDelegate {

    public let identifier = "GamNativePlugin"
    public let jsName = "GamNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestConsentInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showConsentFormIfRequired", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showPrivacyOptionsForm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTrackingAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadNativeAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentNativeAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateNativeAdFrame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroyAd", returnType: CAPPluginReturnPromise)
    ]

    private var pendingLoads: [String: CAPPluginCall] = [:]
    private var loaders: [String: GADAdLoader] = [:]
    private var ads: [String: GADNativeAd] = [:]
    private var adViews: [String: GADNativeAdView] = [:]

    // MARK: - Init

    @objc func initialize(_ call: CAPPluginCall) {
        GADMobileAds.sharedInstance().start { _ in
            call.resolve(["status": "ready"])
        }
    }

    // MARK: - Consent (UMP / Funding Choices)

    @objc func requestConsentInfo(_ call: CAPPluginCall) {
        let params = UMPRequestParameters()
        params.tagForUnderAgeOfConsent = false
        UMPConsentInformation.sharedInstance.requestConsentInfoUpdate(with: params) { error in
            if let error = error {
                call.reject("UMP requestConsentInfoUpdate failed: \(error.localizedDescription)")
                return
            }
            let status = UMPConsentInformation.sharedInstance.consentStatus
            let formAvailable = UMPConsentInformation.sharedInstance.formStatus == .available
            call.resolve([
                "status": self.mapConsentStatus(status),
                "isConsentFormAvailable": formAvailable,
                "privacyOptionsRequired":
                    UMPConsentInformation.sharedInstance.privacyOptionsRequirementStatus == .required
            ])
        }
    }

    @objc func showConsentFormIfRequired(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UMPConsentForm.loadAndPresentIfRequired(from: self.bridge?.viewController) { error in
                if let error = error {
                    call.reject("UMP showConsentForm failed: \(error.localizedDescription)")
                    return
                }
                call.resolve(["shown": true])
            }
        }
    }

    @objc func showPrivacyOptionsForm(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UMPConsentForm.presentPrivacyOptionsForm(from: self.bridge?.viewController) { error in
                if let error = error {
                    call.reject("UMP presentPrivacyOptionsForm failed: \(error.localizedDescription)")
                    return
                }
                call.resolve()
            }
        }
    }

    private func mapConsentStatus(_ s: UMPConsentStatus) -> String {
        switch s {
        case .required: return "REQUIRED"
        case .notRequired: return "NOT_REQUIRED"
        case .obtained: return "OBTAINED"
        default: return "UNKNOWN"
        }
    }

    // MARK: - ATT

    @objc func requestTrackingAuthorization(_ call: CAPPluginCall) {
        if #available(iOS 14, *) {
            ATTrackingManager.requestTrackingAuthorization { status in
                let str: String
                switch status {
                case .authorized: str = "authorized"
                case .denied: str = "denied"
                case .restricted: str = "restricted"
                case .notDetermined: str = "notDetermined"
                @unknown default: str = "unavailable"
                }
                call.resolve(["status": str])
            }
        } else {
            call.resolve(["status": "unavailable"])
        }
    }

    // MARK: - Native ad loading

    @objc func loadNativeAd(_ call: CAPPluginCall) {
        guard let adUnitId = call.getString("adUnitId"), !adUnitId.isEmpty else {
            call.reject("adUnitId is required")
            return
        }
        let adId = UUID().uuidString
        pendingLoads[adId] = call

        DispatchQueue.main.async {
            let options = GADNativeAdImageAdLoaderOptions()
            options.disableImageLoading = false

            let loader = GADAdLoader(
                adUnitID: adUnitId,
                rootViewController: self.bridge?.viewController,
                adTypes: [.native],
                options: [options]
            )
            loader.delegate = self
            // Tag the loader so callbacks can find the pending call.
            objc_setAssociatedObject(loader, &AssocKeys.adId, adId, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            self.loaders[adId] = loader

            // GAMRequest = Ad Manager (AdX) request path.
            let request = GAMRequest()
            loader.load(request)
        }
    }

    // MARK: - GADAdLoaderDelegate

    public func adLoader(_ adLoader: GADAdLoader, didFailToReceiveAdWithError error: Error) {
        guard let adId = objc_getAssociatedObject(adLoader, &AssocKeys.adId) as? String,
              let call = pendingLoads.removeValue(forKey: adId) else { return }
        loaders.removeValue(forKey: adId)
        // Resolve `null` on no-fill so JS can gracefully unmount the slot.
        call.resolve()
    }

    // MARK: - GADNativeAdLoaderDelegate

    public func adLoader(_ adLoader: GADAdLoader, didReceive nativeAd: GADNativeAd) {
        guard let adId = objc_getAssociatedObject(adLoader, &AssocKeys.adId) as? String,
              let call = pendingLoads.removeValue(forKey: adId) else { return }
        loaders.removeValue(forKey: adId)
        ads[adId] = nativeAd

        var payload: [String: Any] = ["adId": adId]
        if let h = nativeAd.headline { payload["headline"] = h }
        if let b = nativeAd.body { payload["body"] = b }
        if let a = nativeAd.advertiser { payload["advertiser"] = a }
        if let c = nativeAd.callToAction { payload["callToAction"] = c }
        if let icon = nativeAd.icon?.imageURL?.absoluteString { payload["iconUrl"] = icon }
        if let firstImage = nativeAd.images?.first?.imageURL?.absoluteString { payload["imageUrl"] = firstImage }
        if nativeAd.mediaContent.aspectRatio > 0 { payload["mediaAspectRatio"] = Double(nativeAd.mediaContent.aspectRatio) }
        if let s = nativeAd.starRating?.doubleValue { payload["starRating"] = s }
        if let p = nativeAd.price { payload["price"] = p }
        if let store = nativeAd.store { payload["store"] = store }
        if let info = nativeAd.responseInfo?.responseIdentifier { payload["responseInfo"] = info }
        call.resolve(payload)
    }

    // MARK: - Native overlay (real GADNativeAdView, full SDK tracking)

    @objc func presentNativeAd(_ call: CAPPluginCall) {
        guard let adId = call.getString("adId"), let ad = ads[adId] else {
            call.reject("ad not found"); return
        }
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)
        let w = CGFloat(call.getDouble("width") ?? 0)
        let h = CGFloat(call.getDouble("height") ?? 0)
        let fadeDuration = Double(call.getInt("fadeInDurationMs") ?? 0) / 1000
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController?.view else { call.reject("no view"); return }
            self.adViews[adId]?.removeFromSuperview()
            let adView = self.buildNativeAdView(ad: ad)
            adView.frame = CGRect(x: x, y: y, width: w, height: h)
            if fadeDuration > 0 { adView.alpha = 0 }
            host.addSubview(adView)
            if fadeDuration > 0 {
                UIView.animate(withDuration: fadeDuration) { adView.alpha = 1 }
            }
            self.adViews[adId] = adView
            call.resolve()
        }
    }

    @objc func updateNativeAdFrame(_ call: CAPPluginCall) {
        guard let adId = call.getString("adId") else { call.resolve(); return }
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)
        let w = CGFloat(call.getDouble("width") ?? 0)
        let h = CGFloat(call.getDouble("height") ?? 0)
        DispatchQueue.main.async {
            self.adViews[adId]?.frame = CGRect(x: x, y: y, width: w, height: h)
            call.resolve()
        }
    }

    /// Builds the same post-card design used on Android: header (icon,
    /// advertiser, "Sponsored"), bold headline ABOVE media, media, caption
    /// BELOW media, full-width blue CTA bar. Layout runs in layoutSubviews so
    /// every element is sized from the card's final frame (fixes the old bug
    /// where subviews were measured before the frame was set).
    private func buildNativeAdView(ad: GADNativeAd) -> GADNativeAdView {
        let adView = AelixtoNativeAdView()
        adView.configure(with: ad)
        adView.nativeAd = ad
        return adView
    }

    @objc func destroyAd(_ call: CAPPluginCall) {
        if let adId = call.getString("adId") {
            DispatchQueue.main.async {
                self.adViews.removeValue(forKey: adId)?.removeFromSuperview()
            }
            ads.removeValue(forKey: adId)
            loaders.removeValue(forKey: adId)
        }
        call.resolve()
    }
}

private struct AssocKeys {
    static var adId: UInt8 = 0
}