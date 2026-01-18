import { useState, useEffect, useCallback, useRef } from 'react';

interface ScrollVelocityState {
  velocity: number; // pixels per second
  direction: 'up' | 'down' | 'idle';
  isScrollingFast: boolean;
}

// Shared state across all consumers
let globalState: ScrollVelocityState = {
  velocity: 0,
  direction: 'idle',
  isScrollingFast: false,
};

const listeners = new Set<(state: ScrollVelocityState) => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener(globalState));
};

// Throttle threshold for "fast" scrolling (pixels per second)
const FAST_SCROLL_THRESHOLD = 800;

// Initialize scroll tracking once
let isInitialized = false;

const initScrollTracking = () => {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  let lastScrollY = window.scrollY;
  let lastTime = performance.now();
  let velocityBuffer: number[] = [];
  let rafId: number | null = null;
  let idleTimeout: number | null = null;

  const updateVelocity = () => {
    const now = performance.now();
    const currentScrollY = window.scrollY;
    const deltaY = currentScrollY - lastScrollY;
    const deltaTime = now - lastTime;

    if (deltaTime > 0) {
      // Calculate instantaneous velocity (px/s)
      const instantVelocity = Math.abs(deltaY / deltaTime) * 1000;
      
      // Smooth velocity using rolling average
      velocityBuffer.push(instantVelocity);
      if (velocityBuffer.length > 5) velocityBuffer.shift();
      
      const avgVelocity = velocityBuffer.reduce((a, b) => a + b, 0) / velocityBuffer.length;
      
      globalState = {
        velocity: Math.round(avgVelocity),
        direction: deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : globalState.direction,
        isScrollingFast: avgVelocity > FAST_SCROLL_THRESHOLD,
      };
      
      notifyListeners();
    }

    lastScrollY = currentScrollY;
    lastTime = now;

    // Reset to idle after scrolling stops
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = window.setTimeout(() => {
      velocityBuffer = [];
      globalState = { velocity: 0, direction: 'idle', isScrollingFast: false };
      notifyListeners();
    }, 150);
  };

  const handleScroll = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      updateVelocity();
      rafId = null;
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
};

export const useScrollVelocity = (): ScrollVelocityState => {
  const [state, setState] = useState<ScrollVelocityState>(globalState);

  useEffect(() => {
    initScrollTracking();
    
    const listener = (newState: ScrollVelocityState) => {
      setState(newState);
    };
    
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
};

// For components that just need the preload distance
export const useAdaptivePreloadDistance = (): number => {
  const { velocity, isScrollingFast } = useScrollVelocity();
  
  // Base distance: 2000px (~5-6 posts)
  // Fast scrolling: up to 5000px (~12-15 posts)
  if (isScrollingFast) {
    // Scale with velocity, cap at 5000px
    return Math.min(2000 + velocity * 2, 5000);
  }
  
  return 2000;
};
