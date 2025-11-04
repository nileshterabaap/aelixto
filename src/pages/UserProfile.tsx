import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
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
        <div className="relative h-64 bg-gradient-to-r from-purple-500 to-pink-500">
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
            className="absolute top-4 left-4 bg-destructive hover:bg-destructive/90 text-white rounded-full h-12 w-12"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          {/* Name Overlay */}
          <div className="absolute top-4 left-20 text-white">
            <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
            <p className="text-white/90">@{profile.username}</p>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-background rounded-t-3xl -mt-8 relative pt-16 px-6 pb-6">
          {/* Avatar with Stats */}
          <div className="flex justify-between items-start -mt-24 mb-8">
            <Avatar className="h-40 w-40 border-8 border-background shadow-xl">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-4xl">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
            </Avatar>
            
            {/* Follower Stats */}
            <div className="flex gap-8 pt-8">
              <div className="text-center">
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Following</div>
              </div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="flex justify-center mb-6">
            <div className="border-4 border-foreground rounded-full px-8 py-3">
              <div className="text-4xl font-bold text-center">{profile.aelix_score.toLocaleString()}</div>
              <div className="text-sm font-semibold text-center tracking-wider">AELIX SCORE</div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-center italic text-lg mb-6">"{profile.bio}"</p>
          )}

          {/* Edit Profile Button */}
          <Button 
            variant="outline" 
            className="w-full rounded-full py-6 text-lg font-semibold mb-6"
            onClick={() => navigate('/settings')}
          >
            Edit Profile
          </Button>

          {/* Social Links Placeholder */}
          <div className="flex gap-3 mb-8">
            <Button variant="default" className="flex-1 rounded-full bg-black text-white hover:bg-black/90">
              <span className="font-semibold">▶</span>
            </Button>
            <Button variant="outline" className="flex-1 rounded-full">
              <span className="font-semibold">📷</span>
            </Button>
            <Button variant="outline" className="flex-1 rounded-full">
              <span className="font-semibold">𝕏</span>
            </Button>
          </div>

          {/* Content Grid */}
          <div className="border-t pt-6">
            <div className="flex gap-2 mb-4">
              <div className="h-8 w-8 bg-foreground"></div>
              <div className="h-8 w-8 bg-foreground"></div>
              <div className="h-8 w-8 bg-foreground"></div>
            </div>
            
            <Tabs defaultValue="posts" className="w-full">
              <TabsContent value="posts" className="mt-0">
                <p className="text-center text-muted-foreground py-8">
                  No posts yet
                </p>
              </TabsContent>
            </Tabs>
          </div>
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
