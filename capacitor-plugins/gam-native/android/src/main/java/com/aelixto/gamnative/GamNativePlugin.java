package com.aelixto.gamnative;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.admanager.AdManagerAdRequest;
import com.google.android.gms.ads.nativead.NativeAd;

import com.google.android.ump.ConsentDebugSettings;
import com.google.android.ump.ConsentForm;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Google Ad Manager (AdX) native ad plugin — Android.
 *
 * Uses AdLoader.forNativeAd + AdManagerAdRequest to serve
 * /NETWORK_CODE/unit_name ad units from Ad Manager inventory.
 */
@CapacitorPlugin(name = "GamNative")
public class GamNativePlugin extends Plugin {

    private static final String TAG = "GamNative";
    private final Map<String, NativeAd> ads = new HashMap<>();
    private ConsentInformation consentInformation;

    @PluginMethod
    public void initialize(PluginCall call) {
        MobileAds.initialize(getContext(), status -> {
            JSObject ret = new JSObject();
            ret.put("status", "ready");
            call.resolve(ret);
        });
    }

    // ---------------- UMP consent ----------------

    @PluginMethod
    public void requestConsentInfo(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
                .setTagForUnderAgeOfConsent(false)
                .build();
        consentInformation = UserMessagingPlatform.getConsentInformation(getContext());
        consentInformation.requestConsentInfoUpdate(activity, params,
                () -> {
                    JSObject ret = new JSObject();
                    ret.put("status", mapStatus(consentInformation.getConsentStatus()));
                    ret.put("isConsentFormAvailable", consentInformation.isConsentFormAvailable());
                    call.resolve(ret);
                },
                formError -> call.reject("UMP requestConsentInfoUpdate failed: " + formError.getMessage()));
    }

    @PluginMethod
    public void showConsentFormIfRequired(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }
        UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
            if (formError != null) {
                call.reject("UMP loadAndShowConsentFormIfRequired failed: " + formError.getMessage());
                return;
            }
            JSObject ret = new JSObject();
            ret.put("shown", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void showPrivacyOptionsForm(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
            if (formError != null) {
                call.reject("UMP showPrivacyOptionsForm failed: " + formError.getMessage());
                return;
            }
            call.resolve();
        });
    }

    private String mapStatus(int s) {
        switch (s) {
            case ConsentInformation.ConsentStatus.REQUIRED: return "REQUIRED";
            case ConsentInformation.ConsentStatus.NOT_REQUIRED: return "NOT_REQUIRED";
            case ConsentInformation.ConsentStatus.OBTAINED: return "OBTAINED";
            default: return "UNKNOWN";
        }
    }

    // ---------------- ATT (iOS-only) ----------------

    @PluginMethod
    public void requestTrackingAuthorization(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", "unavailable");
        call.resolve(ret);
    }

    // ---------------- Native ad load ----------------

    @PluginMethod
    public void loadNativeAd(final PluginCall call) {
        final String adUnitId = call.getString("adUnitId");
        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("adUnitId is required");
            return;
        }
        final String adId = UUID.randomUUID().toString();

        getActivity().runOnUiThread(() -> {
            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                    .forNativeAd(nativeAd -> {
                        ads.put(adId, nativeAd);
                        JSObject payload = new JSObject();
                        payload.put("adId", adId);
                        if (nativeAd.getHeadline() != null) payload.put("headline", nativeAd.getHeadline());
                        if (nativeAd.getBody() != null) payload.put("body", nativeAd.getBody());
                        if (nativeAd.getAdvertiser() != null) payload.put("advertiser", nativeAd.getAdvertiser());
                        if (nativeAd.getCallToAction() != null) payload.put("callToAction", nativeAd.getCallToAction());
                        if (nativeAd.getIcon() != null && nativeAd.getIcon().getUri() != null) {
                            payload.put("iconUrl", nativeAd.getIcon().getUri().toString());
                        }
                        if (nativeAd.getImages() != null && !nativeAd.getImages().isEmpty()
                                && nativeAd.getImages().get(0).getUri() != null) {
                            payload.put("imageUrl", nativeAd.getImages().get(0).getUri().toString());
                        }
                        if (nativeAd.getStarRating() != null) payload.put("starRating", nativeAd.getStarRating());
                        if (nativeAd.getPrice() != null) payload.put("price", nativeAd.getPrice());
                        if (nativeAd.getStore() != null) payload.put("store", nativeAd.getStore());
                        if (nativeAd.getResponseInfo() != null) {
                            payload.put("responseInfo", nativeAd.getResponseInfo().getResponseId());
                        }
                        call.resolve(payload);
                    })
                    .withAdListener(new AdListener() {
                        @Override
                        public void onAdFailedToLoad(@NonNull LoadAdError error) {
                            Log.w(TAG, "Native ad failed: " + error.getMessage());
                            // No-fill / error -> resolve null so JS silently unmounts the slot.
                            call.resolve();
                        }
                    })
                    .build();

            AdManagerAdRequest request = new AdManagerAdRequest.Builder().build();
            loader.loadAd(request);
        });
    }

    @PluginMethod
    public void recordImpression(PluginCall call) {
        // Impressions are auto-fired when the ad view is bound. Since we
        // render inside the webview we cannot bind a NativeAdView, so this
        // is a no-op — Google will treat the ad as "loaded but unrendered".
        // Consider migrating to a native container overlay for full metrics.
        call.resolve();
    }

    @PluginMethod
    public void recordClick(PluginCall call) {
        String adId = call.getString("adId");
        if (adId != null) {
            NativeAd ad = ads.get(adId);
            if (ad != null) {
                // The public NativeAd API doesn't expose performClick(); the
                // callToAction click is normally routed by NativeAdView. As
                // a fallback we simply resolve — the JS layer opens the
                // creative's landing page from responseInfo/CTA data.
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void destroyAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId != null) {
            NativeAd ad = ads.remove(adId);
            if (ad != null) ad.destroy();
        }
        call.resolve();
    }
}