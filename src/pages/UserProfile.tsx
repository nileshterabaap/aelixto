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
import { ArrowLeft, Play, Camera, Menu, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Profile } from "@/hooks/useCurrentProfile";

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
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
              <div className="text-2xl font-bold leading-none mb-1">0</div>
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
              <div className="text-2xl font-bold leading-none mb-1">0</div>
              <div className="text-xs font-medium">Following</div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="flex justify-center mt-4 mb-4">
            <div className="border-2 border-foreground rounded-[16px] px-10 py-2">
              <div className="text-2xl font-bold text-center leading-none mb-0.5">{profile.aelix_score.toLocaleString()}</div>
              <div className="text-[9px] font-bold text-center tracking-[0.15em] uppercase">Aelix Score</div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-base mb-6 px-4">"{profile.bio}"</p>
          )}

          {/* Edit Profile Button */}
          <Button 
            variant="outline" 
            className="w-full rounded-full py-4 text-sm font-bold border-2 mb-6 hover:bg-muted"
            onClick={() => navigate('/settings')}
          >
            Edit Profile
          </Button>

          {/* Social Links */}
          <div className="flex gap-3 mb-8">
            <Button className="flex-1 rounded-full py-5 bg-foreground hover:bg-foreground/90 text-background">
              <Play className="h-5 w-5 fill-current" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-5 border-[2.5px]">
              <Camera className="h-5 w-5" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-5 border-[2.5px]">
              <span className="text-xl font-bold">𝕏</span>
            </Button>
          </div>

          {/* Content */}
          <Tabs defaultValue="posts" className="w-full">
            <TabsContent value="posts" className="mt-0">
              <p className="text-center text-muted-foreground py-12 text-base">
                No posts yet
              </p>
            </TabsContent>
          </Tabs>
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
