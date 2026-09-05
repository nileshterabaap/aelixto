package com.aelixto.gamnative;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ViewConfiguration;
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
    private final Map<String, ScrollForwardingAdFrame> adViews = new HashMap<>();
    private ConsentInformation consentInformation;

    /**
     * All ad overlays live inside this clipping host instead of directly in the
     * activity content root. Its top/bottom margins are driven by the JS layer
     * (sticky header / fixed bottom nav), so an ad can never paint over the
     * bottom navigation bar — it is clipped at the feed boundary exactly like a
     * WebView-rendered post.
     */
    private FrameLayout adHost;
    private int clipTopPx = 0;
    private int clipBottomPx = 0;
    private boolean scrollHooked = false;

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
                    ret.put("privacyOptionsRequired",
                            consentInformation.getPrivacyOptionsRequirementStatus()
                                    == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
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
        final int clipTop = call.getInt("clipTop", 0);
        final int clipBottom = call.getInt("clipBottom", 0);
        final Activity activity = getActivity();
        if (activity == null) { call.reject("no activity"); return; }

        activity.runOnUiThread(() -> {
            ScrollForwardingAdFrame existing = adViews.remove(adId);
            if (existing != null && existing.getParent() instanceof ViewGroup) {
                ((ViewGroup) existing.getParent()).removeView(existing);
            }
            ScrollForwardingAdFrame adView = buildNativeAdView(activity, ad);
            adViews.put(adId, adView);

            clipTopPx = dp(clipTop);
            clipBottomPx = dp(clipBottom);
            FrameLayout host = ensureAdHost(activity);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(w), dp(h));
            lp.gravity = Gravity.TOP | Gravity.START;
            host.addView(adView, lp);
            placeAdView(adView, x, y);
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
        final int clipTop = call.getInt("clipTop", -1);
        final int clipBottom = call.getInt("clipBottom", -1);
        final Activity activity = getActivity();
        if (activity == null) { call.resolve(); return; }
        activity.runOnUiThread(() -> {
            ScrollForwardingAdFrame v = adViews.get(adId);
            if (v != null) {
                if (clipTop >= 0) clipTopPx = dp(clipTop);
                if (clipBottom >= 0) clipBottomPx = dp(clipBottom);
                if (adHost != null) ensureAdHost(activity);
                ViewGroup.LayoutParams lp = v.getLayoutParams();
                if (lp != null && (lp.width != dp(w) || lp.height != dp(h))) {
                    lp.width = dp(w);
                    lp.height = dp(h);
                    v.setLayoutParams(lp);
                }
                placeAdView(v, x, y);
            }
            call.resolve();
        });
    }

    /**
     * Position an overlay using translation only (no relayout) and in host-local
     * coordinates, so scroll updates are a single cheap property change.
     */
    private void placeAdView(View v, int cssX, int cssY) {
        v.setTranslationX(dp(cssX));
        v.setTranslationY(dp(cssY) - clipTopPx);
    }

    private FrameLayout ensureAdHost(Activity activity) {
        if (adHost == null || adHost.getParent() == null) {
            adHost = new FrameLayout(activity);
            adHost.setClipChildren(true);
            adHost.setClipToPadding(true);
            ViewGroup root = (ViewGroup) activity.findViewById(android.R.id.content);
            root.addView(adHost, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        ViewGroup.LayoutParams raw = adHost.getLayoutParams();
        if (raw instanceof FrameLayout.LayoutParams) {
            FrameLayout.LayoutParams hlp = (FrameLayout.LayoutParams) raw;
            if (hlp.topMargin != clipTopPx || hlp.bottomMargin != clipBottomPx) {
                hlp.topMargin = clipTopPx;
                hlp.bottomMargin = clipBottomPx;
                adHost.setLayoutParams(hlp);
            }
        }
        hookWebViewScroll();
        return adHost;
    }

    /**
     * Drive overlay movement from the WebView's own scroll callback instead of a
     * JS scroll event + bridge round-trip. The translation is applied in the
     * same frame the WebView scrolls, which removes the visible lag/float during
     * fast scrolling and flings. The JS `updateNativeAdFrame` calls remain as a
     * correction pass for layout changes.
     */
    private void hookWebViewScroll() {
        if (scrollHooked) return;
        android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        wv.setOnScrollChangeListener((v, sx, sy, oldSx, oldSy) -> {
            if (adHost == null) return;
            final int dy = sy - oldSy;
            final int dx = sx - oldSx;
            if (dx == 0 && dy == 0) return;
            for (int i = 0; i < adHost.getChildCount(); i++) {
                View c = adHost.getChildAt(i);
                c.setTranslationY(c.getTranslationY() - dy);
                c.setTranslationX(c.getTranslationX() - dx);
            }
        });
        scrollHooked = true;
    }

    private int dp(int px) {
        DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
        return Math.round(px * dm.density);
    }

    /**
     * The native ad overlay sits on top of the WebView, so by default it swallows
     * every touch and the feed cannot be scrolled while the thumb is on an ad.
     *
     * This subclass keeps taps/clicks on the ad (so Google still tracks billable
     * clicks) but, as soon as a vertical drag passes the touch slop, cancels the
     * ad gesture and forwards the rest of the gesture to the WebView so the feed
     * scrolls normally.
     */
    private static class ScrollForwardingAdFrame extends FrameLayout {
        private final android.webkit.WebView webView;
        private final int slop;
        private float downX, downY;
        private boolean forwarding;
        final NativeAdView adView;

        ScrollForwardingAdFrame(Activity activity, android.webkit.WebView webView) {
            super(activity);
            this.webView = webView;
            this.slop = ViewConfiguration.get(activity).getScaledTouchSlop();
            this.adView = new NativeAdView(activity);
            addView(adView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }

        void destroy() {
            adView.destroy();
        }

        private void forward(MotionEvent ev, int action) {
            if (webView == null) return;
            int[] mine = new int[2];
            int[] web = new int[2];
            getLocationOnScreen(mine);
            webView.getLocationOnScreen(web);
            MotionEvent copy = MotionEvent.obtain(ev);
            copy.setAction(action);
            copy.setLocation(ev.getX() + mine[0] - web[0], ev.getY() + mine[1] - web[1]);
            webView.dispatchTouchEvent(copy);
            copy.recycle();
        }

        @Override
        public boolean dispatchTouchEvent(MotionEvent ev) {
            final int action = ev.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                downX = ev.getX();
                downY = ev.getY();
                forwarding = false;
            } else if (!forwarding && action == MotionEvent.ACTION_MOVE && webView != null) {
                float dy = ev.getY() - downY;
                float dx = ev.getX() - downX;
                if (Math.abs(dy) > slop && Math.abs(dy) > Math.abs(dx)) {
                    forwarding = true;
                    MotionEvent cancel = MotionEvent.obtain(ev);
                    cancel.setAction(MotionEvent.ACTION_CANCEL);
                    super.dispatchTouchEvent(cancel);
                    cancel.recycle();
                    // Give the WebView a DOWN at the original touch point first.
                    MotionEvent down = MotionEvent.obtain(ev);
                    down.setLocation(downX, downY);
                    forward(down, MotionEvent.ACTION_DOWN);
                    down.recycle();
                }
            }

            if (forwarding) {
                forward(ev, action);
                if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                    forwarding = false;
                }
                return true;
            }
            return super.dispatchTouchEvent(ev);
        }
    }

    /**
     * Build a fully-registered NativeAdView programmatically so Google's SDK
     * can auto-fire impressions + billable clicks. Layout mirrors the JS
     * placeholder card (header row, media, headline/body, CTA).
     */
    private ScrollForwardingAdFrame buildNativeAdView(Activity activity, NativeAd ad) {
        ScrollForwardingAdFrame frame = new ScrollForwardingAdFrame(
                activity, getBridge() != null ? getBridge().getWebView() : null);
        NativeAdView adView = frame.adView;
        frame.setBackgroundColor(Color.TRANSPARENT);
        adView.setBackgroundColor(Color.TRANSPARENT);

        // Values mirror HydratedFeedPost.tsx / index.css exactly.
        final int RADIUS = dp(32);            // rounded-[2rem]
        final int PAD_H = dp(20);             // px-5
        final int TEXT_MUTED = Color.parseColor("#737373"); // --muted-foreground 0 0% 45%
        final int FOREGROUND = Color.parseColor("#000000"); // --foreground 0 0% 0%
        final int BORDER = Color.parseColor("#E4E7EB");     // hsl(220 13% 91%)
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
        // .glass-post-card elevation (0 4px 16px -8px rgba(...)) approximation.
        container.setElevation(dp(2));

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
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(48), dp(48)); // h-12 w-12
        iconLp.rightMargin = dp(12);
        icon.setBackgroundColor(Color.parseColor("#F5F5F5")); // AvatarFallback bg-muted
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
        advertiser.setTextColor(FOREGROUND);
        advertiser.setTextSize(16);                 // text-base font-bold
        advertiser.setLineSpacing(0f, 1.0f);        // leading-tight
        advertiser.setIncludeFontPadding(false);
        advertiser.setMaxLines(1);
        advertiser.setText(ad.getAdvertiser() != null ? ad.getAdvertiser() : "Sponsored");
        nameCol.addView(advertiser);

        TextView sponsored = new TextView(activity);
        sponsored.setText("Sponsored");
        sponsored.setTextColor(TEXT_MUTED);
        sponsored.setTextSize(12);                  // text-xs muted, same slot as the timestamp
        sponsored.setIncludeFontPadding(false);
        LinearLayout.LayoutParams sponsoredLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sponsoredLp.topMargin = dp(2);              // mt-0.5
        nameCol.addView(sponsored, sponsoredLp);

        // Attribution: the "Sponsored" line under the advertiser name carries
        // the disclosure; the SDK's AdChoices badge is rendered by Google and
        // cannot be removed.
        container.addView(header);

        // Headline ABOVE the media (px-5 pb-3, text-xl font-bold)
        TextView headline = new TextView(activity);
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setTextColor(FOREGROUND);
        headline.setTextSize(20);
        headline.setMaxLines(2);
        headline.setPadding(PAD_H, 0, PAD_H, dp(14));
        if (ad.getHeadline() != null) headline.setText(ad.getHeadline());
        container.addView(headline);

        // Media — edge-to-edge like the feed embeds
        MediaView mediaView = new MediaView(activity);
        mediaView.setBackgroundColor(Color.parseColor("#F5F5F5")); // --muted
        LinearLayout.LayoutParams mediaLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        container.addView(mediaView, mediaLp);

        // Body caption BELOW the media (px-5 py-4, text-sm)
        TextView body = new TextView(activity);
        body.setTextColor(FOREGROUND);
        body.setTextSize(15);
        body.setLineSpacing(0f, 1.4f);
        body.setMaxLines(3);
        if (ad.getBody() != null) body.setText(ad.getBody());
        body.setPadding(PAD_H, dp(14), PAD_H, dp(14));
        container.addView(body);

        // Full-bleed CTA bar flush with the bottom of the card, with a chevron
        // on the right — mirrors the reference design.
        FrameLayout ctaRow = new FrameLayout(activity);
        GradientDrawable ctaBg = new GradientDrawable();
        ctaBg.setColor(BRAND_BLUE);
        ctaBg.setCornerRadii(new float[]{0, 0, 0, 0, RADIUS, RADIUS, RADIUS, RADIUS});
        ctaRow.setBackground(ctaBg);

        Button cta = new Button(activity);
        cta.setAllCaps(false);
        cta.setTypeface(Typeface.DEFAULT_BOLD);
        cta.setTextSize(16);
        cta.setTextColor(Color.WHITE);
        cta.setStateListAnimator(null);
        cta.setBackgroundColor(Color.TRANSPARENT);
        cta.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        cta.setPadding(PAD_H, 0, dp(48), 0);
        if (ad.getCallToAction() != null) cta.setText(ad.getCallToAction());
        ctaRow.addView(cta, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        TextView chevron = new TextView(activity);
        chevron.setText("\u203A");
        chevron.setTextColor(Color.WHITE);
        chevron.setTextSize(24);
        chevron.setTypeface(Typeface.DEFAULT_BOLD);
        FrameLayout.LayoutParams chevLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, dp(56));
        chevLp.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        chevLp.rightMargin = PAD_H;
        chevron.setGravity(Gravity.CENTER);
        ctaRow.addView(chevron, chevLp);

        container.addView(ctaRow, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        adView.addView(container);

        // Register asset views — this is what enables SDK impression + click tracking.
        adView.setMediaView(mediaView);
        adView.setHeadlineView(headline);
        adView.setBodyView(body);
        adView.setCallToActionView(cta);
        adView.setIconView(icon);
        adView.setAdvertiserView(advertiser);
        adView.setNativeAd(ad);
        return frame;
    }

    @PluginMethod
    public void destroyAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId != null) {
            final ScrollForwardingAdFrame v = adViews.remove(adId);
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