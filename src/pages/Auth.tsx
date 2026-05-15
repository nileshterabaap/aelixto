import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

const nativeLovableAuth = createLovableAuth({
  oauthBrokerUrl: "https://aelixto.com/~oauth/initiate",
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameValue, setUsernameValue] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        navigate("/");
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Debounced username availability check
  useEffect(() => {
    if (!usernameValue || usernameValue.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", usernameValue.toLowerCase())
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 500);
    return () => clearTimeout(timer);
  }, [usernameValue]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const identifier = (formData.get("signin-identifier") as string)?.trim();
    const password = formData.get("signin-password") as string;

    // Resolve username -> email if the identifier is not an email
    let email = identifier;
    if (!identifier.includes("@")) {
      const handle = identifier.startsWith("@") ? identifier.slice(1) : identifier;
      const { data: resolved, error: rpcError } = await supabase.rpc("get_email_for_username", {
        _username: handle,
      });
      if (rpcError || !resolved) {
        setLoading(false);
        toast({
          title: "Sign in failed",
          description: "No account found with this username.",
          variant: "destructive",
        });
        return;
      }
      email = resolved as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      const isNoUser = msg.includes("invalid login credentials") || msg.includes("invalid_credentials");
      toast({
        title: "Sign in failed",
        description: isNoUser
          ? "Incorrect password, or no account found for this email/username."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Welcome back!", description: "You've successfully signed in." });
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (usernameStatus === "taken") {
      toast({ title: "Username taken", description: "Please choose a different username.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const username = usernameValue || email.split("@")[0];

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username },
      },
    });

    setLoading(false);

    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome!", description: "Your account has been created successfully." });
    }
  };

  const handleForgotPassword = async (identifier: string) => {
    let email = identifier.trim();
    if (email && !email.includes("@")) {
      const handle = email.startsWith("@") ? email.slice(1) : email;
      const { data: resolved } = await supabase.rpc("get_email_for_username", { _username: handle });
      if (!resolved) {
        toast({
          title: "Account not found",
          description: "We couldn't find an account for that username.",
          variant: "destructive",
        });
        return;
      }
      email = resolved as string;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a password reset link. Check your inbox (and spam folder).",
      });
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      // Native flow (APK/AAB):
      // 1. Open Chrome Custom Tab to the OAuth broker.
      // 2. Broker finishes and redirects to our /~auth-bridge web page.
      // 3. Bridge page rewrites to com.aelixto.app10://oauth-callback#tokens.
      // 4. Android resolves the custom scheme back into our installed app,
      //    where the App.appUrlOpen listener completes the sign-in.
      const bridgeUri = "https://aelixto.com/~auth-bridge";
      const result = await nativeLovableAuth.signInWithOAuth("google", {
        redirect_uri: bridgeUri,
      });

      if (result.error) {
        toast({ title: "Error", description: result.error.message, variant: "destructive" });
        return;
      }

      // Open the broker URL in a system browser tab so Google trusts it.
      // (Google blocks OAuth inside embedded WebViews.)
      const targetUrl = (result as { url?: string }).url;
      if (targetUrl) {
        try {
          const { Browser } = await import("@capacitor/browser");
          // Chrome Custom Tab — Google trusts this user agent.
          await Browser.open({ url: targetUrl, presentationStyle: "fullscreen" });
          return;
        } catch (e) {
          // Custom Tab failed (e.g. no Chrome / no browser supporting Custom Tabs).
          // DO NOT fall back to window.location.href — that loads the OAuth page
          // inside the Android WebView and Google blocks it with
          // `disallowed_useragent` (Error 403). Instead, ask Android to open the
          // URL with the user's default external browser via an ACTION_VIEW intent.
          try {
            const { App } = await import("@capacitor/app");
            // App.openUrl asks the OS to resolve the URL — for https:// links
            // this hands off to the default browser app, not our WebView.
            // Available on Capacitor 5+.
            await (App as unknown as { openUrl: (o: { url: string }) => Promise<unknown> }).openUrl({ url: targetUrl });
            return;
          } catch (e2) {
            console.error("Native OAuth: no external browser available", e, e2);
            toast({
              title: "Browser required",
              description:
                "Google sign-in needs to open in a real browser. Please install Chrome (or another browser) and try again.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      // If the SDK already set tokens directly (rare on native), persist them.
      if ((result as { tokens?: { access_token: string; refresh_token: string } }).tokens) {
        const tokens = (result as { tokens: { access_token: string; refresh_token: string } }).tokens;
        const { error } = await supabase.auth.setSession(tokens);
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      }
      return;
    }

    // Web flow — unchanged.
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome</h1>
          <p className="text-muted-foreground">Sign in or create an account to continue</p>
        </div>

        <Tabs defaultValue="signup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="signin">Sign In</TabsTrigger>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="coolcreator"
                  value={usernameValue}
                  onChange={(e) => setUsernameValue(e.target.value.replace(/\s/g, ""))}
                />
                {usernameStatus === "checking" && (
                  <p className="text-xs text-muted-foreground">Checking availability…</p>
                )}
                {usernameStatus === "taken" && (
                  <p className="text-xs text-destructive">Username is already taken</p>
                )}
                {usernameStatus === "available" && (
                  <p className="text-xs text-green-600">Username is available!</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" name="signup-email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" name="signup-password" type="password" placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || usernameStatus === "taken"}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                Continue with Google
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input id="signin-email" name="signin-email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input id="signin-password" name="signin-password" type="password" placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-muted-foreground"
                onClick={() => {
                  const email = (document.getElementById('signin-email') as HTMLInputElement)?.value;
                  if (email) {
                    handleForgotPassword(email);
                  } else {
                    toast({ title: "Email required", description: "Please enter your email address first.", variant: "destructive" });
                  }
                }}
                disabled={loading}
              >
                Forgot password?
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                Continue with Google
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;
