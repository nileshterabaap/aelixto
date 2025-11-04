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
        <div className="relative h-[340px] bg-gradient-to-r from-purple-500 to-pink-500">
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
            className="absolute top-4 left-4 bg-red-500 hover:bg-red-600 text-white rounded-full h-12 w-12 shadow-lg"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          {/* Name Overlay */}
          <div className="absolute top-8 left-20 text-white drop-shadow-lg">
            <h1 className="text-2xl font-bold leading-tight">{profile.display_name || profile.username}</h1>
            <p className="text-white/95 text-base">@{profile.username}</p>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-[32px] -mt-8 relative px-6 pb-6">
          {/* Avatar and Stats Container */}
          <div className="flex items-center justify-between -mt-[110px] pt-6 relative px-2">
            {/* Left Stats - Followers */}
            <div className="text-center flex-shrink-0">
              <div className="text-3xl font-bold leading-none mb-1">7058</div>
              <div className="text-sm font-medium">Followers</div>
            </div>
            
            {/* Avatar */}
            <Avatar className="h-[220px] w-[220px] border-[12px] border-background shadow-2xl flex-shrink-0 mx-2">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-6xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
            </Avatar>
            
            {/* Right Stats - Following */}
            <div className="text-center flex-shrink-0">
              <div className="text-3xl font-bold leading-none mb-1">85</div>
              <div className="text-sm font-medium">Following</div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="flex justify-center mt-6 mb-6">
            <div className="border-[3px] border-foreground rounded-[32px] px-12 py-4">
              <div className="text-4xl font-bold text-center leading-none mb-1">{profile.aelix_score.toLocaleString()}</div>
              <div className="text-xs font-bold text-center tracking-[0.2em] uppercase">Aelix Score</div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-base mb-6 px-4">"{profile.bio}"</p>
          )}

          {/* Edit Profile Button */}
          <Button 
            variant="outline" 
            className="w-full rounded-full py-6 text-base font-bold border-[2.5px] mb-6 hover:bg-muted"
            onClick={() => navigate('/settings')}
          >
            Edit Profile
          </Button>

          {/* Menu Icon */}
          <div className="mb-4 pl-1">
            <Menu className="h-7 w-7 stroke-[3]" />
          </div>

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
