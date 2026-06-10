import { useEffect } from "react";

export const CREATE_POST_EVENT = "aelixto:create-post";

/**
 * LIFO stack of subscribed page listeners. Because keep-alive routes
 * (Home, UserProfile) stay mounted alongside the currently-visible page,
 * multiple CreatePostDialog instances would otherwise all open at once
 * (causing the "tap X twice to close" bug). Only the most recently
 * mounted listener — i.e. the page the user is actually looking at —
 * handles the trigger.
 */
const listenerStack: Array<() => void> = [];

export const useCreatePostTrigger = (onOpen: () => void) => {
  useEffect(() => {
    listenerStack.push(onOpen);
    return () => {
      const i = listenerStack.lastIndexOf(onOpen);
      if (i >= 0) listenerStack.splice(i, 1);
    };
  }, [onOpen]);
};

export const triggerCreatePost = () => {
  const top = listenerStack[listenerStack.length - 1];
  if (top) {
    top();
  } else {
    // Fallback for any legacy listener still using the event
    window.dispatchEvent(new CustomEvent(CREATE_POST_EVENT));
  }
};