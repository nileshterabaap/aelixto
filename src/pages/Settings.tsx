import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
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

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading, upsertProfile } = useCurrentProfile();
  const { toast } = useToast();
  const { isSupported: pushSupported } = usePushNotifications();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Dialogs
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
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
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
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
