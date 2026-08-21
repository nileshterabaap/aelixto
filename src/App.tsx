import { useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { preloadEmbedSDKs } from "@/lib/ScriptLoader";
import { prefetchCoreData } from "@/lib/prefetch";
import { useGlobalMediaPauseOnNavigate } from "@/hooks/useMediaPauseOnScroll";
import { useRealtimeInvalidations } from "@/hooks/useRealtimeInvalidations";
import { PageTransition } from "@/components/PageTransition";
import { KeepAliveRoutes } from "@/components/KeepAliveRoutes";
import { PersistentBottomNav } from "@/components/PersistentBottomNav";
import { persistOptions } from "@/lib/queryPersister";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import PostDetail from "./pages/PostDetail";
import Settings from "./pages/Settings";
import EditProfile from "./pages/EditProfile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SavedPosts from "./pages/SavedPosts";
import InteractionSettings from "./pages/InteractionSettings";
import PrivacySettings from "./pages/PrivacySettings";
import NotificationSettings from "./pages/NotificationSettings";
import ThreadsVideoDiagnostic from "./pages/ThreadsVideoDiagnostic";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ChildSafety from "./pages/ChildSafety";
import AuthBridge from "./pages/AuthBridge";
import Unsubscribe from "./pages/Unsubscribe";
import ShortLinkRedirect from "./pages/ShortLinkRedirect";

// Configure QueryClient with aggressive caching for instant navigation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 14 * 24 * 60 * 60 * 1000, // 14 days - matches persisted maxAge
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1, // Fast fail, don't retry multiple times
    },
  },
});

// Preload embed SDKs and core data immediately
preloadEmbedSDKs();
prefetchCoreData(queryClient);

const AnimatedRoutes = () => {
  const location = useLocation();
  useGlobalMediaPauseOnNavigate();
  useRealtimeInvalidations();
  
  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);
  
  // Define routes to keep alive (won't unmount when navigating away)
  // Supports dynamic routes - each unique path gets its own cached instance
  const keepAliveRoutes = useMemo(() => [
    { 
      pattern: "/", 
      element: () => <Index /> 
    },
    { 
      pattern: "/u/:username", 
      // Extract username from path for the KeepAlive version
      element: (path: string) => {
        const raw = path.split('/u/')[1] ?? '';
        let username = raw;
        try { username = decodeURIComponent(raw); } catch {}
        return <UserProfile key={path} usernameOverride={username} />;
      }
    }
  ], []);
  
  return (
    <>
      {/* Keep-alive routes stay mounted, hidden with display:none */}
      <KeepAliveRoutes keepAliveRoutes={keepAliveRoutes}>
        {/* Non-keep-alive routes render here with animations */}
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/discover" element={<PageTransition><Discover /></PageTransition>} />
            <Route path="/notifications" element={<PageTransition><Notifications /></PageTransition>} />
            <Route path="/messages" element={<PageTransition><Messages /></PageTransition>} />
            <Route path="/conversation/:conversationId" element={<PageTransition><Conversation /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
            <Route path="/post/:postId" element={<PageTransition><PostDetail /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
            <Route path="/settings/interactions" element={<PageTransition><InteractionSettings /></PageTransition>} />
            <Route path="/settings/privacy" element={<PageTransition><PrivacySettings /></PageTransition>} />
            <Route path="/settings/threads-diagnostic" element={<PageTransition><ThreadsVideoDiagnostic /></PageTransition>} />
            <Route path="/settings/notifications" element={<PageTransition><NotificationSettings /></PageTransition>} />
            <Route path="/edit-profile" element={<PageTransition><EditProfile /></PageTransition>} />
            <Route path="/saved" element={<PageTransition><SavedPosts /></PageTransition>} />
            <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsOfService /></PageTransition>} />
            <Route path="/child-safety" element={<PageTransition><ChildSafety /></PageTransition>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            {/* Short-link redirect */}
            <Route path="/s/:code" element={<ShortLinkRedirect />} />
            {/* Native OAuth bridge — converts web redirect into a custom-scheme deep link */}
            <Route path="/~auth-bridge" element={<AuthBridge />} />
            {/* Username vanity route — must stay just above the catch-all */}
            <Route path="/:username" element={<PageTransition><UserProfile /></PageTransition>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </KeepAliveRoutes>
      {/* Persistent navigation — lives OUTSIDE PageTransition so it
          stays mounted across route changes and never flickers. */}
      <PersistentBottomNav />
    </>
  );
};

const App = () => (
  <PersistQueryClientProvider 
    client={queryClient} 
    persistOptions={persistOptions}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
