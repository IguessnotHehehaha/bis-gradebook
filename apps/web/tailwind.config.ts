import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const color = (name: string) => `hsl(var(--${name}))`;
const surface = (name: string) => ({
  DEFAULT: color(name),
  foreground: color(`${name}-foreground`),
});

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  // Keep the existing application reset and form styles.
  corePlugins: { preflight: false },
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: color("border"),
        input: color("input"),
        ring: color("ring"),
        background: color("background"),
        foreground: color("foreground"),
        primary: surface("primary"),
        secondary: surface("secondary"),
        destructive: surface("destructive"),
        muted: surface("muted"),
        accent: surface("accent"),
        popover: surface("popover"),
        card: surface("card"),
        sidebar: {
          DEFAULT: color("sidebar-background"),
          foreground: color("sidebar-foreground"),
          primary: color("sidebar-primary"),
          "primary-foreground": color("sidebar-primary-foreground"),
          accent: color("sidebar-accent"),
          "accent-foreground": color("sidebar-accent-foreground"),
          border: color("sidebar-border"),
          ring: color("sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
