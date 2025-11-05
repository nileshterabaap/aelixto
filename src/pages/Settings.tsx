import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { uploadImage, uploading } = useImageUpload();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    cover_url: '',
  });

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
    }
  }, [profile]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertProfile(formData);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access settings</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
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
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="your_username"
              pattern="^[a-zA-Z0-9_.]{3,30}$"
              required
            />
            <p className="text-sm text-muted-foreground">
              3-30 characters, letters, numbers, dots and underscores only
            </p>
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
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              rows={4}
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
              <div className="flex-1">
                <ImageUploadButton
                  onFileSelect={handleAvatarUpload}
                  uploading={uploading}
                >
                  Upload Avatar
                </ImageUploadButton>
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
          </div>

          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Settings;
