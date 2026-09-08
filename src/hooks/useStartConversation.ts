import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { useToast } from './use-toast';
import { useNavigate } from 'react-router-dom';

export const useStartConversation = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const startConversation = async (otherUserId: string) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to send messages',
        variant: 'destructive',
      });
      return;
    }

    if (user.id === otherUserId) {
      toast({
        title: 'Error',
        description: 'You cannot message yourself',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Single server-side call: checks privacy settings + blocking,
      // reuses an existing conversation or creates one atomically.
      const { data, error } = await supabase.rpc('start_conversation', {
        _other_user_id: otherUserId,
      });

      if (error) throw error;
      if (!data) throw new Error('Failed to start conversation');

      navigate(`/conversation/${data}`);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast({
        title: 'Cannot message',
        description: error?.message || 'Failed to start conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return { startConversation, loading };
};
