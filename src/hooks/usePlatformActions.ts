import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useConnectedSocials } from './useConnectedSocials';

interface PlatformActionParams {
  action: 'like' | 'unlike' | 'comment' | 'retweet';
  platform: string;
  contentId: string;
  commentText?: string;
}

export const usePlatformActions = () => {
  const queryClient = useQueryClient();
  const { isPlatformConnected, connectPlatform } = useConnectedSocials();

  const mutation = useMutation({
    mutationFn: async ({ action, platform, contentId, commentText }: PlatformActionParams) => {
      if (!isPlatformConnected(platform)) {
        throw new Error('NOT_CONNECTED');
      }

      const { data, error } = await supabase.functions.invoke('platform-action', {
        body: { action, platform, contentId, commentText },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, { action, platform }) => {
      const actionNames: Record<string, string> = {
        like: 'Liked',
        unlike: 'Unliked',
        comment: 'Commented on',
        retweet: 'Retweeted',
      };
      toast.success(`${actionNames[action]} on ${platform}`);
    },
    onError: (error: Error, { platform }) => {
      if (error.message === 'NOT_CONNECTED') {
        toast.error(`Please connect your ${platform} account first`, {
          action: {
            label: 'Connect',
            onClick: () => connectPlatform(platform),
          },
        });
      } else if (error.message === 'TOKEN_EXPIRED') {
        toast.error(`Your ${platform} session has expired. Please reconnect.`, {
          action: {
            label: 'Reconnect',
            onClick: () => connectPlatform(platform),
          },
        });
      } else {
        toast.error('Action failed. Please try again.');
      }
    },
  });

  const likePlatform = (platform: string, contentId: string) => {
    mutation.mutate({ action: 'like', platform, contentId });
  };

  const unlikePlatform = (platform: string, contentId: string) => {
    mutation.mutate({ action: 'unlike', platform, contentId });
  };

  const commentPlatform = (platform: string, contentId: string, text: string) => {
    mutation.mutate({ action: 'comment', platform, contentId, commentText: text });
  };

  const retweetPlatform = (contentId: string) => {
    mutation.mutate({ action: 'retweet', platform: 'x', contentId });
  };

  return {
    likePlatform,
    unlikePlatform,
    commentPlatform,
    retweetPlatform,
    isPending: mutation.isPending,
  };
};
