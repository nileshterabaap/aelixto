import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './useSession';
import { emitMessageThreadRead } from '@/lib/messageReadEvents';
import {
  OutboxMessage,
  OutgoingStatus,
  SEND_ATTEMPTS,
  addToOutbox,
  isAlreadySentError,
  isPermanentSendError,
  mergeWithPending,
  newMessageId,
  readOutbox,
  removeFromOutbox,
  retryDelayMs,
} from '@/lib/messageOutbox';

const MAX_FETCH_RETRIES = 4;

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  /** Only on my own messages that haven't reached the server yet. */
  status?: OutgoingStatus;
}

export interface OtherParticipantStatus {
  user_id: string;
  last_read_at: string | null;
  last_delivered_at: string | null;
}

export const useMessages = (conversationId: string | null) => {
  const { user } = useSession();
  const cacheKey = conversationId ? `aelixto-messages-${conversationId}` : null;

  const readCache = (): Message[] => {
    if (!cacheKey || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((m: Message) => !m.status) : [];
    } catch {
      return [];
    }
  };

  const writeCache = (list: Message[]) => {
    if (!cacheKey) return;
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify(list.filter(m => !m.status).slice(-100)),
      );
    } catch { /* ignore */ }
  };

  const [messages, setMessages] = useState<Message[]>(readCache);
  const [loading, setLoading] = useState(messages.length === 0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [otherStatus, setOtherStatus] = useState<OtherParticipantStatus | null>(null);
  const fetchGeneration = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Messages on their way, keyed by their (final) id.
  const pendingRef = useRef<Map<string, Message>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const sendTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setStatus = (id: string, status: OutgoingStatus) => {
    const pending = pendingRef.current.get(id);
    if (pending) pendingRef.current.set(id, { ...pending, status });
    setMessages(prev => prev.map(m => (m.id === id && m.status ? { ...m, status } : m)));
  };

  /** The server has this message: drop the clock and use the server's copy. */
  const markDelivered = (id: string, convId: string, serverRow?: Message) => {
    pendingRef.current.delete(id);
    removeFromOutbox(convId, id);
    const timer = sendTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    sendTimersRef.current.delete(id);
    setMessages(prev => {
      const next = prev.map(m => {
        if (m.id !== id) return m;
        const { status: _s, ...rest } = m;
        return serverRow ? { ...rest, ...serverRow } : rest;
      });
      writeCache(next);
      return next;
    });
  };

  const deliver = async (msg: OutboxMessage, attempt = 1) => {
    if (inFlightRef.current.has(msg.id)) return;
    inFlightRef.current.add(msg.id);
    let error: { code?: string | null; message?: string } | null = null;
    let row: Message | null = null;
    try {
      const res = await supabase
        .from('messages')
        .insert({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          content: msg.content,
        })
        .select('id, conversation_id, sender_id, content, created_at')
        .maybeSingle();
      error = res.error;
      row = (res.data as Message | null) ?? null;
    } catch (e) {
      error = { code: '', message: String(e) };
    } finally {
      inFlightRef.current.delete(msg.id);
    }

    if (!pendingRef.current.has(msg.id)) return; // discarded or already confirmed

    if (!error || isAlreadySentError(error)) {
      markDelivered(msg.id, msg.conversation_id, row ?? undefined);
      return;
    }

    if (!isPermanentSendError(error) && attempt < SEND_ATTEMPTS) {
      const timer = setTimeout(() => {
        sendTimersRef.current.delete(msg.id);
        void deliver(msg, attempt + 1);
      }, retryDelayMs(attempt));
      sendTimersRef.current.set(msg.id, timer);
      return;
    }

    console.warn('Message not sent:', error);
    setStatus(msg.id, 'failed');
  };

  /** Try again (quietly) for every message still on its way. */
  const resendPending = () => {
    pendingRef.current.forEach(m => {
      if (inFlightRef.current.has(m.id) || sendTimersRef.current.has(m.id)) return;
      setStatus(m.id, 'sending');
      void deliver(m);
    });
  };

  useEffect(() => {
    pendingRef.current = new Map();
    sendTimersRef.current.forEach(t => clearTimeout(t));
    sendTimersRef.current = new Map();

    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Messages left on their way last time (app closed, connection lost).
    for (const item of readOutbox(conversationId)) {
      if (item.sender_id !== user.id) continue;
      pendingRef.current.set(item.id, { ...item, status: 'sending' });
    }
    const pendingList = Array.from(pendingRef.current.values());

    // Seed from cache for instant render
    const cached = readCache();
    const seeded = mergeWithPending(cached, pendingList).list;
    if (seeded.length > 0) {
      setMessages(seeded);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }

    fetchGeneration.current += 1;
    void fetchMessages(0, fetchGeneration.current);
    pendingList.forEach(m => { void deliver(m); });

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
          const incoming = payload.new as Message;
          if (pendingRef.current.has(incoming.id)) {
            markDelivered(incoming.id, conversationId, incoming);
            return;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === incoming.id)) return prev;
            // Keep my own messages that are still on their way at the bottom.
            const sent = prev.filter(m => !m.status);
            const waiting = prev.filter(m => m.status);
            const next = [...sent, incoming, ...waiting];
            writeCache(next);
            return next;
          });
          if (incoming.sender_id !== user.id) {
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
            writeCache(next);
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
            writeCache(next);
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
    // so anything missed while away appears without an error, and send any
    // message that was still on its way.
    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      fetchGeneration.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      void fetchMessages(0, fetchGeneration.current);
      fetchOtherStatus();
      resendPending();
    };
    document.addEventListener('visibilitychange', refreshSilently);
    window.addEventListener('online', refreshSilently);

    return () => {
      fetchGeneration.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      sendTimersRef.current.forEach(t => clearTimeout(t));
      sendTimersRef.current = new Map();
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
      const server = (data || []).filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }) as Message[];
      const { list, delivered } = mergeWithPending(
        server,
        Array.from(pendingRef.current.values()),
      );
      delivered.forEach(id => {
        pendingRef.current.delete(id);
        removeFromOutbox(conversationId, id);
      });
      setMessages(list);
      setLoadFailed(false);
      setLoading(false);
      writeCache(list);
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

  /** Shows the message straight away with a clock, then delivers it in the background. */
  const sendMessage = (content: string) => {
    if (!conversationId || !user || !content.trim()) return;

    const item: OutboxMessage = {
      id: newMessageId(),
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    addToOutbox(item);
    pendingRef.current.set(item.id, { ...item, status: 'sending' });
    setMessages(prev => [...prev, { ...item, status: 'sending' }]);
    void deliver(item);
  };

  /** Tap on a "Not sent" message. */
  const retrySend = (id: string) => {
    const pending = pendingRef.current.get(id);
    if (!pending) return;
    setStatus(id, 'sending');
    void deliver(pending);
  };

  /** Remove a message that could not be sent. */
  const discardPending = (id: string) => {
    if (!conversationId) return;
    pendingRef.current.delete(id);
    removeFromOutbox(conversationId, id);
    const timer = sendTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    sendTimersRef.current.delete(id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  return { messages, loading, loadFailed, retry, sendMessage, retrySend, discardPending, otherStatus };
};
