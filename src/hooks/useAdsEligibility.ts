import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { adsReady } from '@/lib/adConsent';
import { supabase } from '@/integrations/supabase/client';

// Shared with the review prompt: first time this install opened the app.
const LS_INSTALL_KEY = 'aelixto_install_first_seen_at';
const LS_GATE_CACHE = 'aelixto_ads_gate_cached';
export const INSTALL_GATE_MS = 48 * 60 * 60 * 1000;

function getInstallAgeMs(): number {
  try {
    let v = localStorage.getItem(LS_INSTALL_KEY);
    if (!v) {
      v = String(Date.now());
      localStorage.setItem(LS_INSTALL_KEY, v);
    }
    return Date.now() - Number(v);
  } catch {
    return 0;
  }
}

/** Remote switch (backend `remote_flags.ads_48h_install_gate`). Fails safe to ON. */
async function isInstallGateEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('remote_flags')
      .select('enabled')
      .eq('key', 'ads_48h_install_gate')
      .maybeSingle();
    if (error || !data) throw error ?? new Error('missing');
    try { localStorage.setItem(LS_GATE_CACHE, data.enabled ? '1' : '0'); } catch {}
    return data.enabled;
  } catch {
    try { return localStorage.getItem(LS_GATE_CACHE) !== '0'; } catch { return true; }
  }
}

/**
 * Sticky, module-level reason for the current eligibility verdict. The
 * eligibility effect runs once at cold start, so its logs are usually gone by
 * the time a logcat capture starts. This value is re-printed on every feed
 * interleave so the reason is always visible in a capture.
 */
export let adsEligibilityReason = 'pending (effect not run yet)';
function setReason(r: string) {
  adsEligibilityReason = r;
  console.log('[ads] eligibility reason ->', r);
}

/**
 * Returns true only when EVERY condition is met:
 *  - running natively (Capacitor Android/iOS)
 *  - Google Mobile Ads SDK initialized and consent resolved
 */
export function useAdsEligibility(): boolean {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Capacitor.isNativePlatform()) {
        setReason('not a native platform');
        return;
      }
      console.log('[ads] eligibility: native platform detected, waiting for SDK…');
      const sdkOk = await adsReady();
      if (!sdkOk || cancelled) {
        setReason(`SDK/consent not ready (adsReady=${sdkOk}, cancelled=${cancelled})`);
        console.log('[ads] eligibility BLOCKED: sdkReady =', sdkOk, 'cancelled =', cancelled);
        return;
      }

      const gateOn = await isInstallGateEnabled();
      if (cancelled) return;
      if (gateOn) {
        const age = getInstallAgeMs();
        if (age < INSTALL_GATE_MS) {
          setReason(`48h install gate: ${Math.round((INSTALL_GATE_MS - age) / 60000)} min left`);
          return;
        }
      }
      setReason(`ELIGIBLE (gate ${gateOn ? 'on, passed' : 'off'})`);
      setEligible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return eligible;
}
