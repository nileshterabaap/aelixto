// Ordering and pin rules for the Messages list.
// Pinned chats stay on top (most recently pinned first); everything else is
// ordered by its latest activity.

export const MAX_PINNED_CHATS = 3;

export interface OrderableChat {
  pinned_at: string | null;
  updated_at: string;
  last_message: { created_at: string } | null;
}

const ts = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0);

export function sortChats<T extends OrderableChat>(chats: T[]): T[] {
  return [...chats].sort((a, b) => {
    const aPinned = ts(a.pinned_at);
    const bPinned = ts(b.pinned_at);
    if (aPinned || bPinned) {
      if (!aPinned) return 1;
      if (!bPinned) return -1;
      if (aPinned !== bPinned) return bPinned - aPinned;
    }
    const aTime = ts(a.last_message?.created_at || a.updated_at);
    const bTime = ts(b.last_message?.created_at || b.updated_at);
    return bTime - aTime;
  });
}

export function canPinAnotherChat(chats: OrderableChat[]): boolean {
  return chats.filter((c) => !!c.pinned_at).length < MAX_PINNED_CHATS;
}
