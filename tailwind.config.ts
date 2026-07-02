import type { Config } from "tailwindcss";

export default {
  
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-1000px 0",
          },
          "100%": {
            backgroundPosition: "1000px 0",
          },
        },
        "bounce-in": {
          "0%": {
            transform: "translateX(-50%) scale(0)",
            opacity: "0",
          },
          "50%": {
            transform: "translateX(-50%) scale(1.15)",
          },
          "70%": {
            transform: "translateX(-50%) scale(0.9)",
          },
          "100%": {
            transform: "translateX(-50%) scale(1)",
            opacity: "1",
          },
        },
        ripple: {
          "0%": {
            transform: "scale(0)",
            opacity: "0.5",
          },
          "100%": {
            transform: "scale(4)",
            opacity: "0",
          },
        },
        "underline-slide": {
          "0%": {
            transform: "scaleX(0)",
            opacity: "0",
          },
          "100%": {
            transform: "scaleX(1)",
            opacity: "1",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
        "tap-bounce": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.92)" },
          "70%": { transform: "scale(1.03)" },
          "100%": { transform: "scale(1)" },
        },
        "fab-press": {
          "0%":   { transform: "scale(1)",    filter: "brightness(1)" },
          "45%":  { transform: "scale(0.9)",  filter: "brightness(1.3)" },
          "100%": { transform: "scale(1)",    filter: "brightness(1)" },
        },
        "fab-blink": {
          "0%":   { opacity: "0.9", transform: "scale(0.6)" },
          "60%":  { opacity: "0.35", transform: "scale(1.35)" },
          "100%": { opacity: "0",   transform: "scale(1.8)" },
        },
        "fab-flash": {
          "0%":   { opacity: "0" },
          "20%":  { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite linear",
        "bounce-in": "bounce-in 0.5s ease-out both",
        ripple: "ripple 0.6s linear",
        "underline-slide": "underline-slide 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "tap-bounce": "tap-bounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fab-press": "fab-press 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fab-blink": "fab-blink 0.55s ease-out forwards",
        "fab-flash": "fab-flash 0.35s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
