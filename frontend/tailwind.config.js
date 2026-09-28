/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class", '[data-theme]'],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text)",
        },
        muted: {
          DEFAULT: "var(--color-surface-2)",
          foreground: "var(--color-text-muted)",
        },
        border: "var(--color-border)",
        primary: {
          DEFAULT: "var(--color-sky)",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "var(--color-evacuation)",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "var(--color-safe)",
          foreground: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        heading: ["var(--font-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
