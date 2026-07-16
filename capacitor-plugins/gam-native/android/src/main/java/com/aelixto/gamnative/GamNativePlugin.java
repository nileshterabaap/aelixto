package com.aelixto.gamnative;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

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
import com.google.android.gms.ads.nativead.NativeAdView;
import com.google.android.gms.ads.nativead.MediaView;
import com.squareup.picasso.Picasso;

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
    private final Map<String, NativeAdView> adViews = new HashMap<>();
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
    public void presentNativeAd(final PluginCall call) {
        final String adId = call.getString("adId");
        if (adId == null) { call.reject("adId required"); return; }
        final NativeAd ad = ads.get(adId);
        if (ad == null) { call.reject("ad not found"); return; }
        final int x = call.getInt("x", 0);
        final int y = call.getInt("y", 0);
        final int w = call.getInt("width", 0);
        final int h = call.getInt("height", 0);
        final Activity activity = getActivity();
        if (activity == null) { call.reject("no activity"); return; }

        activity.runOnUiThread(() -> {
            NativeAdView existing = adViews.remove(adId);
            if (existing != null && existing.getParent() instanceof ViewGroup) {
                ((ViewGroup) existing.getParent()).removeView(existing);
            }
            NativeAdView adView = buildNativeAdView(activity, ad);
            adViews.put(adId, adView);

            ViewGroup root = (ViewGroup) activity.findViewById(android.R.id.content);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(w), dp(h));
            lp.leftMargin = dp(x);
            lp.topMargin = dp(y);
            lp.gravity = Gravity.TOP | Gravity.START;
            root.addView(adView, lp);
            call.resolve();
        });
    }

    @PluginMethod
    public void updateNativeAdFrame(final PluginCall call) {
        final String adId = call.getString("adId");
        if (adId == null) { call.resolve(); return; }
        final int x = call.getInt("x", 0);
        final int y = call.getInt("y", 0);
        final int w = call.getInt("width", 0);
        final int h = call.getInt("height", 0);
        final Activity activity = getActivity();
        if (activity == null) { call.resolve(); return; }
        activity.runOnUiThread(() -> {
            NativeAdView v = adViews.get(adId);
            if (v != null) {
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(w), dp(h));
                lp.leftMargin = dp(x);
                lp.topMargin = dp(y);
                lp.gravity = Gravity.TOP | Gravity.START;
                v.setLayoutParams(lp);
                v.requestLayout();
            }
            call.resolve();
        });
    }

    private int dp(int px) {
        DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
        return Math.round(px * dm.density);
    }

    /**
     * Build a fully-registered NativeAdView programmatically so Google's SDK
     * can auto-fire impressions + billable clicks. Layout mirrors the JS
     * placeholder card (header row, media, headline/body, CTA).
     */
    private NativeAdView buildNativeAdView(Activity activity, NativeAd ad) {
        NativeAdView adView = new NativeAdView(activity);
        adView.setBackgroundColor(Color.WHITE);

        LinearLayout container = new LinearLayout(activity);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Header row
        LinearLayout header = new LinearLayout(activity);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setPadding(dp(12), dp(10), dp(12), dp(10));
        header.setGravity(Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(activity);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(32), dp(32));
        iconLp.rightMargin = dp(8);
        header.addView(icon, iconLp);
        if (ad.getIcon() != null && ad.getIcon().getUri() != null) {
            try { Picasso.get().load(ad.getIcon().getUri()).into(icon); } catch (Exception ignored) {}
        }

        TextView advertiser = new TextView(activity);
        advertiser.setTypeface(Typeface.DEFAULT_BOLD);
        advertiser.setTextColor(Color.BLACK);
        advertiser.setTextSize(14);
        advertiser.setText(ad.getAdvertiser() != null ? ad.getAdvertiser() : "Sponsored");
        LinearLayout.LayoutParams advLp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(advertiser, advLp);

        TextView chip = new TextView(activity);
        chip.setText("Ad");
        chip.setTextColor(Color.WHITE);
        chip.setBackgroundColor(Color.BLACK);
        chip.setPadding(dp(6), dp(2), dp(6), dp(2));
        chip.setTextSize(10);
        header.addView(chip);
        container.addView(header);

        // Media
        MediaView mediaView = new MediaView(activity);
        LinearLayout.LayoutParams mediaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        container.addView(mediaView, mediaLp);

        // Text block
        LinearLayout textBlock = new LinearLayout(activity);
        textBlock.setOrientation(LinearLayout.VERTICAL);
        textBlock.setPadding(dp(12), dp(10), dp(12), dp(12));

        TextView headline = new TextView(activity);
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setTextColor(Color.BLACK);
        headline.setTextSize(15);
        if (ad.getHeadline() != null) headline.setText(ad.getHeadline());
        textBlock.addView(headline);

        TextView body = new TextView(activity);
        body.setTextColor(Color.DKGRAY);
        body.setTextSize(13);
        if (ad.getBody() != null) body.setText(ad.getBody());
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyLp.topMargin = dp(4);
        textBlock.addView(body, bodyLp);

        Button cta = new Button(activity);
        cta.setAllCaps(false);
        cta.setTextColor(Color.WHITE);
        cta.setBackgroundColor(Color.BLACK);
        if (ad.getCallToAction() != null) cta.setText(ad.getCallToAction());
        LinearLayout.LayoutParams ctaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ctaLp.topMargin = dp(8);
        textBlock.addView(cta, ctaLp);
        container.addView(textBlock);

        adView.addView(container);

        // Register asset views — this is what enables SDK impression + click tracking.
        adView.setMediaView(mediaView);
        adView.setHeadlineView(headline);
        adView.setBodyView(body);
        adView.setCallToActionView(cta);
        adView.setIconView(icon);
        adView.setAdvertiserView(advertiser);
        adView.setNativeAd(ad);
        return adView;
    }

    @PluginMethod
    public void destroyAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId != null) {
            final NativeAdView v = adViews.remove(adId);
            if (v != null) {
                Activity activity = getActivity();
                if (activity != null) {
                    activity.runOnUiThread(() -> {
                        if (v.getParent() instanceof ViewGroup) {
                            ((ViewGroup) v.getParent()).removeView(v);
                        }
                        v.destroy();
                    });
                }
            }
            NativeAd ad = ads.remove(adId);
            if (ad != null) ad.destroy();
        }
        call.resolve();
    }
}