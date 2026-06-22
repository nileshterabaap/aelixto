import { useLocation, matchPath } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { triggerCreatePost } from "@/hooks/useCreatePostTrigger";

// Routes that should display the bottom navigation.
// Kept identical to the previous per-page placements so behaviour is unchanged.
const NAV_ROUTES = [
  "/",
  "/discover",
  "/notifications",
  "/messages",
  "/saved",
  "/profile",
  "/u/:username",
  "/settings",
  "/edit-profile",
];

/**
 * A single BottomNav instance mounted above <PageTransition> so it never
 * unmounts (and never flickers / blinks) when the user taps a nav button.
 * Pages still own their CreatePostDialog and subscribe via
 * useCreatePostTrigger().
 */
export const PersistentBottomNav = () => {
  const location = useLocation();
  const show = NAV_ROUTES.some((p) => matchPath(p, location.pathname));
  if (!show) return null;
  return <BottomNav onCreatePost={triggerCreatePost} />;
};