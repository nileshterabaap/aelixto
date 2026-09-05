import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Keyboard mode owned by the native side (Android only).
 *
 *  - `resize`  the WebView shrinks by the keyboard height (chat, comments).
 *  - `overlay` the WebView keeps its size; the keyboard simply covers the
 *              bottom. Used while the link box is open over the feed so the
 *              embed-heavy page is never relaid out by a keyboard show/hide.
 */
export type InsetsMode = 'resize' | 'overlay';

export interface InsetsState {
  mode: InsetsMode;
  /** Keyboard inset in CSS px (0 when hidden). Includes the nav-bar band. */
  imeBottom: number;
  /** Bottom system-bar (navigation bar / gesture pill) inset in CSS px. */
  barsBottom: number;
  barsTop: number;
  /** Bottom padding the plugin currently applies to the decor view (CSS px). */
  paddingBottom: number;
  /** True when Chromium >= 140 resolves env(safe-area-inset-*) itself. */
  passthrough: boolean;
  webViewMajor: number;
}

export interface WindowInsetsOwnerPlugin {
  setMode(options: { mode: InsetsMode }): Promise<void>;
  getState(): Promise<InsetsState>;
  addListener(eventName: 'insets', listener: (state: InsetsState) => void): Promise<PluginListenerHandle>;
}

export const WindowInsetsOwner = registerPlugin<WindowInsetsOwnerPlugin>('WindowInsetsOwner');
