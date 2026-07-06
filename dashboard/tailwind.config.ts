import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // dark navy/slate surfaces
        page: "#0a0f1c",
        surface: "#111a2e",
        "surface-2": "#16213a",
        edge: "rgba(255,255,255,0.08)",
        // ink tokens — text never wears series color
        ink: "#f1f5f9",
        "ink-2": "#94a3b8",
        "ink-3": "#64748b",
        grid: "#223047",
        // validated dark-mode series colors (dataviz palette)
        series: "#3987e5",
        accent: "#199e70",
        critical: "#d03b3b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
