import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';

/**
 * Returns whether the current user has blocked `targetUserId`.
 * Used to show an "Unblock" button/menu item instead of Follow.
 */
export function useIsBlocked(targetUserId?: string) {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ['is-blocked', user?.id, targetUserId],
    enabled: !!user?.id && !!targetUserId && user.id !== targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', user!.id)
        .eq('blocked_user_id', targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  return { isBlocked: !!query.data, isLoading: query.isLoading, refetch: query.refetch };
}