import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, sha256 } from '@/lib/deviceId';

type EventType = 'video_play' | 'image_view';

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
    console.log('[trackView] Starting', { postId, eventType, durationMs });
    // Get current user (may be null for anonymous)
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[trackView] User', { userId: user?.id || 'anonymous' });
    
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

    // Call edge function
    console.log('[trackView] Calling edge function', { payload });
    const { data, error } = await supabase.functions.invoke('record-view', {
      body: payload,
    });

    console.log('[trackView] Edge function response', { data, error });

    if (error) {
      console.error('[useViewTracking] Error:', error);
      return false;
    }

    const success = data?.ok === true;
    console.log('[trackView] Success', { success });
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
