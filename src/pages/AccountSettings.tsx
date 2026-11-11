import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";

// Settings → Account. Shows who is signed in and keeps the
// "Deactivate or delete account" entry one step away from main Settings.
const AccountSettings = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile, loading } = useCurrentProfile();

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

  if (loading) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-4 py-4">
      <span className="text-base text-foreground">{label}</span>
      <span className="text-sm text-muted-foreground truncate">{value}</span>
    </div>
  );

  return (
    <div className="screen-nav bg-background">
      <main className="mx-auto max-w-2xl px-4 py-4" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Account</h1>
        </div>

        <div className="divide-y divide-border pt-4">
          <InfoRow label="Username" value={profile?.username ? `@${profile.username}` : "—"} />
          <InfoRow label="Email" value={user.email || "—"} />
        </div>

        <div className="divide-y divide-border pt-8">
          <button
            onClick={() => navigate("/settings/account/deactivate-or-delete")}
            className="w-full flex items-center justify-between py-4 text-left text-foreground transition-colors active:bg-muted/50"
          >
            <span className="text-base">Deactivate or delete account</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default AccountSettings;
