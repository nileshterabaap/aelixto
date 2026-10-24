import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="screen-nav bg-background">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Support</h1>
        </div>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-lg font-semibold">Contact us</h2>
            <p className="text-muted-foreground">
              Need help with Aelixto, found a problem, or want to report content or an account?
              Email us at{" "}
              <a href="mailto:support@aelixto.com" className="text-primary underline">support@aelixto.com</a>.
              We usually reply within 2 business days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Common questions</h2>
            <div className="space-y-3 text-muted-foreground">
              <p><strong className="text-foreground">How do I add a post?</strong> Tap the + button and paste a link from a supported platform, or share a link to Aelixto from another app.</p>
              <p><strong className="text-foreground">How do I report or block someone?</strong> Open their profile or post, tap the menu, and choose Report or Block.</p>
              <p><strong className="text-foreground">How do I delete my account?</strong> Email us from the address on your account and we will delete it and its data.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Policies</h2>
            <div className="flex flex-col gap-2">
              <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>
              <Link to="/terms" className="text-primary underline">Terms of Service</Link>
              <Link to="/child-safety" className="text-primary underline">Child Safety Standards</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Support;
