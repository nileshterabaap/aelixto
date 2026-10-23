/**
 * Outgoing chat messages (WhatsApp-style).
 *
 * A message appears in the chat the moment it is sent, with a clock while it
 * travels. Each message carries its own id from the start, so retrying the
 * same message can never create a second copy: the database rejects the
 * repeat id, which we treat as "already delivered".
 */

export type OutgoingStatus = 'sending' | 'failed';

export interface OutboxMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

/** Quiet automatic attempts before a message is shown as "Not sent". */
export const SEND_ATTEMPTS = 4;

/** Wait before automatic retry number `attempt` (1-based). */
export function retryDelayMs(attempt: number): number {
  return 800 * 2 ** Math.max(0, attempt - 1);
}

interface InsertErrorLike {
  code?: string | null;
}

/** The same message id is already saved: the earlier attempt actually got through. */
export function isAlreadySentError(error: InsertErrorLike | null | undefined): boolean {
  return error?.code === '23505';
}

/**
 * Errors the server gives for a message it will never accept (blocked chat,
 * removed conversation, invalid data). Retrying these is pointless; anything
 * else (dropped connection, timeout) is worth retrying.
 */
export function isPermanentSendError(error: InsertErrorLike | null | undefined): boolean {
  const code = error?.code ?? '';
  if (!code || isAlreadySentError(error)) return false;
  return /^(42|23|22)/.test(code) || code.startsWith('PGRST');
}

/**
 * Combine a fresh server list with messages still on their way: anything the
 * server already has is no longer pending; the rest stays at the bottom.
 */
export function mergeWithPending<T extends { id: string }>(
  server: T[],
  pending: T[],
): { list: T[]; delivered: string[] } {
  const serverIds = new Set(server.map((m) => m.id));
  const delivered: string[] = [];
  const stillPending: T[] = [];
  for (const m of pending) {
    if (serverIds.has(m.id)) delivered.push(m.id);
    else stillPending.push(m);
  }
  return { list: [...server, ...stillPending], delivered };
}

export function newMessageId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const outboxKey = (conversationId: string) => `aelixto-outbox-${conversationId}`;

export function readOutbox(conversationId: string): OutboxMessage[] {
  try {
    const raw = window.localStorage.getItem(outboxKey(conversationId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(conversationId: string, items: OutboxMessage[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(outboxKey(conversationId));
    else window.localStorage.setItem(outboxKey(conversationId), JSON.stringify(items));
  } catch { /* storage full or unavailable */ }
}

export function addToOutbox(item: OutboxMessage) {
  const items = readOutbox(item.conversation_id).filter((m) => m.id !== item.id);
  writeOutbox(item.conversation_id, [...items, item]);
}

export function removeFromOutbox(conversationId: string, id: string) {
  writeOutbox(conversationId, readOutbox(conversationId).filter((m) => m.id !== id));
}
