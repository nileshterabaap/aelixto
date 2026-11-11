import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IOS_STORE_URL } from "@/lib/forceUpdate";
import { inviteStoreUrl, inviteUrl } from "@/lib/inviteReferral";
import { isValidUsername } from "@/lib/usernameRules";
import { Button } from "@/components/ui/button";
import hero from "@/assets/aelixto-launch-hero.jpg";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Launch() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const incomingRef = new URLSearchParams(window.location.search).get("ref");
  const ref = incomingRef && isValidUsername(incomingRef) ? incomingRef : null;
  useEffect(() => {
    document.title = "Aelixto — Every feed, one place";
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex";
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!EMAIL_RE.test(v) || v.length > 255) { setState("error"); setMsg("Please enter a valid email."); return; }
    setState("saving");
    const { error } = await supabase.from("ios_waitlist").insert({ email: v });
    if (error && error.code !== "23505") { setState("error"); setMsg("Something went wrong. Try again."); return; }
    setState("done"); setMsg("You're on the list. We'll email you when Aelixto lands on the App Store.");
  };

  return (
    <main className="min-h-screen bg-background text-foreground overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-14">
        <header className="flex items-center gap-3">
          <img src="/logo.png" alt="Aelixto logo" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">Aelixto</span>
        </header>

        <section className="mt-10 grid min-w-0 items-center gap-10 md:grid-cols-2">
          <div className="min-w-0 break-words">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">One app. Every platform.</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
              All the posts you love, in a single feed.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Share posts from YouTube, Instagram, X, TikTok, Reddit and more. Follow friends, chat, and discover what's fresh — without jumping between apps.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={inviteStoreUrl(ref)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-2xl bg-foreground px-5 py-3 text-background transition-transform active:scale-95">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Zm11.3 11.3 2.4 2.4-11 6.3 8.6-8.7Zm3.6-3.6 2.8 1.6c.8.5.8 1.3 0 1.8l-2.8 1.6-2.6-2.5 2.6-2.5ZM6.3 2.2l11 6.3-2.4 2.4-8.6-8.7Z"/></svg>
                <span className="text-left leading-tight"><span className="block text-xs opacity-80">Available on</span><span className="block text-lg font-semibold">Play Store</span></span>
              </a>
              <div className="inline-flex items-center gap-3 rounded-2xl border border-border px-5 py-3 text-muted-foreground">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z"/></svg>
                <span className="text-left leading-tight"><span className="block text-xs">Coming soon on</span><span className="block text-lg font-semibold">App Store</span></span>
              </div>
            </div>

            {ref && <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold">Invited by @{ref}</p>
              <Button asChild variant="outline"><a href={`com.aelixto.app10://invite?ref=${encodeURIComponent(ref)}`}>Open Aelixto</a></Button>
              <p className="text-sm text-muted-foreground">Already installed? Tap “Open Aelixto” to follow @{ref} automatically when you sign up.</p>
            </div>}

            <form onSubmit={submit} className="mt-8 max-w-md rounded-3xl border border-border bg-card p-5">
              <label htmlFor="waitlist-email" className="text-sm font-semibold">On iPhone? Get notified when we launch.</label>
              {state === "done" ? (
                <p className="mt-3 text-sm text-primary">{msg}</p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input id="waitlist-email" type="email" required maxLength={255} value={email}
                      onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                      placeholder="you@example.com"
                      className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring" />
                    <button type="submit" disabled={state === "saving"}
                      className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
                      {state === "saving" ? "…" : "Notify me"}
                    </button>
                  </div>
                  {state === "error" && <p className="mt-2 text-sm text-destructive">{msg}</p>}
                </>
              )}
            </form>
          </div>

          <img src={hero} alt="Aelixto feed on a phone" className="w-full rounded-3xl object-cover shadow-xl" />
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["One feed", "Posts from every platform, freshest first."],
            ["Real people", "Follow friends, like, repost and chat."],
            ["Aelix Score", "See what's truly getting attention."],
          ].map(([t, d]) => (
            <div key={t} className="min-w-0 rounded-3xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">{t}</h2>
              <p className="mt-2 text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 pb-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Aelixto</footer>
      </div>
    </main>
  );
}
