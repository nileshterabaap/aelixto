import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';

export function useBlockedUsers() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id, blocked_user_id, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for blocked users
      if (!data || data.length === 0) return [];

      const blockedIds = data.map((b) => b.blocked_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', blockedIds);

      return data.map((block) => ({
        ...block,
        profile: profiles?.find((p) => p.user_id === block.blocked_user_id) || null,
      }));
    },
    enabled: !!user,
  });

  const unblock = useMutation({
    mutationFn: async (blockedUserId: string) => {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', user!.id)
        .eq('blocked_user_id', blockedUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
  });

  return { blockedUsers: query.data || [], isLoading: query.isLoading, unblock };
}
