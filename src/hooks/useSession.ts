import { useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { saveSession } from '@/lib/accountStore';

interface SessionData {
  session: Session | null;
  user: User | null;
}

const fetchSession = async (): Promise<SessionData> => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    session,
    user: session?.user ?? null,
  };
};

export const useSession = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: Infinity, // Session doesn't go stale
    gcTime: Infinity, // Keep in cache forever
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Listen for auth changes and update cache
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(['session'], {
        session,
        user: session?.user ?? null,
      });
      if (session) {
        saveSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    session: data?.session ?? null,
    user: data?.user ?? null,
    loading: isLoading,
  };
};
