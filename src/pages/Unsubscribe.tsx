import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State = "loading" | "valid" | "used" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: supabaseAnonKey } }
        );
        const data = await res.json();
        if (data?.alreadyUnsubscribed) {
          setEmail(data.email || null);
          setState("used");
        } else if (data?.valid) {
          setEmail(data.email || null);
          setState("valid");
        } else {
          setState("invalid");
        }
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setState(error ? "error" : "done");
  };

  return (
    <main className="screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md text-center space-y-4 border border-border rounded-2xl p-8 bg-card">
        <h1 className="text-2xl font-bold">Email preferences</h1>
        {state === "loading" && <p className="text-muted-foreground">Checking link…</p>}
        {state === "invalid" && (
          <p className="text-destructive">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "used" && (
          <p className="text-muted-foreground">
            {email ? <strong>{email}</strong> : "This address"} is already unsubscribed.
          </p>
        )}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground">
              Unsubscribe {email ? <strong>{email}</strong> : "this address"} from Aelixto emails?
            </p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === "submitting" && <p className="text-muted-foreground">Updating…</p>}
        {state === "done" && <p>You've been unsubscribed. ✓</p>}
        {state === "error" && <p className="text-destructive">Something went wrong. Try again.</p>}
      </div>
    </main>
  );
};

export default Unsubscribe;