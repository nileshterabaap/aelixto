import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  aelix_score: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Helper to generate unique username from email
function generateUsername(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '_');
  const random = Math.random().toString(36).substring(2, 6);
  return `${base}_${random}`.slice(0, 30);
}

const fetchOrCreateProfile = async (userId: string, email?: string, userMetadata?: Record<string, any>): Promise<Profile> => {
  // Try to fetch existing profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    return data as unknown as Profile;
  }

  // Create new profile
  const username = generateUsername(email || '');
  const newProfile = {
    id: userId,
    username,
    display_name: userMetadata?.full_name || email?.split('@')[0] || username,
    avatar_url: userMetadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    bio: null,
    cover_url: null,
    aelix_score: 0,
    settings: {},
  };

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert([{ ...newProfile, user_id: userId }])
    .select()
    .single();

  if (createError) throw createError;
  return created as unknown as Profile;
};

export const useCurrentProfile = () => {
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchOrCreateProfile(user!.id, user!.email, user!.user_metadata),
    enabled: !!user && !sessionLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', user?.id], data);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    },
    onError: (error: any) => {
      console.error('Profile update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  const upsertProfile = (updates: Partial<Profile>) => {
    updateMutation.mutate(updates);
  };

  // Loading is true if session is loading OR if profile query is loading (and user exists)
  const loading = sessionLoading || (!!user && isLoading);

  return { 
    profile: profile ?? null, 
    loading, 
    upsertProfile, 
    refetch: () => refetch() 
  };
};
