export interface LikedByProfile {
  user_id: string;
  username: string;
}

/** Likes arrive newest first; inaccessible profiles must never be named. */
export function selectLikedBy(
  likes: { user_id: string }[],
  profiles: LikedByProfile[],
  followingIds: string[],
  total: number,
  hidden = false,
) {
  if (hidden || total <= 0) return null;
  const byId = new Map(profiles.map(profile => [profile.user_id, profile]));
  const following = new Set(followingIds);
  const visible = likes.flatMap(like => {
    const profile = byId.get(like.user_id);
    return profile ? [profile] : [];
  });
  const person = visible.find(profile => following.has(profile.user_id)) ?? visible[0];
  if (!person) return null;
  return { person, others: Math.max(0, total - 1) };
}