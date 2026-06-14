import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';

type CacheGroup =
  | 'feed'
  | 'profile'
  | 'actions'
  | 'comments'
  | 'saved'
  | 'notifications'
  | 'messages';

const invalidateGroup = (queryClient: ReturnType<typeof useQueryClient>, group: CacheGroup, userId?: string) => {
  switch (group) {
    case 'feed':
      queryClient.invalidateQueries({ queryKey: ['following-feed'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-has-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['platform-posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-platform-tabs'] });
      break;
    case 'profile':
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['mutuals'] });
      break;
    case 'actions':
      queryClient.invalidateQueries({ queryKey: ['like'] });
      queryClient.invalidateQueries({ queryKey: ['save'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['following-feed'] });
      queryClient.invalidateQueries({ queryKey: ['platform-posts'] });
      break;
    case 'comments':
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['following-feed'] });
      break;
    case 'saved':
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-items'] });
      queryClient.invalidateQueries({ queryKey: ['save'] });
      break;
    case 'notifications':
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        queryClient.invalidateQueries({ queryKey: ['notification-count', userId] });
      }
      break;
    case 'messages':
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      break;
  }
};

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const pendingGroupsRef = useRef<Set<CacheGroup>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pendingGroups = pendingGroupsRef.current;

    const flush = () => {
      timerRef.current = null;
      const groups = Array.from(pendingGroups);
      pendingGroups.clear();
      groups.forEach((group) => invalidateGroup(queryClient, group, user?.id));
    };

    const queue = (...groups: CacheGroup[]) => {
      groups.forEach((group) => pendingGroups.add(group));
      if (timerRef.current) return;
      timerRef.current = setTimeout(flush, 300);
    };

    const channel = supabase
      .channel(`aelixto-realtime-sync-${user?.id ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => queue('feed', 'profile', 'saved'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => queue('profile', 'feed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => queue('actions', 'feed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reposts' }, () => queue('actions', 'feed', 'profile'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => queue('comments', 'feed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saves' }, () => queue('saved', 'actions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => queue('feed', 'profile'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => queue('notifications'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => queue('messages'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => queue('messages'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_views' }, () => queue('profile'))
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingGroups.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);
};
