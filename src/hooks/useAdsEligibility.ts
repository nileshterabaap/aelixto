import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceId';
import { useSession } from '@/hooks/useSession';
import { AD_DEV_BYPASS_INSTALL_AGE, AD_MIN_INSTALL_AGE_MS } from '@/config/ads';
import { adsReady } from '@/lib/adConsent';

const LS_INSTALL_KEY = 'aelixto_install_first_seen_at';

function getLocalInstallAgeMs(): number {
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

/**
 * Returns true only when EVERY condition is met:
 *  - running natively (Capacitor Android/iOS)
 *  - Google Mobile Ads SDK initialized and consent resolved
 *  - install age >= 48 h (server-tracked for signed-in users, local fallback otherwise)
 */
export function useAdsEligibility(): boolean {
  const { user } = useSession();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Capacitor.isNativePlatform()) return;
      const sdkOk = await adsReady();
      if (!sdkOk || cancelled) return;

      // Developer-only: skip the 48h gate in DEV builds so on-device QA
      // sees ads immediately. Release builds always fall through to the
      // real age check below.
      if (AD_DEV_BYPASS_INSTALL_AGE) {
        if (!cancelled) setEligible(true);
        return;
      }

      const localAge = getLocalInstallAgeMs();
      let ageMs = localAge;

      if (user?.id) {
        try {
          const deviceId = getDeviceId();
          const platform = Capacitor.getPlatform();
          // Upsert (no-op if the row already exists so first_seen_at is preserved)
          await (supabase as any)
            .from('install_metadata')
            .upsert(
              { user_id: user.id, device_id: deviceId, platform },
              { onConflict: 'user_id,device_id', ignoreDuplicates: true },
            );
          const { data } = await (supabase as any)
            .from('install_metadata')
            .select('first_seen_at')
            .eq('user_id', user.id)
            .eq('device_id', deviceId)
            .maybeSingle();
          if (data?.first_seen_at) {
            const serverAge = Date.now() - new Date(data.first_seen_at).getTime();
            ageMs = Math.max(serverAge, localAge);
          }
        } catch (e) {
          console.warn('[ads] install_metadata lookup failed', e);
        }
      }

      if (!cancelled && ageMs >= AD_MIN_INSTALL_AGE_MS) {
        setEligible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return eligible;
}
