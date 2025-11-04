import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Play, ExternalLink, Instagram } from "lucide-react";
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
    <div className="min-h-screen bg-muted/30 pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-[430px] px-4 pt-4 pb-2">
        {/* Profile Card */}
        <div className="rounded-[28px] border-2 border-foreground/15 shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden bg-background">
          
          {/* Cover Image with Name Overlay */}
          <div className="relative h-[220px] sm:h-[260px] bg-gradient-to-r from-purple-500 to-pink-500">
            {profile.cover_url && (
              <img
                src={profile.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/25" />
            
            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/35 backdrop-blur border border-white/20 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <ArrowLeft className="h-[22px] w-[22px]" />
            </button>

            {/* Name Overlay - Bottom Left */}
            <div className="absolute bottom-4 left-5 text-white drop-shadow-lg z-10">
              <h1 className="text-[28px] sm:text-[30px] font-extrabold leading-[1.1]">{profile.display_name || profile.username}</h1>
              <p className="text-[16px] text-white/90 font-medium">@{profile.username}</p>
            </div>
          </div>

          {/* Profile Content with Curved Sides */}
          <div className="relative px-4 pb-6">
            {/* Curved white overlay on sides */}
            <div className="absolute left-0 right-0 -top-8 h-16 bg-background">
              <svg viewBox="0 0 100 20" className="w-full h-full" preserveAspectRatio="none">
                <path d="M0,20 Q25,0 50,0 T100,20 L100,20 L0,20 Z" fill="currentColor" className="text-background" />
              </svg>
            </div>

            {/* Avatar and Stats Container */}
            <div className="grid grid-cols-3 items-center gap-2 -mt-14 relative z-10">
              {/* Left Stats - Followers */}
              <div className="text-center">
                <div className="text-[32px] sm:text-[36px] font-extrabold leading-none tracking-tight">0</div>
                <div className="text-[13px] text-muted-foreground font-medium">Followers</div>
              </div>
              
              {/* Avatar */}
              <div className="flex justify-center">
                <Avatar className="h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] rounded-full border-[6px] border-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] bg-white">
                  <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="text-5xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
                </Avatar>
              </div>
              
              {/* Right Stats - Following */}
              <div className="text-center">
                <div className="text-[32px] sm:text-[36px] font-extrabold leading-none tracking-tight">0</div>
                <div className="text-[13px] text-muted-foreground font-medium">Following</div>
              </div>
            </div>

            {/* Aelix Score */}
            <div className="flex justify-center mt-5">
              <div className="rounded-[22px] border-2 border-foreground/15 px-8 py-3 bg-background shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
                <div className="text-[32px] sm:text-[36px] font-extrabold text-center leading-none">{profile.aelix_score.toLocaleString()}</div>
                <div className="text-[12px] font-semibold text-center tracking-[0.2em] uppercase text-muted-foreground mt-1">Aelix Score</div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-center italic text-[16px] leading-6 text-foreground/90 mt-5 px-6">"{profile.bio}"</p>
            )}

            {/* Edit Profile Button */}
            <Button 
              variant="outline" 
              className="w-full rounded-[30px] h-12 text-base font-semibold border-2 mt-6 hover:bg-muted"
              onClick={() => navigate('/settings')}
            >
              Edit Profile
            </Button>

            {/* Social Tabs */}
            <div className="mt-6 flex items-center gap-3">
              <button className="flex-1 rounded-[22px] bg-foreground text-background h-11 px-5 font-semibold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors">
                <Play className="h-5 w-5 fill-current" />
              </button>
              <button className="flex-1 rounded-[22px] border border-foreground/15 h-11 px-5 text-foreground/70 font-semibold flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                <Instagram className="h-5 w-5" />
              </button>
              <button className="flex-1 rounded-[22px] border border-foreground/15 h-11 px-5 text-foreground/70 font-semibold flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                <span className="text-xl font-bold">𝕏</span>
              </button>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="posts" className="w-full mt-6">
              <TabsContent value="posts" className="mt-0">
                <p className="text-center text-muted-foreground py-12 text-base">
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
