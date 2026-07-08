import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { useToast } from './use-toast';
import { emitMessageThreadRead } from '@/lib/messageReadEvents';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const useMessages = (conversationId: string | null) => {
  const { user } = useSession();
  const { toast } = useToast();
  const cacheKey = conversationId ? `aelixto-messages-${conversationId}` : null;

  const readCache = (): Message[] => {
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

  const [messages, setMessages] = useState<Message[]>(readCache);
  const [loading, setLoading] = useState(messages.length === 0);

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Seed from cache for instant render
    const cached = readCache();
    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setMessages([]);
    }

    fetchMessages();

    // Mark messages as read
    markAsRead();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => {
            const next = [...prev, payload.new as Message];
            if (cacheKey) {
              try {
                window.localStorage.setItem(cacheKey, JSON.stringify(next.slice(-100)));
              } catch { /* ignore */ }
            }
            return next;
          });
          const message = payload.new as Message;
          if (message.sender_id !== user.id) {
            markAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const list = data || [];
      setMessages(list);
      if (cacheKey) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(list.slice(-100)));
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!conversationId || !user) return;

    emitMessageThreadRead(conversationId);

    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!conversationId || !user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  return { messages, loading, sendMessage };
};
