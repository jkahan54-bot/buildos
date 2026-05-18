import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#F46519", dark: "#C2500E" },
        surface: { DEFAULT: "#0E0E10", card: "#16161A", panel: "#08080A" },
        border: { DEFAULT: "#222226", subtle: "#2D2D32" },
      },
      fontFamily: { sans: ["'Trebuchet MS'", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
