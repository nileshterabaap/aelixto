import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { mustForceUpdate, ANDROID_STORE_URL, IOS_STORE_URL } from '@/lib/forceUpdate';

/**
 * Full-screen "please update" lock for native apps. Checks the backend
 * switch on launch and on every return to the app. Website is never affected.
 * Any failure (offline, missing row) lets the person in.
 */
export function ForceUpdateGate() {
  const [blocked, setBlocked] = useState(false);
  const platform = Capacitor.getPlatform();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const key = platform === 'ios' ? 'force_update_ios' : 'force_update_android';

    const check = async () => {
      try {
        const [{ data }, info] = await Promise.all([
          supabase.from('remote_flags').select('enabled, min_build').eq('key', key).maybeSingle(),
          App.getInfo(),
        ]);
        if (!cancelled) setBlocked(mustForceUpdate(data ?? null, info.build));
      } catch {
        /* never lock people out on errors */
      }
    };

    check();
    const sub = App.addListener('appStateChange', ({ isActive }) => { if (isActive) check(); });
    return () => {
      cancelled = true;
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [platform]);

  if (!blocked) return null;

  const openStore = () => {
    const url = platform === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    window.open(url, '_system');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Update required"
    >
      <img src="/icon-1024.png" alt="Aelixto" className="h-20 w-20 rounded-2xl" />
      <h1 className="text-xl font-semibold text-foreground">Update Aelixto to continue</h1>
      <p className="text-sm text-muted-foreground">
        A new version of Aelixto is available with important fixes. Please update to keep using the app.
      </p>
      <Button className="w-full max-w-xs" onClick={openStore}>Update</Button>
    </div>
  );
}
