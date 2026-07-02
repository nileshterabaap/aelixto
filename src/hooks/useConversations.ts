import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';

export interface ConversationWithDetails {
  id: string;
  updated_at: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export const useConversations = () => {
  const { user } = useSession();
  const cacheKey = user ? `aelixto-conversations-${user.id}` : null;

  const readCache = (): ConversationWithDetails[] => {
    if (!cacheKey || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [conversations, setConversations] = useState<ConversationWithDetails[]>(readCache);
  const [loading, setLoading] = useState(conversations.length === 0);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Seed from cache immediately on user change for instant render
    const cached = readCache();
    if (cached.length > 0) {
      setConversations(cached);
      setLoading(false);
    }

    fetchConversations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get all conversations for current user
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      // Get conversation details
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (conversationError) throw conversationError;

      // Get other participants
      const { data: otherParticipants, error: otherError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      // Get profiles for other participants
      const otherUserIds = otherParticipants?.map(p => p.user_id) || [];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', otherUserIds);

      if (profileError) throw profileError;

      // Get last messages for each conversation
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at, sender_id')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      // Combine all data
      const conversationsWithDetails: ConversationWithDetails[] = conversationData?.map(conv => {
        const otherParticipant = otherParticipants?.find(p => p.conversation_id === conv.id);
        const profile = profiles?.find(p => p.user_id === otherParticipant?.user_id);
        const lastMessage = messages?.find(m => m.conversation_id === conv.id);
        const participant = participantData.find(p => p.conversation_id === conv.id);
        
        // Count unread messages
        const conversationMessages = messages?.filter(m => m.conversation_id === conv.id) || [];
        const unreadCount = conversationMessages.filter(m => 
          m.sender_id !== user.id && 
          new Date(m.created_at) > new Date(participant?.last_read_at || 0)
        ).length;

        return {
          id: conv.id,
          updated_at: conv.updated_at,
          other_user: {
            id: profile?.user_id || '',
            username: profile?.username || 'Unknown',
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
          },
          last_message: lastMessage ? {
            content: lastMessage.content,
            created_at: lastMessage.created_at,
            sender_id: lastMessage.sender_id,
          } : null,
          unread_count: unreadCount,
        };
      }) || [];

      setConversations(conversationsWithDetails);
      if (cacheKey) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(conversationsWithDetails));
        } catch {
          /* quota exceeded - ignore */
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  return { conversations, loading, refetch: fetchConversations };
};
