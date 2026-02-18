import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from './useSession';

export type CommentPermission = 'everyone' | 'followers' | 'no_one';
export type MessagePermission = 'everyone' | 'followers' | 'following' | 'no_one';
export type MentionPermission = 'everyone' | 'followers' | 'following' | 'no_one';

export interface InteractionSettings {
  who_can_comment: CommentPermission;
  who_can_message: MessagePermission;
  who_can_mention: MentionPermission;
}

const DEFAULT_SETTINGS: InteractionSettings = {
  who_can_comment: 'everyone',
  who_can_message: 'everyone',
  who_can_mention: 'everyone',
};

export function getInteractionSettings(profileSettings: Record<string, any> | null | undefined): InteractionSettings {
  if (!profileSettings) return DEFAULT_SETTINGS;
  return {
    who_can_comment: profileSettings.who_can_comment || 'everyone',
    who_can_message: profileSettings.who_can_message || 'everyone',
    who_can_mention: profileSettings.who_can_mention || 'everyone',
  };
}

/**
 * Check if `actorId` is allowed to perform `action` on `targetUserId`'s content.
 * Returns { allowed, reason }.
 */
export function useCanInteract(targetUserId: string | undefined, action: 'comment' | 'message' | 'mention') {
  const { user } = useSession();

  return useQuery({
    queryKey: ['can-interact', targetUserId, user?.id, action],
    queryFn: async () => {
      if (!targetUserId || !user) return { allowed: false, reason: 'Not authenticated' };
      if (targetUserId === user.id) return { allowed: true, reason: '' };

      // Fetch target profile settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('user_id', targetUserId)
        .single();

      const settings = getInteractionSettings(profile?.settings as any);

      let permValue: string;
      if (action === 'comment') permValue = settings.who_can_comment;
      else if (action === 'message') permValue = settings.who_can_message;
      else permValue = settings.who_can_mention;

      if (permValue === 'everyone') return { allowed: true, reason: '' };
      if (permValue === 'no_one') return { allowed: false, reason: 'This user has disabled this interaction' };

      // Check follower/following relationships
      if (permValue === 'followers') {
        // Actor must be a follower of target (actor follows target)
        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle();
        return data
          ? { allowed: true, reason: '' }
          : { allowed: false, reason: 'Only followers can do this' };
      }

      if (permValue === 'following') {
        // Actor must be someone the target follows (target follows actor)
        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', targetUserId)
          .eq('following_id', user.id)
          .maybeSingle();
        return data
          ? { allowed: true, reason: '' }
          : { allowed: false, reason: 'Only people this user follows can do this' };
      }

      return { allowed: true, reason: '' };
    },
    enabled: !!targetUserId && !!user,
    staleTime: 60_000,
  });
}
