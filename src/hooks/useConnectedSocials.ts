import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';
import { toast } from 'sonner';

interface ConnectedSocial {
  id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string;
  created_at: string;
}

interface DismissedPrompts {
  dismissed_connect_prompts?: string[];
}

export const useConnectedSocials = () => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: connectedSocials = [], isLoading } = useQuery({
    queryKey: ['connected-socials', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from('connected_socials')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      return data as ConnectedSocial[];
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dismissedPrompts = [] } = useQuery({
    queryKey: ['dismissed-prompts', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('user_id', session.user.id)
        .single();

      if (error) return [];
      const settings = data?.settings as DismissedPrompts;
      return settings?.dismissed_connect_prompts || [];
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isPlatformConnected = useCallback(
    (platform: string) => {
      return connectedSocials.some((s) => s.platform === platform);
    },
    [connectedSocials]
  );

  const isPromptDismissed = useCallback(
    (platform: string) => {
      return dismissedPrompts.includes(platform);
    },
    [dismissedPrompts]
  );

  const shouldShowConnectPrompt = useCallback(
    (platform: string) => {
      return !isPlatformConnected(platform) && !isPromptDismissed(platform);
    },
    [isPlatformConnected, isPromptDismissed]
  );

  const getConnectedAccount = useCallback(
    (platform: string) => {
      return connectedSocials.find((s) => s.platform === platform);
    },
    [connectedSocials]
  );

  const dismissPromptMutation = useMutation({
    mutationFn: async (platform: string) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('user_id', session.user.id)
        .single();

      const currentSettings = (profile?.settings as Record<string, unknown>) || {};
      const currentDismissed = (currentSettings.dismissed_connect_prompts as string[]) || [];

      if (currentDismissed.includes(platform)) return;

      const updatedSettings = {
        ...currentSettings,
        dismissed_connect_prompts: [...currentDismissed, platform],
      };

      const { error } = await supabase
        .from('profiles')
        .update({ settings: updatedSettings })
        .eq('user_id', session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dismissed-prompts'] });
    },
  });

  const connectPlatformMutation = useMutation({
    mutationFn: async (platform: string) => {
      const redirectUrl = `${window.location.origin}/settings?oauth_callback=true&platform=${platform}`;

      const { data, error } = await supabase.functions.invoke('outstand-oauth', {
        body: {
          action: 'initiate',
          platform,
          redirectUrl,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL returned');
      }
    },
    onError: (error) => {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect. Please try again.');
    },
  });

  const disconnectPlatformMutation = useMutation({
    mutationFn: async (platform: string) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('connected_socials')
        .delete()
        .eq('user_id', session.user.id)
        .eq('platform', platform);

      if (error) throw error;
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['connected-socials'] });
      toast.success(`Disconnected from ${platform}`);
    },
    onError: () => {
      toast.error('Failed to disconnect. Please try again.');
    },
  });

  return {
    connectedSocials,
    isLoading,
    isPlatformConnected,
    isPromptDismissed,
    shouldShowConnectPrompt,
    getConnectedAccount,
    dismissPrompt: dismissPromptMutation.mutate,
    connectPlatform: connectPlatformMutation.mutate,
    disconnectPlatform: disconnectPlatformMutation.mutate,
    isConnecting: connectPlatformMutation.isPending,
    isDisconnecting: disconnectPlatformMutation.isPending,
  };
};
