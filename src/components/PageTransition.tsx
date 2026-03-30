import { motion } from "framer-motion";
import { ReactNode, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

// Define route order from left to right (based on bottom nav)
const routeOrder = ["/", "/discover", "/notifications", "/profile", "/messages", "/saved", "/settings"];

// Store previous route index globally
let previousRouteIndex = 0;

const getRouteIndex = (pathname: string): number => {
  // Handle dynamic routes
  if (pathname.startsWith("/u/")) return 4; // User profiles after main nav
  if (pathname.startsWith("/post/")) return 4;
  if (pathname.startsWith("/conversation/")) return 5;
  
  const index = routeOrder.indexOf(pathname);
  return index >= 0 ? index : routeOrder.length;
};

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const currentIndex = getRouteIndex(location.pathname);
  const direction = currentIndex >= previousRouteIndex ? 1 : -1;
  
  useEffect(() => {
    previousRouteIndex = currentIndex;
  }, [currentIndex]);

  const pageVariants = {
    initial: {
      opacity: 0,
      x: direction * 30,
      scale: 0.98,
    },
    in: {
      opacity: 1,
      x: 0,
      scale: 1,
    },
    out: {
      opacity: 0,
      scale: 0.98,
    },
  };

  const pageTransition = {
    type: "spring" as const,
    stiffness: 380,
    damping: 35,
    mass: 0.8,
    restDelta: 0.001,
  };

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};
