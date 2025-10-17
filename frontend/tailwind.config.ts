import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f2f7ff",
          100: "#e0ecff",
          500: "#1d4ed8",
          600: "#1e40af"
        }
      }
    }
  },
  plugins: []
};

export default config;
