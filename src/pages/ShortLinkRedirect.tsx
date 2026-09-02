import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!code) {
        setNotFound(true);
        return;
      }
      const { data, error } = await supabase
        .from("short_links")
        .select("target_path")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data?.target_path) {
        setNotFound(true);
        return;
      }
      navigate(data.target_path, { replace: true });
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  if (notFound) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">This link is invalid or has expired.</p>
          <button
            className="text-primary underline text-sm"
            onClick={() => navigate("/", { replace: true })}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Opening link…</p>
    </div>
  );
};

export default ShortLinkRedirect;
