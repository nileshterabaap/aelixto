import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { toast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
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

export const useCurrentProfile = () => {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchOrCreateProfile();
  }, [user, sessionLoading]);

  const fetchOrCreateProfile = async () => {
    if (!user) return;

    try {
      // Try to fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data as unknown as Profile);
      } else {
        // Create new profile
        const username = generateUsername(user.email || '');
        const newProfile = {
          id: user.id,
          username,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || username,
          avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          bio: null,
          cover_url: null,
          aelix_score: 0,
          settings: {},
        };

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert([{ ...newProfile, user_id: user.id }])
          .select()
          .single();

        if (createError) throw createError;
        setProfile(created as unknown as Profile);
      }
    } catch (error: any) {
      console.error('Profile fetch/create error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const upsertProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data as unknown as Profile);
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  return { profile, loading, upsertProfile, refetch: fetchOrCreateProfile };
};

// Helper to generate unique username from email
function generateUsername(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '_');
  const random = Math.random().toString(36).substring(2, 6);
  return `${base}_${random}`.slice(0, 30);
}
