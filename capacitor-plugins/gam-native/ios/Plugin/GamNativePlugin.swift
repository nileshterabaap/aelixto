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

    // MARK: - Native overlay (real GADNativeAdView, full SDK tracking)

    @objc func presentNativeAd(_ call: CAPPluginCall) {
        guard let adId = call.getString("adId"), let ad = ads[adId] else {
            call.reject("ad not found"); return
        }
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)
        let w = CGFloat(call.getDouble("width") ?? 0)
        let h = CGFloat(call.getDouble("height") ?? 0)
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController?.view else { call.reject("no view"); return }
            self.adViews[adId]?.removeFromSuperview()
            let adView = self.buildNativeAdView(ad: ad)
            adView.frame = CGRect(x: x, y: y, width: w, height: h)
            host.addSubview(adView)
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

    private func buildNativeAdView(ad: GADNativeAd) -> GADNativeAdView {
        let adView = GADNativeAdView()
        adView.backgroundColor = .white

        // Header
        let icon = UIImageView(frame: CGRect(x: 12, y: 10, width: 32, height: 32))
        icon.contentMode = .scaleAspectFill
        icon.clipsToBounds = true
        icon.layer.cornerRadius = 16
        icon.image = ad.icon?.image
        adView.addSubview(icon)
        adView.iconView = icon

        let advertiser = UILabel(frame: CGRect(x: 52, y: 12, width: 220, height: 28))
        advertiser.font = UIFont.boldSystemFont(ofSize: 14)
        advertiser.text = ad.advertiser ?? "Sponsored"
        adView.addSubview(advertiser)
        adView.advertiserView = advertiser

        // Media (auto-sized in layoutSubviews)
        let mediaView = GADMediaView()
        adView.addSubview(mediaView)
        adView.mediaView = mediaView

        // Text block
        let headline = UILabel()
        headline.numberOfLines = 2
        headline.font = UIFont.boldSystemFont(ofSize: 15)
        headline.text = ad.headline
        adView.addSubview(headline)
        adView.headlineView = headline

        let body = UILabel()
        body.numberOfLines = 3
        body.font = UIFont.systemFont(ofSize: 13)
        body.textColor = .darkGray
        body.text = ad.body
        adView.addSubview(body)
        adView.bodyView = body

        let cta = UIButton(type: .system)
        cta.setTitle(ad.callToAction, for: .normal)
        cta.setTitleColor(.white, for: .normal)
        cta.backgroundColor = .black
        cta.contentEdgeInsets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
        cta.layer.cornerRadius = 14
        cta.isUserInteractionEnabled = false // SDK routes taps via nativeAdView
        adView.addSubview(cta)
        adView.callToActionView = cta

        // Simple flow layout on layout pass
        adView.translatesAutoresizingMaskIntoConstraints = true
        adView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        adView.layoutSubviews()

        // Programmatic layout: header (52 tall), media (flex), text/cta at bottom
        let width = adView.bounds.width
        let headerH: CGFloat = 52
        let ctaH: CGFloat = 32
        let textH: CGFloat = 90
        let mediaTop = headerH
        let mediaH = max(0, adView.bounds.height - headerH - textH)
        mediaView.frame = CGRect(x: 0, y: mediaTop, width: width, height: mediaH)
        headline.frame = CGRect(x: 12, y: mediaTop + mediaH + 4, width: width - 24, height: 22)
        body.frame = CGRect(x: 12, y: mediaTop + mediaH + 28, width: width - 24, height: 34)
        cta.frame = CGRect(x: 12, y: adView.bounds.height - ctaH - 8,
                            width: cta.intrinsicContentSize.width + 24, height: ctaH)

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