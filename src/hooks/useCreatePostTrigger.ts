import { useEffect } from "react";

export const CREATE_POST_EVENT = "aelixto:create-post";

/**
 * Subscribe a page to the global "open create post" trigger fired by the
 * persistent BottomNav. Lets us hoist BottomNav out of <PageTransition> so
 * it never flickers on navigation, while each page keeps its own dialog.
 */
export const useCreatePostTrigger = (onOpen: () => void) => {
  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener(CREATE_POST_EVENT, handler);
    return () => window.removeEventListener(CREATE_POST_EVENT, handler);
  }, [onOpen]);
};

export const triggerCreatePost = () => {
  window.dispatchEvent(new CustomEvent(CREATE_POST_EVENT));
};