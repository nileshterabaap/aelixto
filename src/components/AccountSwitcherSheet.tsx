import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSavedAccounts } from "@/hooks/useSavedAccounts";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";
import { MAX_ACCOUNTS, canAddAccount, orderForDisplay } from "@/lib/accountStore";
import { OPEN_ACCOUNT_SWITCHER_EVENT, switchToAccount } from "@/lib/accountSwitcher";

/** Opens the "Add account" sign-in page, unless the device already holds the maximum. */
export function useStartAddAccount() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const accounts = useSavedAccounts();
  return () => {
    if (!canAddAccount(accounts)) {
      toast({
        title: "Account limit reached",
        description: `You can be signed in to up to ${MAX_ACCOUNTS} accounts. Log out of one to add another.`,
      });
      return;
    }
    navigate("/auth?add=1");
  };
}

/**
 * Instagram-style account switcher. Mounted once; opened from the name on
 * your own profile, a long press on the Profile tab, or Settings.
 */
export const AccountSwitcherHost = () => {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const accounts = useSavedAccounts();
  const { user } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const startAdd = useStartAddAccount();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ACCOUNT_SWITCHER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ACCOUNT_SWITCHER_EVENT, onOpen);
  }, []);

  if (!user) return null;
  const activeId = user.id;
  const list = orderForDisplay(accounts, activeId);

  const handleSwitch = async (userId: string) => {
    if (pendingId) return;
    if (userId === activeId) {
      setOpen(false);
      return;
    }
    setPendingId(userId);
    const res = await switchToAccount(userId);
    if (res.ok) return; // the app restarts as the chosen account
    setPendingId(null);
    if (res.reason === "expired") {
      toast({
        title: "Please sign in again",
        description: `${res.username ? "@" + res.username : "That account"} was signed out. Sign in to add it back.`,
      });
      setOpen(false);
      navigate("/auth?add=1");
    } else {
      toast({
        title: "Couldn't switch accounts",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !pendingId && setOpen(o)}>
      <SheetContent side="bottom" className="z-[100] p-0 rounded-t-2xl flex flex-col gap-0 border-t pb-[var(--safe-bottom)]">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-center">Switch account</SheetTitle>
        </SheetHeader>
        <div className="px-2 py-2">
          {list.map((a) => {
            const isActive = a.userId === activeId;
            const name = a.username ? `@${a.username}` : "Account";
            return (
              <button
                key={a.userId}
                type="button"
                onClick={() => void handleSwitch(a.userId)}
                disabled={!!pendingId}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors active:bg-muted/60 disabled:opacity-70"
              >
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover flex-shrink-0 bg-muted" />
                ) : (
                  <span className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-base font-semibold text-muted-foreground flex-shrink-0">
                    {(a.username || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm truncate">{name}</span>
                  {a.displayName && (
                    <span className="block text-xs text-muted-foreground truncate">{a.displayName}</span>
                  )}
                </span>
                {pendingId === a.userId ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : isActive ? (
                  <span className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground stroke-[3]" />
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-border" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            disabled={!!pendingId}
            onClick={() => {
              setOpen(false);
              startAdd();
            }}
            className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors active:bg-muted/60"
          >
            <span className="h-11 w-11 rounded-full border border-border flex items-center justify-center flex-shrink-0">
              <Plus className="h-5 w-5" />
            </span>
            <span className="font-semibold text-sm">Add account</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
