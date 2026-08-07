package com.aelixto.gamnative;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
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
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
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

    /**
     * Android WebView defaults to `mediaPlaybackRequiresUserGesture = true`, which
     * stops embedded <video> elements (Threads/Meta embeds) from preloading their
     * first frame. The WebView then paints its oversized built-in play placeholder
     * instead of the poster — the exact "giant grey play button" artifact seen in
     * the APK but never in the mobile browser. Chrome/Safari load the poster, so
     * matching that behaviour here makes the APK render identically to the web.
     */
    @Override
    public void load() {
        super.load();
        try {
            android.webkit.WebView webView = getBridge().getWebView();
            if (webView != null) {
                android.webkit.WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setLoadsImagesAutomatically(true);
                settings.setBlockNetworkImage(false);
                settings.setDomStorageEnabled(true);
                settings.setMixedContentMode(
                    android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
                android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);
                Log.i(TAG, "[webview] media settings relaxed: gesture=false imagesAuto="
                        + settings.getLoadsImagesAutomatically()
                        + " blockNetworkImage=" + settings.getBlockNetworkImage()
                        + " domStorage=" + settings.getDomStorageEnabled()
                        + " thirdPartyCookies=true"
                        + " mixedContent=" + settings.getMixedContentMode()
                        + " ua=" + settings.getUserAgentString());
            }
        } catch (Throwable t) {
            Log.w(TAG, "Unable to relax WebView media settings", t);
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.i(TAG, "[ads] MobileAds.initialize() called");
        // Register the emulator (and any device the developer adds) as a test
        // device so LIVE Ad Manager units also return test creatives instead of
        // no-fill during QA. Real device hashes are printed by the SDK itself:
        // look for "Use RequestConfiguration.Builder.setTestDeviceIds(...)".
        try {
            MobileAds.setRequestConfiguration(
                    new RequestConfiguration.Builder()
                            .setTestDeviceIds(java.util.Arrays.asList(AdRequest.DEVICE_ID_EMULATOR))
                            .build());
            Log.i(TAG, "[ads] test device configuration applied (emulator)");
        } catch (Throwable t) {
            Log.w(TAG, "[ads] unable to set test device configuration", t);
        }
        MobileAds.initialize(getContext(), status -> {
            try {
                Log.i(TAG, "[ads] MobileAds init complete: " + status.getAdapterStatusMap().toString());
            } catch (Throwable t) {
                Log.i(TAG, "[ads] MobileAds init complete (no adapter status)");
            }
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
                    Log.i(TAG, "[ads] consent info updated: status=" + mapStatus(consentInformation.getConsentStatus())
                            + " formAvailable=" + consentInformation.isConsentFormAvailable()
                            + " canRequestAds=" + consentInformation.canRequestAds());
                    JSObject ret = new JSObject();
                    ret.put("status", mapStatus(consentInformation.getConsentStatus()));
                    ret.put("isConsentFormAvailable", consentInformation.isConsentFormAvailable());
                    call.resolve(ret);
                },
                formError -> {
                    Log.w(TAG, "[ads] consent info update FAILED: code=" + formError.getErrorCode()
                            + " msg=" + formError.getMessage());
                    call.reject("UMP requestConsentInfoUpdate failed: " + formError.getMessage());
                });
    }

    @PluginMethod
    public void showConsentFormIfRequired(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }
        UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
            if (formError != null) {
                Log.w(TAG, "[ads] consent form FAILED: code=" + formError.getErrorCode()
                        + " msg=" + formError.getMessage());
                call.reject("UMP loadAndShowConsentFormIfRequired failed: " + formError.getMessage());
                return;
            }
            Log.i(TAG, "[ads] consent form flow completed (shown or not required)");
            JSObject ret = new JSObject();
            ret.put("shown", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void showPrivacyOptionsForm(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }
        // UMP requires this call on the Android UI thread.
        activity.runOnUiThread(() -> {
            try {
                UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
                    if (formError != null) {
                        call.reject("UMP showPrivacyOptionsForm failed: " + formError.getMessage());
                        return;
                    }
                    call.resolve();
                });
            } catch (Throwable t) {
                call.reject("UMP showPrivacyOptionsForm crashed: " + t.getMessage());
            }
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

        Log.i(TAG, "[ads] loadNativeAd requested adUnitId=" + adUnitId + " adId=" + adId);

        getActivity().runOnUiThread(() -> {
            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                    .forNativeAd(nativeAd -> {
                        Log.i(TAG, "[ads] native ad LOADED adId=" + adId
                                + " headline=" + nativeAd.getHeadline()
                                + " advertiser=" + nativeAd.getAdvertiser());
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
                            Log.w(TAG, "[ads] native ad FAILED adUnitId=" + adUnitId
                                    + " code=" + error.getCode()
                                    + " domain=" + error.getDomain()
                                    + " msg=" + error.getMessage()
                                    + " cause=" + error.getCause()
                                    + " responseInfo=" + error.getResponseInfo());
                            // No-fill / error -> resolve null so JS silently unmounts the slot.
                            call.resolve();
                        }
                    })
                    .build();

            AdManagerAdRequest request = new AdManagerAdRequest.Builder().build();
            Log.i(TAG, "[ads] sending AdManagerAdRequest for " + adUnitId);
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
        adView.setBackgroundColor(Color.TRANSPARENT);

        final int RADIUS = dp(32);           // matches rounded-[2rem]
        final int PAD_H = dp(20);            // matches px-5
        final int TEXT_MUTED = Color.parseColor("#6B7280");
        final int BORDER = Color.parseColor("#E4E7EB");   // hsl(220 13% 91%)
        final int BRAND_BLUE = Color.parseColor("#0080FF"); // hsl(213 100% 50%)

        LinearLayout container = new LinearLayout(activity);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.WHITE);
        cardBg.setCornerRadius(RADIUS);
        cardBg.setStroke(dp(1), BORDER);
        container.setBackground(cardBg);
        container.setClipToOutline(true);
        container.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) {
                outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), RADIUS);
            }
        });

        // Header row
        LinearLayout header = new LinearLayout(activity);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setPadding(PAD_H, dp(16), PAD_H, dp(12));
        header.setGravity(Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(activity);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        icon.setClipToOutline(true);
        icon.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) {
                outline.setOval(0, 0, view.getWidth(), view.getHeight());
            }
        });
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(48), dp(48));
        iconLp.rightMargin = dp(12);
        header.addView(icon, iconLp);
        if (ad.getIcon() != null && ad.getIcon().getUri() != null) {
            try { Picasso.get().load(ad.getIcon().getUri()).into(icon); } catch (Exception ignored) {}
        }

        LinearLayout nameCol = new LinearLayout(activity);
        nameCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams nameColLp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(nameCol, nameColLp);

        TextView advertiser = new TextView(activity);
        advertiser.setTypeface(Typeface.DEFAULT_BOLD);
        advertiser.setTextColor(Color.BLACK);
        advertiser.setTextSize(16);
        advertiser.setMaxLines(1);
        advertiser.setText(ad.getAdvertiser() != null ? ad.getAdvertiser() : "Sponsored");
        nameCol.addView(advertiser);

        TextView sponsored = new TextView(activity);
        sponsored.setText("Sponsored");
        sponsored.setTextColor(TEXT_MUTED);
        sponsored.setTextSize(12);
        nameCol.addView(sponsored);

        // Mandatory "Ad" attribution chip (Google native policy).
        TextView chip = new TextView(activity);
        chip.setText("Ad");
        chip.setTextColor(Color.WHITE);
        chip.setTextSize(10);
        chip.setTypeface(Typeface.DEFAULT_BOLD);
        chip.setPadding(dp(8), dp(3), dp(8), dp(3));
        GradientDrawable chipBg = new GradientDrawable();
        chipBg.setColor(Color.parseColor("#111827"));
        chipBg.setCornerRadius(dp(999));
        chip.setBackground(chipBg);
        header.addView(chip);
        container.addView(header);

        // Media — edge-to-edge like the feed embeds
        MediaView mediaView = new MediaView(activity);
        mediaView.setBackgroundColor(Color.parseColor("#F3F4F6"));
        LinearLayout.LayoutParams mediaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        container.addView(mediaView, mediaLp);

        // Text block
        LinearLayout textBlock = new LinearLayout(activity);
        textBlock.setOrientation(LinearLayout.VERTICAL);
        textBlock.setPadding(PAD_H, dp(12), PAD_H, dp(16));

        TextView headline = new TextView(activity);
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setTextColor(Color.BLACK);
        headline.setTextSize(15);
        headline.setMaxLines(2);
        if (ad.getHeadline() != null) headline.setText(ad.getHeadline());
        textBlock.addView(headline);

        TextView body = new TextView(activity);
        body.setTextColor(TEXT_MUTED);
        body.setTextSize(13);
        body.setMaxLines(2);
        if (ad.getBody() != null) body.setText(ad.getBody());
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyLp.topMargin = dp(4);
        textBlock.addView(body, bodyLp);

        Button cta = new Button(activity);
        cta.setAllCaps(false);
        cta.setTypeface(Typeface.DEFAULT_BOLD);
        cta.setTextSize(14);
        cta.setTextColor(Color.WHITE);
        cta.setStateListAnimator(null);
        cta.setPadding(dp(16), 0, dp(16), 0);
        GradientDrawable ctaBg = new GradientDrawable();
        ctaBg.setColor(BRAND_BLUE);
        ctaBg.setCornerRadius(dp(999));
        cta.setBackground(ctaBg);
        if (ad.getCallToAction() != null) cta.setText(ad.getCallToAction());
        LinearLayout.LayoutParams ctaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(44));
        ctaLp.topMargin = dp(12);
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