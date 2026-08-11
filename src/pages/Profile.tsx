import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSession } from "@/hooks/useSession";

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useCurrentProfile();

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!sessionLoading && !user) {
      navigate("/auth");
      return;
    }

    // Redirect to user profile page once profile loads
    if (!profileLoading && profile) {
      navigate(`/u/${profile.username}`);
    }
  }, [user, profile, sessionLoading, profileLoading, navigate]);

  if (sessionLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-24 w-24 bg-muted rounded-full mx-auto animate-shimmer" />
          <div className="h-4 w-32 bg-muted rounded-md mx-auto animate-shimmer" />
          <div className="h-3 w-24 bg-muted rounded-md mx-auto animate-shimmer" />
        </div>
      </div>
    );
  }

  // This will redirect, but show loading state meanwhile
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
};

export default Profile;
