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
    // Get current user (may be null for anonymous)
    const { data: { user } } = await supabase.auth.getUser();
    
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

    const { data, error } = await supabase.functions.invoke('record-view', { body: payload });

    if (error) {
      console.error('[useViewTracking] Error:', error);
      return false;
    }

    const success = data?.ok === true;
    return success;
  } catch (error) {
    console.error('[useViewTracking] Exception:', error);
    return false;
  }
}

async function trackViewBeforeNavigation({ postId, eventType, durationMs = 0 }: TrackViewParams): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const deviceHash = await sha256(getDeviceId());
    const payload = JSON.stringify({
      post_id: postId,
      event_type: eventType,
      duration_ms: durationMs,
      device_hash: deviceHash,
      viewer_id: session?.user?.id || null,
    });

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.functions.supabase.co/record-view`;
    const headers = {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return true;
    }

    await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      keepalive: true,
    });
    return true;
  } catch (error) {
    console.error('[useViewTracking] Navigation-safe exception:', error);
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
  return await trackViewBeforeNavigation({ postId, eventType: 'article_open' });
}

/**
 * Track external link visit (Visit click) for +1 engagement score.
 */
export async function trackExternalVisit(postId: string): Promise<boolean> {
  return await trackViewBeforeNavigation({ postId, eventType: 'external_visit' });
}

/**
 * Track a click-through to the original platform (any embed) for +1 engagement score.
 * Fires once per post per cooldown window — backend dedups.
 */
export async function trackOriginalVisit(postId: string): Promise<boolean> {
  return await trackViewBeforeNavigation({ postId, eventType: 'original_visit' });
}
