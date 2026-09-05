package com.aelixto.windowinsets;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Single owner of Android window insets (system bars + IME) for Aelixto.
 *
 * Why this exists: on the shipped stack two independent actors resized the
 * WebView for the keyboard — Android's own adjustResize (window level) and
 * @capacitor-community/safe-area (decor padding). Whichever won the race
 * decided whether the composer sat flush on the keyboard (493px WebView) or
 * floated a nav-bar height above it (417px WebView). This plugin
 *
 *   1. forces SOFT_INPUT_ADJUST_NOTHING so the window itself never resizes,
 *   2. enables edge-to-edge (decor does not fit system windows),
 *   3. installs the ONE OnApplyWindowInsetsListener on the decor view — after
 *      every other plugin has loaded, so it replaces safe-area's listener —
 *      and mirrors the safe-area plugin's WebView-version-aware formula,
 *   4. lets JS switch between two keyboard modes:
 *        "resize"  — WebView shrinks by the IME (chat composer, comments);
 *        "overlay" — WebView keeps its size and the keyboard just covers the
 *                    bottom (link box over the embed-heavy feed, where a
 *                    WebView resize costs a full relayout + iframe churn).
 *
 * The @capacitor-community/safe-area plugin stays installed for system-bar
 * styling only.
 */
@CapacitorPlugin(name = "WindowInsetsOwner")
public class WindowInsetsOwnerPlugin extends Plugin {
    private static final String TAG = "AelixtoInsets";
    // Mirrors @capacitor-community/safe-area 8.x.
    private static final int WEBVIEW_SAFE_AREA_FIX_VERSION = 140;
    private static final int WEBVIEW_KEYBOARD_FIX_VERSION = 144;

    private static final String MODE_RESIZE = "resize";
    private static final String MODE_OVERLAY = "overlay";

    private volatile String mode = MODE_RESIZE;
    private boolean installed = false;
    private int webViewMajor = 0;
    private float density = 1f;

    private Insets lastBars = Insets.NONE;
    private Insets lastIme = Insets.NONE;
    private int lastPaddingBottom = 0;
    private boolean lastPassthrough = false;

    @Override
    public void load() {
        super.load();
        Activity activity = getActivity();
        if (activity == null) return;

        density = activity.getResources().getDisplayMetrics().density;
        webViewMajor = readWebViewMajorVersion();

        Window window = activity.getWindow();
        // (1) The window must never be resized by the IME — we do it ourselves.
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        // (2) Edge-to-edge, exactly what the safe-area README asks MainActivity to do.
        try {
            EdgeToEdge.enable(activity);
        } catch (Throwable t) {
            Log.w(TAG, "EdgeToEdge.enable failed; falling back to WindowCompat", t);
        }
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // (3) Install after every other plugin's load() has run.
        window.getDecorView().post(this::install);
        Log.i(TAG, "load webViewMajor=" + webViewMajor + " density=" + density);
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        install();
    }

    private void install() {
        if (installed) return;
        Activity activity = getActivity();
        if (activity == null) return;
        installed = true;
        View decor = activity.getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, this::apply);
        ViewCompat.requestApplyInsets(decor);
        Log.i(TAG, "insets owner installed");
    }

    private WindowInsetsCompat apply(View decor, WindowInsetsCompat insets) {
        int barsMask = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        Insets bars = insets.getInsets(barsMask);
        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
        boolean imeShown = ime.bottom > 0;
        boolean overlay = MODE_OVERLAY.equals(mode);
        // Aelixto always ships <meta name="viewport" ... viewport-fit=cover>.
        boolean passthrough = webViewMajor >= WEBVIEW_SAFE_AREA_FIX_VERSION;
        int imePad = (imeShown && !overlay) ? ime.bottom : 0;

        WindowInsetsCompat out;
        if (passthrough) {
            // Chromium >= 140 resolves env(safe-area-inset-*) itself; only the
            // keyboard is compensated natively.
            decor.setPadding(0, 0, 0, imePad);
            int bottom = (imeShown && webViewMajor < WEBVIEW_KEYBOARD_FIX_VERSION) ? 0 : bars.bottom;
            out = new WindowInsetsCompat.Builder(insets)
                .setInsets(barsMask, Insets.of(bars.left, bars.top, bars.right, bottom))
                .build();
            lastPaddingBottom = imePad;
        } else {
            // Older WebViews: pad the decor for bars (+ IME in resize mode) and
            // report 0 downstream so nothing pads twice.
            int bottom = Math.max(bars.bottom, imePad);
            decor.setPadding(bars.left, bars.top, bars.right, bottom);
            out = new WindowInsetsCompat.Builder(insets)
                .setInsets(barsMask, Insets.NONE)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
            lastPaddingBottom = bottom;
        }

        lastBars = bars;
        lastIme = ime;
        lastPassthrough = passthrough;

        Log.d(TAG, "apply mode=" + mode + " passthrough=" + passthrough + " bars.b=" + bars.bottom
            + " ime.b=" + ime.bottom + " pad.b=" + lastPaddingBottom);
        notifyListeners("insets", buildState());
        return out;
    }

    private JSObject buildState() {
        JSObject data = new JSObject();
        data.put("mode", mode);
        data.put("imeBottom", Math.round(lastIme.bottom / density));
        data.put("barsBottom", Math.round(lastBars.bottom / density));
        data.put("barsTop", Math.round(lastBars.top / density));
        data.put("paddingBottom", Math.round(lastPaddingBottom / density));
        data.put("passthrough", lastPassthrough);
        data.put("webViewMajor", webViewMajor);
        return data;
    }

    @PluginMethod
    public void setMode(PluginCall call) {
        String requested = call.getString("mode", MODE_RESIZE);
        mode = MODE_OVERLAY.equals(requested) ? MODE_OVERLAY : MODE_RESIZE;
        getBridge().executeOnMainThread(() -> {
            Activity activity = getActivity();
            if (activity != null) {
                ViewCompat.requestApplyInsets(activity.getWindow().getDecorView());
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(buildState());
    }

    private int readWebViewMajorVersion() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PackageInfo info = WebView.getCurrentWebViewPackage();
                if (info != null && info.versionName != null) {
                    Matcher m = Pattern.compile("(\\d+)").matcher(info.versionName);
                    if (m.find()) return Integer.parseInt(m.group(1));
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "WebView version lookup failed", t);
        }
        return 0;
    }
}
