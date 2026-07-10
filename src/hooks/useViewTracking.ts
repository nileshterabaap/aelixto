import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, sha256 } from '@/lib/deviceId';
import { useCallback } from 'react';
import { traceLog } from '@/lib/traceLog';

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
    traceLog('trackView', 'entry', { postId, detail: { eventType, durationMs } });
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

    traceLog('trackView', 'invoke:record-view', { postId, detail: { eventType, viewer_id: payload.viewer_id } });
    const { data, error } = await supabase.functions.invoke('record-view', { body: payload });

    if (error) {
      traceLog('trackView', 'record-view:error', { postId, detail: { eventType }, error });
      return false;
    }

    const success = data?.ok === true;
    traceLog('trackView', 'record-view:result', { postId, detail: { eventType, data } });
    return success;
  } catch (error) {
    traceLog('trackView', 'exception', { postId, detail: { eventType }, error });
    return false;
  }
}

async function trackViewBeforeNavigation({ postId, eventType, durationMs = 0 }: TrackViewParams): Promise<boolean> {
  try {
    traceLog('trackViewBeforeNavigation', 'entry', { postId, detail: { eventType } });
    const { data: { session } } = await supabase.auth.getSession();
    const deviceHash = await sha256(getDeviceId());
    const payload = JSON.stringify({
      post_id: postId,
      event_type: eventType,
      duration_ms: durationMs,
      device_hash: deviceHash,
      viewer_id: session?.user?.id || null,
    });

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    const url = supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/record-view`
      : `https://${projectId}.functions.supabase.co/record-view`;
    traceLog('trackViewBeforeNavigation', 'post', { postId, detail: { eventType, url, hasBeacon: !!navigator.sendBeacon } });
    // No custom headers/content-type here: outbound clicks can navigate away
    // immediately, so this must avoid CORS preflight and use keepalive/beacon.
    if (navigator.sendBeacon && navigator.sendBeacon(url, payload)) {
      traceLog('trackViewBeforeNavigation', 'sendBeacon:ok', { postId, detail: { eventType } });
      return true;
    }

    const res = await fetch(url, {
      method: 'POST',
      body: payload,
      keepalive: true,
    });
    traceLog('trackViewBeforeNavigation', 'fetch:complete', { postId, detail: { eventType, status: res.status } });
    return true;
  } catch (error) {
    traceLog('trackViewBeforeNavigation', 'exception', { postId, detail: { eventType }, error });
    return false;
  }
}

/**
 * Hook for tracking video play events
 */
export function useVideoPlayTracking() {
  return useCallback(async (postId: string) => {
    return await trackView({
      postId,
      eventType: 'video_play',
      durationMs: 0,
    });
  }, []);
}

/**
 * Hook for tracking image view events (2+ seconds)
 */
export function useImageViewTracking() {
  return useCallback(async (postId: string) => {
    return await trackView({
      postId,
      eventType: 'image_view',
      durationMs: 2000,
    });
  }, []);
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
