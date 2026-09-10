import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Sticky bottom bar shown to signed-out visitors on shared pages
 * (profile / post). Offers Sign up + Log in.
 */
export const AuthCTABar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const goAuth = (mode: "signup" | "login") => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/auth?mode=${mode}&redirect=${redirect}`);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="mx-auto max-w-2xl px-4 py-3">
        <p className="text-center text-xs text-muted-foreground mb-2">
          Join Aelixto to follow, like, comment and share.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => goAuth("signup")}
            className="flex-1 rounded-full font-semibold"
          >
            Sign up
          </Button>
          <Button
            onClick={() => goAuth("login")}
            variant="outline"
            className="flex-1 rounded-full font-semibold border-2"
          >
            Log in
          </Button>
        </div>
      </div>
    </div>
  );
};
