import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectLikedBy, type LikedByProfile } from '@/lib/likedBy';
import { UsernameLink } from '@/components/UsernameLink';
import { LikesSheet } from '@/components/LikesSheet';
import { Button } from '@/components/ui/button';

interface Props {
  postId: string;
  userId?: string;
  hidden?: boolean;
  enabled?: boolean;
}

export function LikedBySummary({ postId, userId, hidden = false, enabled = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const active = enabled && !hidden && visible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: followingIds = [] } = useQuery({
    queryKey: ['liked-by-following', userId],
    enabled: active && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];
      const ids: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('follows').select('following_id')
          .eq('follower_id', userId).order('id').range(offset, offset + 999);
        if (error) throw error;
        ids.push(...(data ?? []).map(row => row.following_id));
        if (!data || data.length < 1000) return ids;
      }
    },
  });

  const { data } = useQuery({
    queryKey: ['liked-by', postId, userId],
    enabled: active,
    staleTime: 30_000,
    refetchInterval: active ? 30_000 : false,
    queryFn: async () => {
      const likes: { user_id: string }[] = [];
      let total = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data: rows, count, error } = await supabase.from('likes')
          .select('user_id', { count: 'exact' }).eq('post_id', postId)
          .order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (error) throw error;
        total = count ?? 0;
        likes.push(...(rows ?? []));
        if (!rows || rows.length < 1000) break;
      }
      const ids = [...new Set(likes.map(row => row.user_id))];
      const profiles: LikedByProfile[] = [];
      for (let offset = 0; offset < ids.length; offset += 200) {
        const { data: rows, error } = await supabase.from('profiles').select('user_id, username')
          .in('user_id', ids.slice(offset, offset + 200));
        if (error) throw error;
        profiles.push(...(rows ?? []));
      }
      return { likes, profiles, total };
    },
  });

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['liked-by', postId] });
      queryClient.invalidateQueries({ queryKey: ['post-likes', postId] });
    };
    let channel = supabase.channel(`liked-by-${postId}-${userId ?? 'public'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` }, refresh);
    if (userId) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['liked-by-following', userId] });
      });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [active, postId, userId, queryClient]);

  const summary = data ? selectLikedBy(data.likes, data.profiles, followingIds, data.total, hidden) : null;
  return (
    <div ref={ref}>
      {enabled && summary && (
        <div className="px-5 pb-3 text-xs text-muted-foreground leading-relaxed break-words" onClick={event => event.stopPropagation()}>
          Liked by{' '}
          <UsernameLink username={summary.person.username} className="font-semibold text-foreground">
            @{summary.person.username}
          </UsernameLink>
          {summary.others > 0 ? (
            <>{' '}and{' '}<Button variant="link" className="h-auto p-0 text-xs font-semibold text-foreground whitespace-normal" onClick={() => setOpen(true)}>
              {summary.others.toLocaleString()} {summary.others === 1 ? 'other' : 'others'}
            </Button></>
          ) : (
            <Button variant="link" className="h-auto p-0 ml-2 text-xs text-muted-foreground" onClick={() => setOpen(true)}>View likes</Button>
          )}
        </div>
      )}
      <LikesSheet key={userId ?? 'public'} open={open && !hidden} onOpenChange={setOpen} postId={postId} />
    </div>
  );
}