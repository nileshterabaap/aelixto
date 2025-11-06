import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
}

export const useUserSearch = (query: string, enabled: boolean = true) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!enabled || !query.trim()) {
      setResults([]);
      setHasMore(false);
      setCursor(null);
      return;
    }

    setLoading(true);
    
    const timer = setTimeout(async () => {
      try {
        // Strip @ if present
        const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
        
        const { data, error } = await supabase.rpc('search_profiles', {
          q: cleanQuery,
          limit_count: 20,
          cursor: null
        });

        if (error) throw error;
        
        setResults(data || []);
        setHasMore(data && data.length === 20);
        setCursor(data && data.length > 0 ? data[data.length - 1].id : null);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(timer);
  }, [query, enabled]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (!cursor || !query.trim()) return;

    setLoading(true);
    try {
      const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
      
      const { data, error } = await supabase.rpc('search_profiles', {
        q: cleanQuery,
        limit_count: 20,
        cursor: cursor
      });

      if (error) throw error;
      
      setResults(prev => [...prev, ...(data || [])]);
      setHasMore(data && data.length === 20);
      setCursor(data && data.length > 0 ? data[data.length - 1].id : null);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setLoading(false);
    }
  }, [cursor, query]);

  return { results, loading, hasMore, loadMore };
};
