import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Menu, Settings as SettingsIcon, LogOut, MessageCircle } from "lucide-react";
import { Profile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { useFollow } from "@/hooks/useFollow";
import { useUserPlatformTabs } from "@/hooks/useUserPlatformTabs";
import { useStartConversation } from "@/hooks/useStartConversation";
import { ProfilePlatformTabs } from "@/components/profile/ProfilePlatformTabs";
import { ProfilePlatformGrid } from "@/components/profile/ProfilePlatformGrid";

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const { isFollowing, follow, unfollow, loading: followLoading, counts } = useFollow(profile?.user_id);
  const isMe = user?.id === profile?.user_id;
  const { tabs, activeTab, setActiveTab, loading: tabsLoading } = useUserPlatformTabs(profile?.user_id);
  const { startConversation, loading: conversationLoading } = useStartConversation();

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error) throw error;
      setProfile(data as unknown as Profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-2xl">
          {/* Cover Skeleton */}
          <div className="relative h-[400px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 animate-shimmer" />
          
          {/* Profile Content */}
          <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
            {/* Avatar and Stats Container */}
            <div className="flex items-center justify-between -mt-[130px] pt-4 relative px-4">
              {/* Left Stats */}
              <div className="text-center flex-shrink-0 w-20 -ml-2">
                <div className="h-7 w-14 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-3 w-16 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
              
              {/* Avatar - Centered */}
              <div className="absolute left-1/2 -translate-x-1/2 -mt-20">
                <div className="h-[140px] w-[140px] rounded-full bg-muted border-[8px] border-background animate-shimmer" />
              </div>
              
              {/* Right Stats */}
              <div className="text-center flex-shrink-0 w-20 -mr-2">
                <div className="h-7 w-14 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-3 w-16 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
            </div>

            {/* Aelix Score */}
            <div className="flex justify-center mt-4 mb-4">
              <div className="border-2 border-muted rounded-[16px] px-10 py-2">
                <div className="h-7 w-16 bg-muted rounded-md mb-1 mx-auto animate-shimmer" />
                <div className="h-2 w-20 bg-muted rounded-md mx-auto animate-shimmer" />
              </div>
            </div>

            {/* Bio Skeleton */}
            <div className="text-center px-4 mb-6">
              <div className="h-4 w-3/4 bg-muted rounded-md mx-auto mb-2 animate-shimmer" />
              <div className="h-4 w-1/2 bg-muted rounded-md mx-auto animate-shimmer" />
            </div>

            {/* Button Skeleton */}
            <div className="h-12 w-full bg-muted rounded-full mb-6 animate-shimmer" />

            {/* Platform Buttons Skeleton */}
            <div className="overflow-x-auto no-scrollbar mb-8">
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="min-w-[80px] h-16 bg-muted rounded-full animate-shimmer" />
                ))}
              </div>
            </div>
          </div>
        </main>
        <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-2xl">
        {/* Cover Image with Header Overlay */}
        <div className="relative h-[400px] bg-gradient-to-r from-purple-500 to-pink-500">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/20 hover:bg-black/30 text-white rounded-full h-9 w-9 shadow-lg flex-shrink-0"
                  >
                    <Menu className="h-4 w-4 stroke-[2.5]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isMe && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/settings')}>
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </>
                  )}
                  {!isMe && user && (
                    <DropdownMenuItem onClick={() => navigate('/')}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Home
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
          {/* Avatar and Stats Container */}
          <div className="flex items-center justify-between -mt-[130px] pt-4 relative px-4">
            {/* Left Stats - Followers */}
            <div className="text-center flex-shrink-0 w-20 -ml-2">
              <div className="text-2xl font-bold leading-none mb-1">{counts.followers}</div>
              <div className="text-xs font-medium">Followers</div>
            </div>
            
            {/* Avatar - Centered */}
            <div className="absolute left-1/2 -translate-x-1/2 -mt-20">
              <Avatar className="h-[140px] w-[140px] border-[8px] border-background">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-4xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Right Stats - Following */}
            <div className="text-center flex-shrink-0 w-20 -mr-2">
              <div className="text-2xl font-bold leading-none mb-1">{counts.following}</div>
              <div className="text-xs font-medium">Following</div>
            </div>
          </div>

          {/* Aelix Score - only show if user enabled it */}
          {(profile.settings as { aelix_score_enabled?: boolean })?.aelix_score_enabled && (
            <div className="flex justify-center mt-4 mb-4">
              <div className="border-2 border-foreground rounded-[16px] px-10 py-2">
                <div className="text-2xl font-bold text-center leading-none mb-0.5">{profile.aelix_score.toLocaleString()}</div>
                <div className="text-[9px] font-bold text-center tracking-[0.15em] uppercase">Aelix Score</div>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-base mb-6 px-4">"{profile.bio}"</p>
          )}

          {/* Action Buttons - Edit or Follow/Message */}
          {isMe ? (
            <Button 
              variant="outline" 
              className="w-full rounded-full py-4 text-sm font-bold border-2 mb-6 hover:bg-muted"
              onClick={() => navigate('/settings')}
            >
              Edit Profile
            </Button>
          ) : user ? (
            <div className="flex gap-3 mb-6">
              <Button 
                disabled={followLoading}
                onClick={() => (isFollowing ? unfollow() : follow())}
                className={`flex-1 rounded-full py-4 text-sm font-bold border-2 ${
                  isFollowing 
                    ? 'bg-foreground text-background hover:bg-foreground/90' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
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
          {tabs.length > 0 && (
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

          {!tabsLoading && tabs.length > 0 ? (
            <ProfilePlatformGrid userId={profile.user_id} activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} />
          ) : !tabsLoading ? (
            <p className="text-center text-muted-foreground py-12 text-base">
              No posts yet
            </p>
          ) : null}
        </div>
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default UserProfile;