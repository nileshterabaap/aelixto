package com.aelixto.edgetoedge;

import android.app.Activity;
import android.util.Log;
import android.view.View;
import android.view.Window;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Guarantees the Capacitor Activity window is edge-to-edge on every Android
 * version and every OEM skin.
 *
 * Why this exists
 * ---------------
 * `@capacitor-community/safe-area` pads the decor view by
 * `WindowInsetsCompat.Type.ime().bottom` while the keyboard is visible
 * (SafeAreaPlugin.java, setupSafeAreaInsets()). That IME inset is measured
 * from the BOTTOM OF THE WINDOW. It is therefore only correct when the window
 * really reaches the bottom of the screen.
 *
 * If the Activity is not edge-to-edge, the system has already inset the window
 * by the navigation bar, yet the IME inset still describes the full keyboard
 * region — so the plugin's padding overshoots by exactly the navigation-bar
 * height. That is the ~44px blank strip between the message composer and the
 * keyboard. Devices that force edge-to-edge (Android 16 / targetSdk 36) never
 * showed the gap, which matches this diagnosis.
 *
 * There is deliberately NO JS API and NO inset maths here: the Capacitor
 * bridge calls `load()` for every bundled plugin, and the single call below
 * only fixes the window geometry. `@capacitor-community/safe-area` remains the
 * one and only owner of inset handling.
 */
@CapacitorPlugin(name = "EdgeToEdgeFix")
public class EdgeToEdgePlugin extends Plugin {

    @Override
    public void load() {
        super.load();

        final Activity activity = getActivity();
        if (activity == null) {
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Window window = activity.getWindow();
                if (window == null) {
                    return;
                }

                // Core of edge-to-edge: the window lays out behind the system
                // bars, so its bottom edge is the physical bottom of the
                // screen and ime().bottom becomes the true keyboard height.
                WindowCompat.setDecorFitsSystemWindows(window, false);

                // AndroidX helper: also applies the transparent/scrim-free bar
                // treatment and the API 35 enforcement opt-in. BridgeActivity
                // extends AppCompatActivity, which is a ComponentActivity.
                if (activity instanceof ComponentActivity) {
                    EdgeToEdge.enable((ComponentActivity) activity);
                }

                // Re-dispatch insets so SafeAreaPlugin's listener recomputes
                // immediately with the corrected window geometry.
                View decorView = window.getDecorView();
                if (decorView != null) {
                    decorView.requestApplyInsets();
                }
            } catch (Throwable t) {
                Log.w("EdgeToEdgeFix", "Failed to enforce edge-to-edge", t);
            }
        });
    }
}
