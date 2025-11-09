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
      // Check if conversation already exists
      const { data: existingParticipants, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (existingParticipants && existingParticipants.length > 0) {
        // Check if any of these conversations include the other user
        const conversationIds = existingParticipants.map(p => p.conversation_id);
        
        const { data: otherUserParticipants, error: otherError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', conversationIds);

        if (otherError) throw otherError;

        if (otherUserParticipants && otherUserParticipants.length > 0) {
          // Conversation exists, navigate to it
          navigate(`/conversation/${otherUserParticipants[0].conversation_id}`);
          return;
        }
      }

      // Create new conversation
      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (conversationError) throw conversationError;

      // Add both participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConversation.id, user_id: user.id },
          { conversation_id: newConversation.id, user_id: otherUserId },
        ]);

      if (participantsError) throw participantsError;

      // Navigate to new conversation
      navigate(`/conversation/${newConversation.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return { startConversation, loading };
};
