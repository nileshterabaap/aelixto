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
          
          {/* Cover Image */}
          <div className="relative h-[220px] sm:h-[260px] bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-[28px] overflow-hidden">
            {profile.cover_url && (
              <img
                src={profile.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/15" />
            
            {/* Name & Username - Top Left */}
            <div className="absolute top-5 left-5 z-10">
              <h1 className="text-[28px] sm:text-[30px] font-extrabold leading-[1.1] text-black drop-shadow-none">
                {profile.display_name || profile.username}
              </h1>
              <p className="mt-1 text-[16px] font-medium text-black/70">@{profile.username}</p>
            </div>
            
            {/* Back Button - Orange */}
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 left-4 h-10 w-10 rounded-full bg-[#FF8A00] text-black flex items-center justify-center shadow-lg hover:bg-[#FF8A00]/90 transition-colors"
            >
              <ArrowLeft className="h-[22px] w-[22px]" />
            </button>

            {/* External Link Button */}
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-black/35 text-white border border-white/30 backdrop-blur flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <ExternalLink className="h-5 w-5" />
            </button>
          </div>

          {/* Profile Content */}
          <div className="relative px-4 pb-6 bg-background">
            {/* Curved white background behind avatar */}
            <div className="absolute left-0 right-0 -top-8 h-16 bg-background">
              <svg viewBox="0 0 100 20" className="w-full h-full" preserveAspectRatio="none">
                <path d="M0,20 Q25,0 50,0 T100,20 L100,20 L0,20 Z" fill="currentColor" className="text-background" />
              </svg>
            </div>

            {/* Avatar - Centered and Overlapping */}
            <div className="relative flex justify-center -mt-[48px] z-20">
              <Avatar className="h-[140px] w-[140px] rounded-full border-[6px] border-white shadow-[0_8px_22px_rgba(0,0,0,0.25)] bg-white overflow-hidden">
                <AvatarImage src={profile.avatar_url || undefined} className="w-full h-full object-cover" />
                <AvatarFallback className="text-4xl font-bold">{profile.display_name?.[0] || profile.username[0]}</AvatarFallback>
              </Avatar>
            </div>

            {/* Followers / Following - Symmetric Row Below Avatar */}
            <div className="mt-3 grid grid-cols-3 items-center">
              <div className="text-center">
                <div className="text-[40px] font-extrabold tracking-tight leading-none">0</div>
                <div className="text-[15px] text-muted-foreground font-medium">Followers</div>
              </div>
              <div /> {/* Spacer for symmetry */}
              <div className="text-center">
                <div className="text-[40px] font-extrabold tracking-tight leading-none">0</div>
                <div className="text-[15px] text-muted-foreground font-medium">Following</div>
              </div>
            </div>

            {/* Aelix Score Badge */}
            <div className="mt-5 flex justify-center">
              <div className="rounded-[22px] border-2 border-black bg-white px-10 py-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
                <div className="text-[40px] font-extrabold text-center leading-none">{profile.aelix_score.toLocaleString()}</div>
                <div className="mt-1 text-[13px] tracking-[0.25em] font-semibold uppercase text-muted-foreground text-center">AELIX SCORE</div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-center italic text-[16px] leading-6 text-foreground/90 mt-5 px-6">"{profile.bio}"</p>
            )}

            {/* Edit Profile Button */}
            <button
              onClick={() => navigate('/settings')}
              className="mt-6 w-full rounded-full border-2 border-black bg-white py-4 text-[18px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.06)] hover:bg-muted/50 transition-colors"
            >
              Edit Profile
            </button>

            {/* Menu Icon */}
            <div className="mt-6 flex justify-start">
              <div className="flex flex-col gap-1.5">
                <div className="h-1 w-10 bg-black rounded-full" />
                <div className="h-1 w-10 bg-black rounded-full" />
                <div className="h-1 w-10 bg-black rounded-full" />
              </div>
            </div>

            {/* Social Media Buttons */}
            <div className="mt-6 flex items-center gap-4">
              <button className="flex-1 rounded-full bg-black text-white h-14 px-5 font-semibold flex items-center justify-center gap-2 hover:bg-black/90 transition-colors">
                <Play className="h-5 w-5 fill-current" />
              </button>
              <button className="flex-1 rounded-full border-2 border-foreground/15 h-14 px-5 text-foreground/70 font-semibold flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                <Instagram className="h-5 w-5" />
              </button>
              <button className="flex-1 rounded-full border-2 border-foreground/15 h-14 px-5 text-foreground/70 font-semibold flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
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
