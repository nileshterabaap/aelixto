import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Rss, 
  Bell, 
  Palette, 
  HelpCircle,
  Link2,
  ChevronRight,
  LogOut,
  Trash2,
  Mail,
  Lock,
  Eye,
  MessageSquare,
  Play,
  Loader2,
  ExternalLink,
  Ban,
  BellRing
} from "lucide-react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";


type Theme = 'system' | 'light' | 'dark';

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    // Privacy
    profilePublic: true,
    allowInteractions: true,
    // Content & Feed
    autoplayEmbeds: true,
    loadEmbedsOnTap: false,
    defaultFeedTab: 'following' as 'following' | 'discover',
    // Notifications
    notifyFollowers: true,
    notifySaves: true,
    notifyUpdates: true,
    // Appearance
    theme: 'system' as Theme,
  });

  // Dialogs
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load settings from profile
  useEffect(() => {
    if (profile?.settings) {
      const s = profile.settings as any;
      setSettings(prev => ({
        ...prev,
        profilePublic: s.profile_public !== false,
        allowInteractions: s.allow_interactions !== false,
        autoplayEmbeds: s.autoplay_embeds !== false,
        loadEmbedsOnTap: s.load_embeds_on_tap === true,
        defaultFeedTab: s.default_feed_tab || 'following',
        notifyFollowers: s.notify_followers !== false,
        notifySaves: s.notify_saves !== false,
        notifyUpdates: s.notify_updates !== false,
        theme: s.theme || 'system',
      }));
    }
  }, [profile]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  const saveSettings = async (newSettings: typeof settings) => {
    setSettings(newSettings);
    await upsertProfile({
      settings: {
        ...((profile?.settings as any) || {}),
        profile_public: newSettings.profilePublic,
        allow_interactions: newSettings.allowInteractions,
        autoplay_embeds: newSettings.autoplayEmbeds,
        load_embeds_on_tap: newSettings.loadEmbedsOnTap,
        default_feed_tab: newSettings.defaultFeedTab,
        notify_followers: newSettings.notifyFollowers,
        notify_saves: newSettings.notifySaves,
        notify_updates: newSettings.notifyUpdates,
        theme: newSettings.theme,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    toast({
      title: "Account deletion requested",
      description: "Please contact support to complete account deletion.",
    });
  };

  const handleChangeEmail = async () => {
    if (!newEmail) return;
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verification sent", description: "Check your new email for confirmation." });
      setChangeEmailOpen(false);
      setNewEmail('');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully." });
      setChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    }
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SettingRow = ({ 
    icon: Icon, 
    label, 
    description,
    onClick,
    rightElement,
    danger = false,
  }: { 
    icon: any; 
    label: string; 
    description?: string;
    onClick?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick && !rightElement}
      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
        onClick ? 'hover:bg-muted/50 active:bg-muted cursor-pointer' : ''
      } ${danger ? 'text-destructive' : ''}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${danger ? '' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground truncate">{description}</p>}
      </div>
      {rightElement || (onClick && <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />)}
    </button>
  );

  const SettingToggle = ({ 
    icon: Icon, 
    label, 
    description,
    checked,
    onCheckedChange,
  }: { 
    icon: any; 
    label: string; 
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center gap-4 p-4">
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-2">{title}</h2>
      <div className="bg-card rounded-xl border divide-y divide-border">
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Profile Section */}
        <Section title="Profile">
          <SettingRow
            icon={User}
            label="Edit Profile"
            description="Username, name, bio, avatar, cover"
            onClick={() => navigate('/edit-profile')}
          />
        </Section>

        {/* Account Section */}
        <Section title="Account">
          <SettingRow
            icon={Mail}
            label="Email"
            description={user.email}
            onClick={() => setChangeEmailOpen(true)}
          />
          <SettingRow
            icon={Lock}
            label="Change Password"
            onClick={() => setChangePasswordOpen(true)}
          />
          <SettingRow
            icon={LogOut}
            label="Log Out"
            onClick={handleLogout}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div>
                <SettingRow
                  icon={Trash2}
                  label="Delete Account"
                  danger
                  onClick={() => {}}
                />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>

        {/* Privacy Section */}
        <Section title="Privacy">
          <SettingToggle
            icon={Eye}
            label="Public Profile"
            description="Anyone can view your profile"
            checked={settings.profilePublic}
            onCheckedChange={(checked) => saveSettings({ ...settings, profilePublic: checked })}
          />
          <SettingToggle
            icon={MessageSquare}
            label="Allow Interactions"
            description="Others can comment and message you"
            checked={settings.allowInteractions}
            onCheckedChange={(checked) => saveSettings({ ...settings, allowInteractions: checked })}
          />
        </Section>

        {/* Content & Feed Section */}
        <Section title="Content & Feed">
          <SettingToggle
            icon={Play}
            label="Autoplay"
            description="Videos and media play automatically"
            checked={settings.autoplayEmbeds}
            onCheckedChange={(checked) => saveSettings({ ...settings, autoplayEmbeds: checked })}
          />
        </Section>

        {/* Notifications Section */}
        <Section title="Notifications">
          {pushSupported && (
            <div className="flex items-center gap-4 p-4">
              <BellRing className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified even when app is closed</p>
              </div>
              <Switch 
                checked={pushSubscribed} 
                disabled={pushLoading}
                onCheckedChange={async (checked) => {
                  if (checked) {
                    const success = await subscribePush();
                    if (success) {
                      toast({ title: "Push notifications enabled" });
                    } else {
                      toast({ title: "Failed to enable", description: "Please allow notifications in your browser settings", variant: "destructive" });
                    }
                  } else {
                    await unsubscribePush();
                    toast({ title: "Push notifications disabled" });
                  }
                }} 
              />
            </div>
          )}
          <SettingToggle
            icon={Bell}
            label="New Followers"
            description="When someone follows you"
            checked={settings.notifyFollowers}
            onCheckedChange={(checked) => saveSettings({ ...settings, notifyFollowers: checked })}
          />
          <SettingToggle
            icon={Bell}
            label="Saves"
            description="When someone saves your post"
            checked={settings.notifySaves}
            onCheckedChange={(checked) => saveSettings({ ...settings, notifySaves: checked })}
          />
          <SettingToggle
            icon={Bell}
            label="Platform Updates"
            description="News and feature announcements"
            checked={settings.notifyUpdates}
            onCheckedChange={(checked) => saveSettings({ ...settings, notifyUpdates: checked })}
          />
        </Section>


        {/* Help & Legal Section */}
        <Section title="Help & Legal">
          <SettingRow
            icon={HelpCircle}
            label="Report a Problem"
            onClick={() => window.open('mailto:support@aelixto.com', '_blank')}
          />
          <SettingRow
            icon={Ban}
            label="Blocked Users"
            description="Manage blocked accounts"
            onClick={() => toast({ title: "Coming soon", description: "Blocked users management is coming soon." })}
          />
          <SettingRow
            icon={ExternalLink}
            label="Terms of Service"
            onClick={() => window.open('/terms', '_blank')}
          />
          <SettingRow
            icon={Shield}
            label="Privacy Policy"
            onClick={() => window.open('/privacy', '_blank')}
          />
        </Section>
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Change Email Dialog */}
      <Dialog open={changeEmailOpen} onOpenChange={setChangeEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Enter your new email address. You'll receive a verification email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeEmailOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeEmail} disabled={isSubmitting || !newEmail}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting || !newPassword || !confirmPassword}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
