export const MESSAGE_THREAD_READ_EVENT = 'aelixto:message-thread-read';

export const emitMessageThreadRead = (conversationId: string) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(MESSAGE_THREAD_READ_EVENT, {
      detail: { conversationId },
    }),
  );
};

export const onMessageThreadRead = (handler: (conversationId: string) => void) => {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    const conversationId = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
    if (conversationId) handler(conversationId);
  };

  window.addEventListener(MESSAGE_THREAD_READ_EVENT, listener);
  return () => window.removeEventListener(MESSAGE_THREAD_READ_EVENT, listener);
};