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
    console.log('startConversation called with:', { otherUserId, currentUserId: user?.id });
    
    if (!user) {
      console.error('No user found');
      toast({
        title: 'Error',
        description: 'You must be logged in to send messages',
        variant: 'destructive',
      });
      return;
    }

    if (user.id === otherUserId) {
      console.error('Cannot message yourself');
      toast({
        title: 'Error',
        description: 'You cannot message yourself',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Checking for existing conversations...');
      // Check if conversation already exists
      const { data: existingParticipants, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      console.log('Existing participants query result:', { existingParticipants, participantError });
      if (participantError) {
        console.error('Error fetching existing participants:', participantError);
        throw participantError;
      }

      if (existingParticipants && existingParticipants.length > 0) {
        console.log('Found existing conversations, checking for existing conversation with other user...');
        // Check if any of these conversations include the other user
        const conversationIds = existingParticipants.map(p => p.conversation_id);
        
        const { data: otherUserParticipants, error: otherError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', conversationIds);

        console.log('Other user participants query result:', { otherUserParticipants, otherError });
        if (otherError) {
          console.error('Error fetching other user participants:', otherError);
          throw otherError;
        }

        if (otherUserParticipants && otherUserParticipants.length > 0) {
          console.log('Found existing conversation, navigating to it:', otherUserParticipants[0].conversation_id);
          // Conversation exists, navigate to it
          navigate(`/conversation/${otherUserParticipants[0].conversation_id}`);
          return;
        }
      }

      console.log('No existing conversation found, creating new conversation...');
      // Create new conversation
      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      console.log('New conversation result:', { newConversation, conversationError });
      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        throw conversationError;
      }

      console.log('Adding participants to conversation...');
      // Add both participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConversation.id, user_id: user.id },
          { conversation_id: newConversation.id, user_id: otherUserId },
        ]);

      console.log('Participants insert result:', { participantsError });
      if (participantsError) {
        console.error('Error adding participants:', participantsError);
        throw participantsError;
      }

      console.log('Successfully created conversation, navigating to:', newConversation.id);
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
