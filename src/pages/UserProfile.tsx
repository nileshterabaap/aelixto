import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Play, Camera, Menu } from "lucide-react";
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
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl">
        {/* Cover Image with Name Overlay */}
        <div className="relative h-[420px] bg-gradient-to-r from-purple-500 to-pink-500">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 bg-destructive hover:bg-destructive/90 text-white rounded-full h-14 w-14 shadow-lg"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          {/* Name Overlay */}
          <div className="absolute top-6 left-24 text-white drop-shadow-lg">
            <h1 className="text-3xl font-bold leading-tight">{profile.display_name || profile.username}</h1>
            <p className="text-white/95 text-lg">@{profile.username}</p>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
          {/* Avatar centered with overlapping stats */}
          <div className="flex justify-center -mt-[140px] pt-6 relative">
            {/* Left Stats - Followers */}
            <div className="absolute left-4 top-32 text-center">
              <div className="text-5xl font-bold leading-none mb-2">0</div>
              <div className="text-base font-medium">Followers</div>
            </div>
            
            {/* Avatar */}
            <Avatar className="h-64 w-64 border-[16px] border-background shadow-2xl relative z-10">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-7xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
            </Avatar>
            
            {/* Right Stats - Following */}
            <div className="absolute right-4 top-32 text-center">
              <div className="text-5xl font-bold leading-none mb-2">0</div>
              <div className="text-base font-medium">Following</div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="flex justify-center my-6 mt-8">
            <div className="border-[4px] border-foreground rounded-full px-16 py-5">
              <div className="text-6xl font-bold text-center leading-none mb-2">{profile.aelix_score.toLocaleString()}</div>
              <div className="text-sm font-bold text-center tracking-[0.25em] uppercase">Aelix Score</div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-xl mb-8 px-4">"{profile.bio}"</p>
          )}

          {/* Edit Profile Button */}
          <Button 
            variant="outline" 
            className="w-full rounded-full py-8 text-lg font-bold border-[3px] mb-8 hover:bg-muted"
            onClick={() => navigate('/settings')}
          >
            Edit Profile
          </Button>

          {/* Social Links */}
          <div className="flex gap-4 mb-10">
            <Button className="flex-1 rounded-full py-7 bg-foreground hover:bg-foreground/90 text-background">
              <Play className="h-6 w-6 fill-current" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-7 border-[3px]">
              <Camera className="h-6 w-6" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-7 border-[3px]">
              <span className="text-2xl font-bold">𝕏</span>
            </Button>
          </div>

          {/* Menu Icon */}
          <div className="mb-8 pl-1">
            <Menu className="h-10 w-10 stroke-[4]" />
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
