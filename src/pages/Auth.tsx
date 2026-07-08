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

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44c-.28 1.4-1.07 2.59-2.29 3.39v2.82h3.71c2.16-2 3.41-4.96 3.41-8.45z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.82c-1.03.69-2.34 1.1-3.92 1.1-3.01 0-5.56-2.03-6.47-4.76H1.99v2.91C3.96 21.3 7.7 24 12 24z"/>
    <path fill="#FBBC05" d="M5.53 14.61c-.23-.69-.36-1.43-.36-2.18s.13-1.49.36-2.18V7.34H1.99C1.27 8.78.86 10.35.86 12s.41 3.22 1.13 4.66l3.54-2.05z"/>
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.29-3.29C17.95 1.36 15.24 0 12 0 7.7 0 3.96 2.7 1.99 6.66l3.54 2.91C6.44 6.78 8.99 4.75 12 4.75z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.42 2.22-1.19 3.02-.82.87-2.17 1.55-3.27 1.46-.14-1.11.43-2.28 1.16-3.03.82-.85 2.24-1.48 3.3-1.45zM20.5 17.14c-.55 1.27-.81 1.83-1.52 2.95-.98 1.55-2.37 3.48-4.09 3.5-1.53.01-1.92-.99-4-.98-2.08.01-2.51 1-4.04.98-1.72-.02-3.03-1.77-4.02-3.32C.09 15.9-.2 10.87 1.62 8.19c1.29-1.9 3.33-3.02 5.24-3.02 1.95 0 3.17 1.07 4.78 1.07 1.56 0 2.51-1.07 4.77-1.07 1.71 0 3.51.93 4.79 2.55-4.21 2.31-3.52 8.33-.7 9.42z"/>
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Hide Apple sign-in on Android. Apple's guidelines require the native
  // Apple sheet on iOS, and non-Apple platforms should not offer this option
  // (matches how other apps behave).
  const showApple =
    !(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameValue, setUsernameValue] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");
  // OTP verification state
  const [otpStep, setOtpStep] = useState<null | { email: string; password: string; username: string }>(null);
  const [otpValue, setOtpValue] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", usernameValue.toLowerCase())
          .maybeSingle();
        if (error) {
          setUsernameStatus("idle");
          return;
        }
        setUsernameStatus(data ? "taken" : "available");
      } catch {
        setUsernameStatus("idle");
      }
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
      const isUnconfirmed = msg.includes("email not confirmed") || msg.includes("not confirmed");
      if (isUnconfirmed) {
        // Trigger OTP resend and switch to verification screen
        const username = email.split("@")[0];
        await supabase.functions.invoke("send-signup-otp", {
          body: { email, username, password, mode: "resend" },
        });
        setOtpStep({ email, password, username });
        setOtpValue("");
        setResendCooldown(30);
        toast({
          title: "Verify your email",
          description: "We sent a 4-digit code to " + email,
        });
        return;
      }
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

    const { data, error } = await supabase.functions.invoke("send-signup-otp", {
      body: { email: email.trim().toLowerCase(), password, username, mode: "signup" },
    });

    setLoading(false);

    if (error || (data && (data as { error?: string }).error)) {
      const msg =
        (data as { error?: string } | null)?.error ||
        (error as { message?: string } | null)?.message ||
        "Could not send verification code.";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
      return;
    }

    setOtpStep({ email: email.trim().toLowerCase(), password, username });
    setOtpValue("");
    setResendCooldown(30);
    toast({ title: "Check your email", description: "We sent a 4-digit code to " + email });
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!otpStep) return;
    if (!/^\d{4}$/.test(otpValue)) {
      toast({ title: "Enter the 4-digit code", description: "Check your email and try again.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-signup-otp", {
      body: { email: otpStep.email, code: otpValue },
    });

    if (error || (data && (data as { error?: string }).error)) {
      setLoading(false);
      const msg =
        (data as { error?: string } | null)?.error ||
        (error as { message?: string } | null)?.message ||
        "Incorrect code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
      return;
    }

    // Code verified — sign the user in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: otpStep.email,
      password: otpStep.password,
    });
    setLoading(false);
    if (signInErr) {
      toast({ title: "Could not sign in", description: signInErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome to Aelixto!", description: "Your account is verified." });
    setOtpStep(null);
  };

  const handleResendOtp = async () => {
    if (!otpStep || resendCooldown > 0) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("send-signup-otp", {
      body: { email: otpStep.email, username: otpStep.username, password: otpStep.password, mode: "resend" },
    });
    setLoading(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast({
        title: "Couldn't resend",
        description: (data as { error?: string } | null)?.error || "Try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setResendCooldown(30);
    toast({ title: "New code sent", description: "Check your inbox." });
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

    // Web flow.
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) {
        console.error("Google sign-in error", result.error);
        toast({
          title: "Google sign-in failed",
          description: result.error.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Google sign-in threw", e);
      toast({
        title: "Google sign-in failed",
        description: (e as Error)?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) {
        toast({
          title: "Apple sign-in failed",
          description: result.error.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Apple sign-in failed",
        description: (e as Error)?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  // While the initial Supabase session probe is running, render nothing so
  // the splash screen (kept alive in main.tsx) covers the wait. Otherwise
  // signed-in users would see the auth form flash for ~1s before the
  // navigate("/") fires.
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(() => {
      if (!cancelled) setSessionChecked(true);
    });
    return () => { cancelled = true; };
  }, []);
  if (!sessionChecked || user) return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-5 overflow-hidden">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Aelixto
          </h1>
        </div>

        <div className="rounded-3xl border border-border/10 bg-card/80 backdrop-blur-xl shadow-[0_20px_60px_-20px_hsl(var(--brand-blue)/0.25)] p-6">
        {otpStep ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Verify your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a 4-digit code to <span className="font-medium text-foreground">{otpStep.email}</span>
              </p>
            </div>
            <Input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              pattern="\d{4}"
              placeholder="••••"
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-3xl tracking-[0.6em] h-16 font-bold"
              required
              autoFocus
            />
            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-semibold shadow-lg"
              disabled={loading || otpValue.length !== 4}
            >
              {loading ? "Verifying..." : "Verify & continue"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                onClick={handleResendOtp}
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-2"
                onClick={() => { setOtpStep(null); setOtpValue(""); }}
                disabled={loading}
              >
                Use different email
              </button>
            </div>
          </form>
        ) : (
        <Tabs
          defaultValue={
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("mode") === "login"
              ? "signin"
              : "signup"
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary p-1 h-12">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="signin">Sign In</TabsTrigger>
          </TabsList>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Username"
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
                <Input id="signup-email" name="signup-email" type="email" placeholder="Email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" name="signup-password" type="password" placeholder="Password" required minLength={6} />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-full text-base font-semibold shadow-lg"
                disabled={loading || usernameStatus === "taken"}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-full text-base font-medium gap-2"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              {showApple && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-full text-base font-medium gap-2 mt-2"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                >
                  <AppleIcon />
                  Continue with Apple
                </Button>
              )}
            </form>
          </TabsContent>

          <TabsContent value="signin" className="mt-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-identifier">Email or username</Label>
                <Input
                  id="signin-identifier"
                  name="signin-identifier"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Email or username"
                  value={signinIdentifier}
                  onChange={(e) => setSigninIdentifier(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input id="signin-password" name="signin-password" type="password" placeholder="Password" required />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-full text-base font-semibold shadow-lg"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-muted-foreground"
                onClick={() => {
                  if (signinIdentifier) {
                    handleForgotPassword(signinIdentifier);
                  } else {
                    toast({ title: "Email required", description: "Please enter your email above first.", variant: "destructive" });
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
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-full text-base font-medium gap-2"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              {showApple && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-full text-base font-medium gap-2 mt-2"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                >
                  <AppleIcon />
                  Continue with Apple
                </Button>
              )}
            </form>
          </TabsContent>
        </Tabs>
        )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground px-4 leading-relaxed">
          By continuing, you agree to Aelixto's{" "}
          <a href="/terms" className="underline underline-offset-2">Terms</a> and{" "}
          <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Auth;
