import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dismissed_connect_banners';

const getDismissedPlatforms = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const useConnectBannerDismiss = () => {
  const [dismissed, setDismissed] = useState<string[]>(getDismissedPlatforms);

  const isDismissed = useCallback(
    (platform: string) => dismissed.includes(platform.toLowerCase()),
    [dismissed]
  );

  const dismiss = useCallback((platform: string) => {
    const key = platform.toLowerCase();
    setDismissed((prev) => {
      const next = [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { isDismissed, dismiss };
};
