import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#f97316", dark: "#ea580c" },
        // Light theme — surface = white/light gray
        surface: {
          DEFAULT: "#ffffff",
          card:    "#f9fafb",
          panel:   "#f3f4f6",
        },
        border: {
          DEFAULT: "#e5e7eb",
          subtle:  "#f3f4f6",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
