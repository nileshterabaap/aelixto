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
public class GamNativePlugin: CAPPlugin, GADNativeAdLoaderDelegate, GADAdLoaderDelegate {

    private var pendingLoads: [String: CAPPluginCall] = [:]
    private var loaders: [String: GADAdLoader] = [:]
    private var ads: [String: GADNativeAd] = [:]

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
                "isConsentFormAvailable": formAvailable
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
        if let s = nativeAd.starRating?.doubleValue { payload["starRating"] = s }
        if let p = nativeAd.price { payload["price"] = p }
        if let store = nativeAd.store { payload["store"] = store }
        if let info = nativeAd.responseInfo?.responseIdentifier { payload["responseInfo"] = info }
        call.resolve(payload)
    }

    // MARK: - Impression / click / cleanup

    @objc func recordImpression(_ call: CAPPluginCall) {
        // Google's SDK auto-tracks impressions once the native ad view is
        // registered. Because we render in the webview we cannot register a
        // GADNativeAdView, so we manually fire the reporting.
        guard let adId = call.getString("adId"), let ad = ads[adId] else {
            call.resolve(); return
        }
        ad.recordImpression()
        call.resolve()
    }

    @objc func recordClick(_ call: CAPPluginCall) {
        guard let adId = call.getString("adId"), let ad = ads[adId] else {
            call.resolve(); return
        }
        // performClickOnAsset triggers Google's click handler + landing page.
        ad.performClickOnAsset(withKey: GADNativeCallToActionAsset)
        call.resolve()
    }

    @objc func destroyAd(_ call: CAPPluginCall) {
        if let adId = call.getString("adId") {
            ads.removeValue(forKey: adId)
            loaders.removeValue(forKey: adId)
        }
        call.resolve()
    }
}

private struct AssocKeys {
    static var adId: UInt8 = 0
}