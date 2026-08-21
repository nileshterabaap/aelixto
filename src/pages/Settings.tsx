import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showPrivacyOptionsForm } from "@/lib/adConsent";
import { AD_TEST_LS_KEY, AD_TEST_MODE } from "@/config/ads";
import { Capacitor } from "@capacitor/core";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { toast } = useToast();
  const { isSupported: pushSupported } = usePushNotifications();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));

  // Dialogs
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adTestMode, setAdTestMode] = useState(AD_TEST_MODE);
  // "Manage ad preferences" is only shown when the UMP privacy message
  // actually applies to the user's region (GDPR/CPRA). Elsewhere (and in
  // release builds outside those regions) the row stays hidden.
  const [adPrefsAvailable, setAdPrefsAvailable] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        const { GamNative } = await import('aelixto-gam-native');
        const info = await GamNative.requestConsentInfo();
        if (!cancelled) setAdPrefsAvailable(!!info?.privacyOptionsRequired);
      } catch {
        if (!cancelled) setAdPrefsAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdPreferences = async () => {
    const res = await showPrivacyOptionsForm();
    if (!res.ok) {
      toast({
        title: "Ad preferences unavailable",
        description: res.message || "No privacy options form is available for your region.",
        variant: "destructive",
      });
    }
  };

  const toggleAdTestMode = () => {
    const next = !adTestMode;
    try {
      if (next) localStorage.setItem(AD_TEST_LS_KEY, '1');
      else localStorage.removeItem(AD_TEST_LS_KEY);
    } catch { /* ignore */ }
    setAdTestMode(next);
    toast({
      title: next ? "Ad test mode ON" : "Ad test mode OFF",
      description: "Restart the app for it to take effect.",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
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
    if (!currentPassword) {
      toast({ title: "Error", description: "Enter your current password", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (!user.email) {
      toast({ title: "Error", description: "Unable to verify your current password", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      setIsSubmitting(false);
      toast({ title: "Incorrect password", description: "Please check your current password and try again.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully." });
      setChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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

  const Row = ({ label, onClick, hasChevron = true, danger = false }: {
    label: string;
    onClick?: () => void;
    hasChevron?: boolean;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between py-4 text-left transition-colors active:bg-muted/50 ${danger ? 'text-destructive' : 'text-foreground'}`}
    >
      <span className="text-base">{label}</span>
      {hasChevron && <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
    </button>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <p className="text-base text-muted-foreground pt-6 pb-2">{title}</p>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Settings</h1>
        </div>

        {/* Account */}
        <SectionHeader title="Account" />
        <div className="divide-y divide-border">
          <Row label="Edit profile" onClick={() => navigate('/edit-profile')} />
          <Row label="Email" onClick={() => setChangeEmailOpen(true)} />
          <Row label="Change password" onClick={() => setChangePasswordOpen(true)} />
          <Row label="Notifications" onClick={() => navigate('/settings/notifications')} />
          <Row label="Privacy settings" onClick={() => navigate('/settings/privacy')} />
          <Row label="Threads Video Diagnostic" onClick={() => navigate('/settings/threads-diagnostic')} />
          {Capacitor.isNativePlatform() && adPrefsAvailable && (
            <Row label="Manage ad preferences" onClick={() => { void handleAdPreferences(); }} />
          )}
          {Capacitor.isNativePlatform() && (import.meta.env.DEV || adTestMode) && (
            <button
              type="button"
              onClick={toggleAdTestMode}
              className="w-full flex items-center justify-between py-4 text-left"
            >
              <span className="text-base text-foreground">Ad test mode (debug)</span>
              <span className="text-sm text-muted-foreground">{adTestMode ? 'On' : 'Off'}</span>
            </button>
          )}
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Theme</p>
            <div className="flex items-center justify-between">
              <span className="text-base text-foreground">Light</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-base text-muted-foreground/50">Dark</span>
                <span className="text-xs text-muted-foreground/50">Coming soon</span>
              </div>
              <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
            </div>
          </div>
        </div>

        {/* Support */}
        <SectionHeader title="Support" />
        <div className="divide-y divide-border">
          <Row label="Report a problem" onClick={() => window.open('mailto:support@aelixto.com', '_blank')} hasChevron={false} />
          <Row label="Terms of Service" onClick={() => navigate('/terms')} />
          <Row label="Privacy Policy" onClick={() => navigate('/privacy')} />
          <Row label="Child Safety Standards" onClick={() => navigate('/child-safety')} />
        </div>

        {/* Log out at bottom */}
        <SectionHeader title="" />
        <div className="divide-y divide-border">
          <Row label="Log out" onClick={handleLogout} hasChevron={false} />
        </div>
      </main>

      <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

      {/* Change Email Dialog */}
      <Dialog open={changeEmailOpen} onOpenChange={setChangeEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>Enter your new email address. You'll receive a verification email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="your@email.com" />
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
            <DialogDescription>Enter your new password below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
