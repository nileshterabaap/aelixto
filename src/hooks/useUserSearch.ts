import { useState, useEffect, useCallback, useRef } from 'react';
import {
  instantSearchRows,
  normalizeSearchQuery,
  searchProfiles,
  type ProfileSearchRow,
} from '@/lib/profileSearch';

export type SearchResult = ProfileSearchRow;

const PAGE_SIZE = 20;

export const useUserSearch = (query: string, enabled: boolean = true) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  // Only the newest search may change what's on screen; slower older
  // replies are ignored instead of overwriting newer results.
  const requestId = useRef(0);

  const clean = normalizeSearchQuery(query);

  useEffect(() => {
    const id = ++requestId.current;
    setFailed(false);
    if (!enabled || !clean) {
      setResults([]);
      setHasMore(false);
      setCursor(null);
      setLoading(false);
      return;
    }

    // Show matches from earlier letters immediately while the server answers.
    const instant = instantSearchRows(clean, PAGE_SIZE);
    if (instant) setResults(instant);
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await searchProfiles(clean, PAGE_SIZE, null);
        if (id !== requestId.current) return;
        setResults(data);
        setHasMore(data.length === PAGE_SIZE);
        setCursor(data.length > 0 ? data[data.length - 1].id : null);
      } catch (error) {
        if (id !== requestId.current) return;
        console.error('Search error:', error);
        setFailed(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, instant ? 120 : 150);

    return () => clearTimeout(timer);
  }, [clean, enabled, retryTick]);

  const loadMore = useCallback(async () => {
    if (!cursor || !clean) return;
    const id = requestId.current;
    setLoading(true);
    try {
      const data = await searchProfiles(clean, PAGE_SIZE, cursor);
      if (id !== requestId.current) return;
      setResults(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setCursor(data.length > 0 ? data[data.length - 1].id : null);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [cursor, clean]);

  const retry = useCallback(() => setRetryTick(t => t + 1), []);

  return { results, loading, failed, hasMore, loadMore, retry };
};
