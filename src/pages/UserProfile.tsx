import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCompactCount } from "@/lib/formatCount";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Menu, MessageCircle } from "lucide-react";
import { Profile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { useFollow } from "@/hooks/useFollow";
import { useUserPlatformTabs } from "@/hooks/useUserPlatformTabs";
import { useStartConversation } from "@/hooks/useStartConversation";
import { ProfilePlatformTabs } from "@/components/profile/ProfilePlatformTabs";
import { ProfilePlatformGrid } from "@/components/profile/ProfilePlatformGrid";
import { PullToRefresh } from "@/components/PullToRefresh";
import { FollowListDialog, getFollowVisibility } from "@/components/profile/FollowListDialog";
import { ProfileOptionsMenu } from "@/components/profile/ProfileOptionsMenu";
import { AuthCTABar } from "@/components/AuthCTABar";
import { Lock } from "lucide-react";
import { useIsBlocked } from "@/hooks/useIsBlocked";
import { useAmIBlockedBy } from "@/hooks/useAmIBlockedBy";
import { AelixtoLoader } from "@/components/AelixtoLoader";
import { Ban } from "lucide-react";

interface UserProfileProps {
  usernameOverride?: string;
}

const UserProfile = ({ usernameOverride }: UserProfileProps) => {
  const { username: urlUsername } = useParams<{ username: string }>();
  const username = usernameOverride || urlUsername;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");
  const [followListOpen, setFollowListOpen] = useState(false);

  const { data: profile = null, isLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile", username],
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
  });

  const { isFollowing, isRequested, followsMe, follow, unfollow, loading: followLoading, counts, countsReady, refresh: refreshFollow } = useFollow(profile?.user_id);
  const isMe = user?.id === profile?.user_id;
  const { isBlocked, refetch: refetchBlocked } = useIsBlocked(profile?.user_id);
  const { amIBlockedBy, isLoading: amIBlockedByLoading } = useAmIBlockedBy(profile?.user_id);
  const { tabs, activeTab, setActiveTab, loading: tabsLoading } = useUserPlatformTabs(profile?.user_id);
  const { startConversation, loading: conversationLoading } = useStartConversation();

  const isPrivate = !!(profile?.settings as { is_private?: boolean } | null)?.is_private;
  const canViewPosts = !isPrivate || isMe || isFollowing;

  const { data: mutualsData } = useQuery({
    queryKey: ["mutuals", profile?.user_id, user?.id],
    enabled: !!profile && !!user && !isMe,
    queryFn: async (): Promise<{ username: string; display_name: string | null; total_count: number }[] | null> => {
      const { data, error } = await supabase
        .rpc("get_mutual_followers_with_count", {
          viewer_id: user!.id,
          profile_owner_id: profile!.user_id,
        });
      if (error) throw error;
      return (data as unknown as { username: string; display_name: string | null; total_count: number }[]) || null;
    },
  });

  // Preload cover + avatar so we don't reveal the page mid-paint.
  const [coverReady, setCoverReady] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);

  useEffect(() => {
    if (!profile) { setCoverReady(false); return; }
    if (!profile.cover_url) { setCoverReady(true); return; }
    setCoverReady(false);
    const img = new Image();
    let done = false;
    const finish = () => { if (!done) { done = true; setCoverReady(true); } };
    img.onload = finish;
    img.onerror = finish;
    img.src = profile.cover_url;
    if (img.complete) finish();
    const t = setTimeout(finish, 2500);
    return () => { clearTimeout(t); img.onload = null; img.onerror = null; };
  }, [profile?.user_id, profile?.cover_url]);

  useEffect(() => {
    if (!profile) { setAvatarReady(false); return; }
    if (!profile.avatar_url) { setAvatarReady(true); return; }
    setAvatarReady(false);
    const img = new Image();
    let done = false;
    const finish = () => { if (!done) { done = true; setAvatarReady(true); } };
    img.onload = finish;
    img.onerror = finish;
    img.src = profile.avatar_url;
    if (img.complete) finish();
    const t = setTimeout(finish, 2500);
    return () => { clearTimeout(t); img.onload = null; img.onerror = null; };
  }, [profile?.user_id, profile?.avatar_url]);

  const contentReady = !!profile && !tabsLoading && coverReady && avatarReady && countsReady;
  const showSkeleton = !contentReady;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchProfile(),
      refreshFollow(),
      queryClient.invalidateQueries({ queryKey: ["user-platform-tabs", profile?.user_id] }),
      queryClient.invalidateQueries({ queryKey: ["platform-posts", profile?.user_id] }),
      queryClient.invalidateQueries({ queryKey: ["mutuals", profile?.user_id] }),
    ]);
  }, [refetchProfile, refreshFollow, queryClient, profile?.user_id]);

  if (!isLoading && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  // If the profile owner has blocked me, show a minimal "blocked you" screen.
  if (profile && !isMe && amIBlockedBy && !amIBlockedByLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="container max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">@{profile.username}</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Ban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">This user has blocked you</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            You can't see their profile, posts, followers or activity.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+var(--safe-bottom))] relative">
      {/* Full-page skeleton overlay — crossfades out once content is ready */}
      <div
        aria-hidden={!showSkeleton}
        className="absolute inset-0 z-30 pb-[calc(5rem+var(--safe-bottom))] pointer-events-none transition-opacity duration-500 ease-out"
        style={{ opacity: showSkeleton ? 1 : 0 }}
      >
        {/* Centered morphing Aelixto logo — fades out with the rest of the skeleton */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-40">
          <AelixtoLoader size={96} />
        </div>
        <div className="mx-auto max-w-2xl">
          <div className="relative h-[400px] profile-cover-fallback animate-shimmer" />
          <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
            <div className="flex items-center justify-between -mt-[130px] pt-4 relative px-4">
              <div className="text-center flex-shrink-0 w-20 -ml-2">
                <div className="h-7 w-14 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-3 w-16 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -mt-20">
                <div className="h-[140px] w-[140px] rounded-full bg-muted border-[8px] border-background animate-shimmer" />
              </div>
              <div className="text-center flex-shrink-0 w-20 -mr-2">
                <div className="h-7 w-14 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-3 w-16 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-center mt-4 mb-4">
              <div className="border-2 border-muted rounded-[16px] px-10 py-2">
                <div className="h-7 w-16 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-2 w-20 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
            </div>
            <div className="text-center px-4 mb-6">
              <div className="h-4 w-3/4 bg-muted rounded-md mx-auto mb-2 animate-shimmer" />
              <div className="h-4 w-1/2 bg-muted rounded-md mx-auto animate-shimmer" />
            </div>
            <div className="h-12 w-full bg-muted rounded-full mb-6 animate-shimmer" />
            <div className="overflow-x-auto no-scrollbar mb-8">
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="min-w-[80px] h-16 bg-muted rounded-full animate-shimmer" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {profile ? (
      <div
        className="transition-[opacity,filter] duration-500 ease-out"
        style={{
          opacity: contentReady ? 1 : 0,
          filter: contentReady ? 'blur(0px)' : 'blur(8px)',
        }}
      >
      <PullToRefresh onRefresh={handleRefresh}>
      <main className="mx-auto max-w-2xl">
        {/* Cover Image with Header Overlay */}
        <div className="relative h-[400px] profile-cover-fallback">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 z-10">
            <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/20 hover:bg-black/30 text-white rounded-full h-10 w-10 shadow-lg flex-shrink-0"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold leading-tight truncate text-white drop-shadow-lg">{profile.display_name || profile.username}</h1>
                  <p className="text-white/95 text-sm truncate drop-shadow-lg">@{profile.username}</p>
                </div>
              </div>
              {isMe ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/20 hover:bg-black/30 text-white rounded-full h-9 w-9 shadow-lg flex-shrink-0"
                  onClick={() => navigate('/settings')}
                >
                  <Menu className="h-4 w-4 stroke-[2.5]" />
                </Button>
              ) : user ? (
                <ProfileOptionsMenu
                  targetUserId={profile.user_id}
                  username={profile.username}
                  displayName={profile.display_name}
                  isFollowedByTarget={followsMe}
                  isBlocked={isBlocked}
                  onBlocked={() => navigate('/')}
                  onUnblocked={() => { refetchBlocked(); refreshFollow(); }}
                  onRemovedFollower={() => {
                    refreshFollow();
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
          {/* Avatar and Stats Container */}
          <div className="flex items-center justify-between -mt-[130px] pt-4 relative px-4">
            {/* Left Stats - Followers */}
            <button 
              className="text-center flex-shrink-0 w-20 -ml-2 active:scale-95 transition-transform"
              onClick={() => { setFollowListType("followers"); setFollowListOpen(true); }}
            >
              <div className="text-2xl font-bold leading-none mb-1">{counts.followers}</div>
              <div className="text-xs font-medium">Followers</div>
            </button>
            
            {/* Avatar - Centered */}
            <div className="absolute left-1/2 -translate-x-1/2 -mt-20">
              <Avatar className="h-[140px] w-[140px] border-[8px] border-background">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-4xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Right Stats - Following */}
            <button 
              className="text-center flex-shrink-0 w-20 -mr-2 active:scale-95 transition-transform"
              onClick={() => { setFollowListType("following"); setFollowListOpen(true); }}
            >
              <div className="text-2xl font-bold leading-none mb-1">{counts.following}</div>
              <div className="text-xs font-medium">Following</div>
            </button>
          </div>

          {/* Aelix Score - only show if user enabled it */}
          {(profile.settings as { aelix_score_enabled?: boolean })?.aelix_score_enabled && (
            <div className="flex justify-center mt-4 mb-4">
              <div className="border-2 border-foreground rounded-[16px] px-10 py-2">
                <div className="text-2xl font-bold text-center leading-none mb-0.5">{formatCompactCount(profile.aelix_score)}</div>
                <div className="text-[9px] font-bold text-center tracking-[0.15em] uppercase">Aelix Score</div>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className={`text-center text-base mb-6 px-4 whitespace-pre-wrap ${!(profile.settings as { aelix_score_enabled?: boolean })?.aelix_score_enabled ? 'mt-6' : ''}`}>{profile.bio}</p>
          )}

          {/* Spacer when no bio and no aelix score */}
          {!profile.bio && !(profile.settings as { aelix_score_enabled?: boolean })?.aelix_score_enabled && (
            <div className="mt-6" />
          )}

          {/* Mutual followers line */}
          {!isMe && user && mutualsData && mutualsData.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mb-4 px-4">
              {(() => {
                const followersVis = getFollowVisibility((profile?.settings as Record<string, unknown>) || null, "followers");
                const total = mutualsData[0]?.total_count ?? mutualsData.length;
                if (followersVis === "no_one") {
                  return `Followed by ${total} mutual${total !== 1 ? "s" : ""}`;
                }
                const names = mutualsData.slice(0, 2).map((m) => m.display_name || m.username);
                if (total === 1) {
                  return `Followed by ${names[0]}`;
                }
                if (total === 2) {
                  return `Followed by ${names[0]} and ${names[1]}`;
                }
                const others = total - 2;
                return `Followed by ${names[0]}, ${names[1]} and ${others} other${others !== 1 ? "s" : ""}`;
              })()}
            </p>
          )}

          {/* Action Buttons - Edit or Follow/Message */}
          {isMe ? (
            <Button 
              variant="outline" 
              className="w-full rounded-full py-4 text-sm font-bold border-2 mb-6 hover:bg-muted active:scale-[0.96] transition-transform duration-200"
              onClick={() => navigate('/edit-profile')}
            >
              Edit Profile
            </Button>
          ) : user && isBlocked ? (
            <div className="mb-6">
              <Button
                onClick={async () => {
                  const { data: { user: u } } = await supabase.auth.getUser();
                  if (!u || !profile) return;
                  await supabase
                    .from("blocked_users")
                    .delete()
                    .eq("user_id", u.id)
                    .eq("blocked_user_id", profile.user_id);
                  await queryClient.invalidateQueries({ queryKey: ["is-blocked", u.id, profile.user_id] });
                  await queryClient.invalidateQueries({ queryKey: ["user-platform-tabs", profile.user_id] });
                  await queryClient.invalidateQueries({ queryKey: ["platform-posts", profile.user_id] });
                  await queryClient.invalidateQueries({ queryKey: ["following-feed"] });
                  await refetchBlocked();
                  await refreshFollow();
                }}
                className="w-full rounded-full py-4 text-sm font-bold border-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Unblock
              </Button>
            </div>
          ) : user ? (
            <div className="flex gap-3 mb-6">
              <Button 
                disabled={followLoading}
                onClick={() => ((isFollowing || isRequested) ? unfollow() : follow())}
                className={`flex-1 rounded-full py-4 text-sm font-bold border-2 ${
                  (isFollowing || isRequested)
                    ? 'bg-foreground text-background hover:bg-foreground/90' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isFollowing ? 'Following' : isRequested ? 'Asked' : followsMe ? 'Follow Back' : 'Follow'}
              </Button>
              <Button
                disabled={conversationLoading}
                onClick={() => startConversation(profile.user_id)}
                variant="outline"
                className="flex-1 rounded-full py-4 text-sm font-bold border-2 hover:bg-muted"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Message
              </Button>
            </div>
          ) : null}

          {/* Dynamic Platform Buttons */}
          {tabs.length > 0 && canViewPosts && (
            <div className="overflow-x-auto no-scrollbar mb-8">
              <div className="flex gap-3 min-w-max">
                {tabs.map((tab) => (
                  <Button 
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    variant="outline"
                    className={`min-w-[80px] rounded-full py-6 border-2 transition-colors ${
                      activeTab === tab.key 
                        ? "bg-foreground hover:bg-foreground/90 border-foreground" 
                        : "bg-background border-muted hover:border-foreground/40"
                    }`}
                  >
                    <img 
                      src={tab.icon} 
                      alt={tab.label}
                      className={`w-[27px] h-[27px] ${
                        activeTab === tab.key ? "brightness-0 invert" : ""
                      }`}
                    />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!canViewPosts ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-full border-2 border-foreground flex items-center justify-center mb-4">
                <Lock className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold mb-1">This account is private</p>
              <p className="text-sm text-muted-foreground">Follow @{profile.username} to see their posts.</p>
            </div>
          ) : !tabsLoading && tabs.length > 0 ? (
            <ProfilePlatformGrid
              userId={profile.user_id}
              activeTab={activeTab}
              tabs={tabs}
              onTabChange={setActiveTab}
              isOwner={isMe}
              currentUserId={user?.id}
            />
          ) : !tabsLoading ? (
            <p className="text-center text-muted-foreground py-12 text-base">
              No posts yet
            </p>
          ) : null}
        </div>
      </main>
      </PullToRefresh>
      </div>
      ) : null}

      {user ? null : <AuthCTABar />}

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />

      {profile && (
        <FollowListDialog
          open={followListOpen}
          onOpenChange={setFollowListOpen}
          userId={profile.user_id}
          type={followListType}
        />
      )}
    </div>
  );
};

export default UserProfile;