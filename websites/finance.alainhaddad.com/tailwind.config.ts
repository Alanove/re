import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        card: "var(--card)",
        ink: "var(--ink)",
        "on-ink": "var(--on-ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        ok: {
          DEFAULT: "var(--ok)",
          text: "var(--ok-text)",
        },
        short: {
          DEFAULT: "var(--short)",
          text: "var(--short-text)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
} satisfies Config;
