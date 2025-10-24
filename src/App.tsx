import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // CSS: hide Pinterest's floating/hover save overlays (not the card iframe)
    if (!document.getElementById('kill-pinterest-hover-css')) {
      const style = document.createElement('style');
      style.id = 'kill-pinterest-hover-css';
      style.textContent = `
        /* Hide Pinterest hover/floating save chips & anchors */
        a[data-pin-log*="pinit_floating"],
        a[data-pin-log*="hover"],
        .pinit-btn,
        .pinit-button,
        /* Some sites get an overlay iframe for the hover chip */
        iframe[src*="assets.pinterest.com"][src*="pinit"],
        iframe[src*="assets.pinterest.com"][src*="hover"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // MutationObserver: if Pinterest re-injects a hover element, remove it
    const isHoverOverlay = (el: Element) => {
      if (el instanceof HTMLIFrameElement) {
        const src = el.getAttribute('src') || '';
        return src.includes('assets.pinterest.com') &&
               (src.includes('pinit') || src.includes('hover'));
      }
      if (el instanceof HTMLAnchorElement) {
        const log = el.getAttribute('data-pin-log') || '';
        return log.includes('pinit_floating') || log.includes('hover');
      }
      return false;
    };

    const zap = (root: ParentNode) => {
      root.querySelectorAll('a[data-pin-log], iframe[src*="assets.pinterest.com"]').forEach((el) => {
        if (isHoverOverlay(el)) el.remove();
      });
    };

    const obs = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (!(n instanceof Element)) return;
          if (isHoverOverlay(n)) n.remove();
          else zap(n);
        });
      });
    });

    zap(document.body);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => obs.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
