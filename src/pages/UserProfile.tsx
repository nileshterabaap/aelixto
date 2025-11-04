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
        <div className="relative h-[380px] bg-gradient-to-r from-purple-500 to-pink-500">
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
            className="absolute top-4 left-4 bg-destructive hover:bg-destructive/90 text-white rounded-full h-12 w-12 shadow-lg"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Name Overlay */}
          <div className="absolute top-4 left-20 text-white drop-shadow-lg">
            <h1 className="text-2xl font-bold leading-tight">{profile.display_name || profile.username}</h1>
            <p className="text-white/95 text-base">@{profile.username}</p>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
          {/* Avatar centered */}
          <div className="flex justify-center -mt-32 pt-6">
            <Avatar className="h-56 w-56 border-[12px] border-background shadow-2xl">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-6xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
            </Avatar>
          </div>

          {/* Stats row below avatar */}
          <div className="flex justify-center gap-24 mt-6">
            <div className="text-center">
              <div className="text-4xl font-bold leading-none mb-1">0</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold leading-none mb-1">0</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="flex justify-center my-8">
            <div className="border-[3px] border-foreground rounded-full px-12 py-4">
              <div className="text-5xl font-bold text-center leading-none mb-1">{profile.aelix_score.toLocaleString()}</div>
              <div className="text-xs font-bold text-center tracking-[0.2em] uppercase">Aelix Score</div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-lg mb-8 px-4">"{profile.bio}"</p>
          )}

          {/* Edit Profile Button */}
          <Button 
            variant="outline" 
            className="w-full rounded-full py-7 text-base font-semibold border-2 mb-6 hover:bg-muted"
            onClick={() => navigate('/settings')}
          >
            Edit Profile
          </Button>

          {/* Social Links */}
          <div className="flex gap-3 mb-10">
            <Button className="flex-1 rounded-full py-6 bg-foreground hover:bg-foreground/90 text-background">
              <Play className="h-5 w-5 fill-current" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-6 border-2">
              <Camera className="h-5 w-5" />
            </Button>
            <Button variant="outline" className="flex-1 rounded-full py-6 border-2">
              <span className="text-xl font-bold">𝕏</span>
            </Button>
          </div>

          {/* Menu Icon */}
          <div className="mb-6 pl-1">
            <Menu className="h-8 w-8 stroke-[3]" />
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
