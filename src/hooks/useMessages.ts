import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { useToast } from './use-toast';
import { emitMessageThreadRead } from '@/lib/messageReadEvents';

const MAX_FETCH_RETRIES = 4;

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface OtherParticipantStatus {
  user_id: string;
  last_read_at: string | null;
  last_delivered_at: string | null;
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [otherStatus, setOtherStatus] = useState<OtherParticipantStatus | null>(null);
  const fetchGeneration = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setLoading(true);
    }

    fetchGeneration.current += 1;
    void fetchMessages(0, fetchGeneration.current);

    // Mark messages as read
    markAsRead();
    // Fetch other participant's read/delivered status
    fetchOtherStatus();

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
            const incoming = payload.new as Message;
            if (prev.some(m => m.id === incoming.id)) return prev;
            const next = [...prev, incoming];
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const deletedId = (payload.old as Message)?.id;
          if (!deletedId) return;
          setMessages(prev => {
            const next = prev.filter(m => m.id !== deletedId);
            if (cacheKey) {
              try {
                window.localStorage.setItem(cacheKey, JSON.stringify(next.slice(-100)));
              } catch { /* ignore */ }
            }
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updated = payload.new as Message;
          if (!updated?.id) return;
          setMessages(prev => {
            const next = prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m));
            if (cacheKey) {
              try {
                window.localStorage.setItem(cacheKey, JSON.stringify(next.slice(-100)));
              } catch { /* ignore */ }
            }
            return next;
          });
        }
      )
      .subscribe();

    // Subscribe to updates on other participant's read/delivered timestamps
    const partsChannel = supabase
      .channel(`participants-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null; last_delivered_at: string | null };
          if (row.user_id !== user.id) {
            setOtherStatus({
              user_id: row.user_id,
              last_read_at: row.last_read_at,
              last_delivered_at: row.last_delivered_at,
            });
          }
        }
      )
      .subscribe();

    // Coming back to the app or regaining signal: refresh the thread silently
    // so anything missed while away appears without an error.
    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      fetchGeneration.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      void fetchMessages(0, fetchGeneration.current);
      fetchOtherStatus();
    };
    document.addEventListener('visibilitychange', refreshSilently);
    window.addEventListener('online', refreshSilently);

    return () => {
      fetchGeneration.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      document.removeEventListener('visibilitychange', refreshSilently);
      window.removeEventListener('online', refreshSilently);
      supabase.removeChannel(channel);
      supabase.removeChannel(partsChannel);
    };
  }, [conversationId, user]);

  const fetchOtherStatus = async () => {
    if (!conversationId || !user) return;
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id, last_read_at, last_delivered_at')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setOtherStatus({
          user_id: data.user_id,
          last_read_at: (data as { last_read_at: string | null }).last_read_at ?? null,
          last_delivered_at: (data as { last_delivered_at: string | null }).last_delivered_at ?? null,
        });
      }
    } catch (error) {
      console.error('Error fetching other status:', error);
    }
  };

  // Loads the thread quietly. A dropped connection (common right after the app
  // returns from the background) is retried with backoff instead of flashing
  // an error; only if every attempt fails AND nothing is on screen do we show
  // an inline "try again" state.
  const fetchMessages = async (attempt = 0, generation = fetchGeneration.current) => {
    if (!conversationId) return;
    if (attempt === 0) setLoadFailed(false);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (generation !== fetchGeneration.current) return;
      const seen = new Set<string>();
      const list = (data || []).filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(list);
      setLoadFailed(false);
      setLoading(false);
      if (cacheKey) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(list.slice(-100)));
        } catch { /* ignore */ }
      }
    } catch (error) {
      if (generation !== fetchGeneration.current) return;
      if (attempt < MAX_FETCH_RETRIES) {
        const delay = 600 * 2 ** attempt;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          void fetchMessages(attempt + 1, generation);
        }, delay);
        return;
      }
      console.warn('Messages could not be loaded after retries:', error);
      setLoadFailed(true);
      setLoading(false);
    }
  };

  const retry = () => {
    fetchGeneration.current += 1;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setLoadFailed(false);
    setLoading(prev => prev || messages.length === 0);
    void fetchMessages(0, fetchGeneration.current);
  };

  const markAsRead = async () => {
    if (!conversationId || !user) return;

    emitMessageThreadRead(conversationId);

    try {
      const now = new Date().toISOString();
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now, last_delivered_at: now })
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

  return { messages, loading, sendMessage, otherStatus };
};
