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
        {/* Header Image */}
        <div className="relative h-48 bg-gradient-to-r from-purple-500 to-pink-500">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-16 mb-4">
            <Avatar className="h-32 w-32 border-4 border-background">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
            </Avatar>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="mb-4 text-foreground">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-6 mb-4">
            <div>
              <span className="font-bold">0</span>
              <span className="text-muted-foreground ml-1">Following</span>
            </div>
            <div>
              <span className="font-bold">0</span>
              <span className="text-muted-foreground ml-1">Followers</span>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-4 mb-6">
            <div className="text-white/80 text-sm">Aelix Score</div>
            <div className="text-white text-3xl font-bold">{profile.aelix_score}</div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
              <TabsTrigger value="media" className="flex-1">Media</TabsTrigger>
              <TabsTrigger value="likes" className="flex-1">Likes</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              <p className="text-center text-muted-foreground py-8">
                No posts yet
              </p>
            </TabsContent>

            <TabsContent value="media" className="mt-6">
              <p className="text-center text-muted-foreground py-8">
                No media yet
              </p>
            </TabsContent>

            <TabsContent value="likes" className="mt-6">
              <p className="text-center text-muted-foreground py-8">
                No likes yet
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
