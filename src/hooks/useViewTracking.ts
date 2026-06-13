import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, sha256 } from '@/lib/deviceId';

type EventType = 'video_play' | 'image_view' | 'article_open' | 'external_visit' | 'original_visit';

interface TrackViewParams {
  postId: string;
  eventType: EventType;
  durationMs?: number;
}

/**
 * Track engagement events (video plays, image views)
 * Sends to edge function which handles deduplication and scoring
 */
export async function trackView({ postId, eventType, durationMs = 0 }: TrackViewParams): Promise<boolean> {
  try {
    // Get current session/user (may be null for anonymous). getSession is local
    // and avoids a network round-trip right before outbound navigation.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    
    // Get device fingerprint and hash it
    const deviceId = getDeviceId();
    const deviceHash = await sha256(deviceId);

    // Prepare payload
    const payload = {
      post_id: postId,
      event_type: eventType,
      duration_ms: durationMs,
      device_hash: deviceHash,
      viewer_id: user?.id || null,
    };

    const shouldKeepAlive =
      eventType === 'article_open' ||
      eventType === 'external_visit' ||
      eventType === 'original_visit';

    let data: any = null;
    let error: any = null;

    if (shouldKeepAlive) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/record-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${session?.access_token || anonKey}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      data = await response.json().catch(() => null);
      if (!response.ok) error = data || new Error(`record-view failed: ${response.status}`);
    } else {
      const result = await supabase.functions.invoke('record-view', {
        body: payload,
      });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[useViewTracking] Error:', error);
      return false;
    }

    const success = data?.ok === true;
    if (success && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aelixto:engagement-tracked', { detail: { postId, eventType } }));
    }
    return success;
  } catch (error) {
    console.error('[useViewTracking] Exception:', error);
    return false;
  }
}

/**
 * Hook for tracking video play events
 */
export function useVideoPlayTracking() {
  return async (postId: string) => {
    return await trackView({
      postId,
      eventType: 'video_play',
      durationMs: 0,
    });
  };
}

/**
 * Hook for tracking image view events (2+ seconds)
 */
export function useImageViewTracking() {
  return async (postId: string) => {
    return await trackView({
      postId,
      eventType: 'image_view',
      durationMs: 2000,
    });
  };
}

/**
 * Track article open (Continue Reading click) for +1 engagement score.
 */
export async function trackArticleOpen(postId: string): Promise<boolean> {
  return await trackView({ postId, eventType: 'article_open' });
}

/**
 * Track external link visit (Visit click) for +1 engagement score.
 */
export async function trackExternalVisit(postId: string): Promise<boolean> {
  return await trackView({ postId, eventType: 'external_visit' });
}

/**
 * Track a click-through to the original platform (any embed) for +1 engagement score.
 * Fires once per post per cooldown window — backend dedups.
 */
export async function trackOriginalVisit(postId: string): Promise<boolean> {
  return await trackView({ postId, eventType: 'original_visit' });
}
