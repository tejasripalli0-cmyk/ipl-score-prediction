/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F7FA",
        ink: "#16222F",
        navy: { DEFAULT: "#0F2A4A", 700: "#173B66", 600: "#1F4D82", 50: "#EAF0F7", 100: "#D5E1EF" },
        teal: { DEFAULT: "#0F7C82", 700: "#0B6368", 600: "#12908E", 50: "#E6F4F4", 100: "#C8E6E6" },
        pitch: { DEFAULT: "#2F7D4F", 50: "#E9F4EE" },
        amber: { DEFAULT: "#B7791F", 50: "#FBF3E3" },
        brick: { DEFAULT: "#B63D32", 50: "#FBEBE9" },
        line: "#E2E8EF",
        muted: "#5B6B7C",
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(15,42,74,0.05)", pop: "0 8px 24px rgba(15,42,74,0.12)" },
      borderRadius: { card: "8px" },
    },
  },
  plugins: [],
};
