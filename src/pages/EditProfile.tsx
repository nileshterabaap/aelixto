import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Check, X, Share2, Info } from "lucide-react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { buildShortUrl, buildProfilePath } from "@/lib/shortUrl";
import { toast as sonnerToast } from "sonner";

const EditProfile = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { uploadImage, uploading } = useImageUpload();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    cover_url: '',
  });
  const [aelixScoreEnabled, setAelixScoreEnabled] = useState(true);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'self'>('idle');

  // Cleanup info tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, []);

  // Close info tooltip when tapping/clicking anywhere
  useEffect(() => {
    if (!showInfoTooltip) return;
    const close = () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
      setShowInfoTooltip(false);
    };
    // Delay attach so the opening tap doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', close, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', close, true);
    };
  }, [showInfoTooltip]);

  // Check ownership and redirect if not owner
  useEffect(() => {
    if (!loading && profile && user && user.id !== profile.user_id) {
      navigate(`/u/${profile.username}`);
    }
  }, [loading, profile, user, navigate]);

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username,
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        cover_url: profile.cover_url || '',
      });
      // Load Aelix Score preference from settings
      const settings = profile.settings as any;
      // Default to OFF — users must opt in to display their Aelix Score.
      setAelixScoreEnabled(settings?.aelix_score_enabled === true);
    }
  }, [profile]);

  // Debounced username availability check
  useEffect(() => {
    const uname = formData.username.trim();
    if (!profile) return;
    if (uname === profile.username) {
      setUsernameStatus('self');
      return;
    }
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(uname)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', uname)
        .maybeSingle();
      if (error) {
        setUsernameStatus('idle');
        return;
      }
      if (!data || data.user_id === profile.user_id) {
        setUsernameStatus('available');
      } else {
        setUsernameStatus('taken');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [formData.username, profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const url = await uploadImage(file, "avatars", user.id);
    if (url) {
      setFormData({ ...formData, avatar_url: url });
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!user) return;
    const url = await uploadImage(file, "covers", user.id);
    if (url) {
      setFormData({ ...formData, cover_url: url });
    }
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    const url = await buildShortUrl(buildProfilePath(profile.username));
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.display_name || profile.username} on Aelixto`,
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      sonnerToast.success("Profile link copied");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking') {
      toast({
        title: "Username unavailable",
        description: usernameStatus === 'checking' ? "Still checking, please wait." : "Please choose a different username.",
        variant: "destructive",
      });
      return;
    }
    await upsertProfile({
      ...formData,
      settings: {
        ...((profile?.settings as any) || {}),
        aelix_score_enabled: aelixScoreEnabled,
      },
    });
    toast({
      title: "Profile updated",
      description: "Your changes have been saved.",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to edit your profile</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+var(--safe-bottom))]">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="your_username"
                pattern="^[a-zA-Z0-9_.]{3,30}$"
                required
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === 'available' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            {usernameStatus === 'available' && (
              <p className="text-sm text-green-600">Username is available</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="text-sm text-destructive">Username is not available</p>
            )}
            {usernameStatus === 'invalid' && (
              <p className="text-sm text-destructive">3-30 characters, letters, numbers, dots and underscores only</p>
            )}
            {(usernameStatus === 'idle' || usernameStatus === 'self' || usernameStatus === 'checking') && (
              <p className="text-sm text-muted-foreground">
                3-30 characters, letters, numbers, dots and underscores only
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Your Name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className={`text-xs ${formData.bio.length > 150 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formData.bio.length}/150
              </span>
            </div>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 150) {
                  setFormData({ ...formData, bio: val });
                }
              }}
              placeholder="Tell us about yourself..."
              rows={4}
              maxLength={150}
            />
          </div>

          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {formData.display_name?.[0] || formData.username[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <ImageUploadButton
                  onFileSelect={handleAvatarUpload}
                  uploading={uploading}
                >
                  Upload Avatar
                </ImageUploadButton>
                {formData.avatar_url && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setFormData({ ...formData, avatar_url: '' })}
                  >
                    Remove Avatar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>
            {formData.cover_url && (
              <div className="rounded-lg overflow-hidden border h-32 mb-2">
                <img 
                  src={formData.cover_url} 
                  alt="Cover preview" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <ImageUploadButton
              onFileSelect={handleCoverUpload}
              uploading={uploading}
            >
              Upload Cover Image
            </ImageUploadButton>
            {formData.cover_url && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setFormData({ ...formData, cover_url: '' })}
              >
                Remove Cover Image
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 relative">
                <div className="flex items-center gap-2">
                  <Label htmlFor="aelix-score">Aelix Score</Label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
                      setShowInfoTooltip(true);
                      infoTimeoutRef.current = setTimeout(() => setShowInfoTooltip(false), 5000);
                    }}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                {showInfoTooltip && (
                  <div className="absolute left-0 top-full mt-2 z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                    <p>Aelix Score represents the total engagement earned by your shared posts.</p>
                    <ul className="list-disc pl-4 space-y-0.5 mt-1">
                      <li>Viewed a shared post (+1)</li>
                      <li>Played shared content (+1)</li>
                      <li>Visited the original source (+1)</li>
                    </ul>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Display your Aelix Score on your profile
                </p>
              </div>
              <Switch
                id="aelix-score"
                checked={aelixScoreEnabled}
                onCheckedChange={setAelixScoreEnabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reset Aelix Score</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Reset your Aelix Score back to 0. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" className="w-full">
                  Reset Aelix Score
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your Aelix Score to 0. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    const { error } = await supabase
                      .from('profiles')
                      .update({ aelix_score: 0 })
                      .eq('user_id', user?.id);
                    
                    if (error) {
                      toast({
                        title: "Error",
                        description: "Failed to reset Aelix Score",
                        variant: "destructive",
                      });
                    } else {
                      toast({
                        title: "Success",
                        description: "Aelix Score has been reset to 0",
                      });
                      queryClient.invalidateQueries({ queryKey: ['profile'] });
                    }
                  }}>
                    Reset Score
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="space-y-2">
            <Label>Share Profile</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Copy your profile link or share it with others.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleShareProfile}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Profile
            </Button>
          </div>

          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </main>

      
      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default EditProfile;
