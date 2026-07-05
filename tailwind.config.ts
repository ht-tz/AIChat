import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0A0B14",
          surface: "#11131F",
          card: "#161827",
          border: "#22253A",
          cyan: "#00F0FF",
          purple: "#B14EFF",
          magenta: "#FF2E97",
          lime: "#39FF88",
          amber: "#FFB627",
          danger: "#FF3B5C",
          text: "#E6E8F2",
          muted: "#8A8FA3",
          light: {
            bg: "#F8FAFC",
            surface: "#FFFFFF",
            card: "#F1F5F9",
            border: "#E2E8F0",
            text: "#1E293B",
            muted: "#64748B",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-space)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-jet)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        neon: "0 0 12px rgba(0,240,255,.35), 0 0 32px rgba(0,240,255,.12)",
        "neon-purple": "0 0 12px rgba(177,78,255,.35), 0 0 32px rgba(177,78,255,.12)",
        "neon-magenta": "0 0 12px rgba(255,46,151,.35), 0 0 32px rgba(255,46,151,.12)",
        "neon-lime": "0 0 12px rgba(57,255,136,.35), 0 0 32px rgba(57,255,136,.12)",
      },
      backgroundImage: {
        "scan-lines":
          "repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 3px)",
        "grid-neon":
          "linear-gradient(rgba(0,240,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,.07) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
      keyframes: {
        "pulse-neon": {
          "0%,100%": { opacity: "1", filter: "drop-shadow(0 0 4px currentColor)" },
          "50%": { opacity: ".65", filter: "drop-shadow(0 0 10px currentColor)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
      },
      animation: {
        "pulse-neon": "pulse-neon 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
