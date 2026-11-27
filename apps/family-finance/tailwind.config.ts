import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        ok: "var(--ok)",
        short: "var(--short)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 32, 27, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
