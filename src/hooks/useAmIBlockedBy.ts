import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';

/**
 * True when `targetUserId` has blocked the current user.
 * Used to show "This user has blocked you" on their profile page.
 */
export function useAmIBlockedBy(targetUserId?: string) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['am-i-blocked-by', user?.id, targetUserId],
    enabled: !!user?.id && !!targetUserId && user.id !== targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('am_i_blocked_by', {
        _target: targetUserId!,
      });
      if (error) throw error;
      return !!data;
    },
  });
  return { amIBlockedBy: !!query.data, isLoading: query.isLoading };
}