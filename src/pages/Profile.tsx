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
        <p className="text-muted-foreground">Loading...</p>
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
