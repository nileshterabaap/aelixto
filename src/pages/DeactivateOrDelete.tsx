import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/useSession";
import { logOutCurrentAccount } from "@/lib/accountSwitcher";

type Choice = "deactivate" | "delete";

// Settings → Account → Deactivate or delete account.
const DeactivateOrDelete = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast } = useToast();
  const [choice, setChoice] = useState<Choice>("deactivate");

  // Deactivate: hidden from everyone until the owner logs in again.
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const handleDeactivate = async () => {
    if (deactivating) return;
    setDeactivating(true);
    const { error } = await supabase.rpc("deactivate_my_account");
    if (error) {
      setDeactivating(false);
      toast({ title: "Couldn't deactivate", description: "Please check your connection and try again.", variant: "destructive" });
      return;
    }
    await logOutCurrentAccount({ everywhere: true });
  };

  // Delete: permanent, after confirming the account password.
  // Google/Apple-only accounts have no password, so they confirm with the button alone.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const hasPassword = !!user?.email && (user?.identities ?? []).some((i) => i.provider === "email");
  const canDelete = !hasPassword || deleteText.length > 0;
  const handleDelete = async () => {
    if (deleting || !canDelete) return;
    setDeleting(true);
    if (hasPassword) {
      const { error: pwError } = await supabase.auth.signInWithPassword({ email: user!.email!, password: deleteText });
      if (pwError) {
        setDeleting(false);
        toast({ title: "Wrong password", description: "Please check your password and try again.", variant: "destructive" });
        return;
      }
    }
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      setDeleting(false);
      toast({ title: "Couldn't delete account", description: "Please check your connection and try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Account deleted", description: "Your account and everything in it are gone." });
    await logOutCurrentAccount({ accountDeleted: true });
  };

  const handleContinue = () => {
    if (choice === "deactivate") {
      setDeactivateOpen(true);
    } else {
      setDeleteText("");
      setDeleteOpen(true);
    }
  };

  if (!user) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access settings</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const Option = ({ value, title, text }: { value: Choice; title: string; text: string }) => (
    <Label
      htmlFor={`leave-${value}`}
      className="flex items-start justify-between gap-4 py-4 cursor-pointer font-normal"
    >
      <span className="flex flex-col gap-1">
        <span className="text-base text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground leading-snug">{text}</span>
      </span>
      <RadioGroupItem value={value} id={`leave-${value}`} className="mt-1 flex-shrink-0" />
    </Label>
  );

  return (
    <div className="screen-nav bg-background">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Deactivate or delete</h1>
        </div>

        <RadioGroup
          value={choice}
          onValueChange={(v) => setChoice(v as Choice)}
          className="divide-y divide-border pt-4 gap-0"
        >
          <Option
            value="deactivate"
            title="Deactivate account"
            text="Your profile and posts are hidden until you log back in."
          />
          <Option
            value="delete"
            title="Delete account"
            text="Your account and everything in it is removed for good."
          />
        </RadioGroup>

        <Button className="w-full mt-8" onClick={handleContinue}>
          Continue
        </Button>
      </main>

      {/* Deactivate Account Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={(o) => { if (!deactivating) setDeactivateOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate account?</DialogTitle>
            <DialogDescription>
              Your profile, posts, likes and comments will be hidden from everyone, and you'll be logged out on all your devices. Nothing is deleted. To come back, just log in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateOpen(false)} disabled={deactivating}>Cancel</Button>
            <Button onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This deletes your profile, posts, likes, comments, followers, chats and photos forever. It can't be undone.
            </DialogDescription>
          </DialogHeader>
          {hasPassword && (
            <div className="space-y-2 py-2">
              <Label htmlFor="delete-confirm">Enter your password to confirm</Label>
              <Input
                id="delete-confirm"
                type="password"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !canDelete}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeactivateOrDelete;
