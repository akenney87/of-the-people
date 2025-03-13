// File: tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000", // Black for main background and card
        "box-gray": "#111827", // Gray-900 for other boxes
        "input-gray": "#1f2937", // Gray-800 for inputs
        "text-primary": "#ffffff", // White text
        "text-placeholder": "#9ca3af", // Gray-400 for placeholders
        "link-primary": "#3b82f6", // Blue-500 for links
        "link-hover": "#f3f4f6", // Very light gray (gray-100) for navbar hover
        primary: "#ffffff", // White for general buttons
        "primary-hover": "#e5e7eb", // Gray-200 for white button hover
        yes: "#10b981", // Green-500 for voting yes
        "yes-hover": "#059669", // Green-600 for yes hover
        no: "#ef4444", // Red-500 for voting no/logout/delete
        "no-hover": "#dc2626", // Red-600 for no hover
        error: "#ef4444", // Red-500 for error text
        success: "#10b981", // Green-500 for success text
        "hover-dark": "#0A0A0A", // Almost black, very subtle difference
      },
      spacing: {
        xxs: "0.125rem", // 2px (new for tighter spacing)
        xs: "0.25rem", // 4px
        sm: "0.5rem", // 8px
        md: "1rem", // 16px
        lg: "2rem", // 32px
        xl: "3rem", // 48px
      },
      fontFamily: {
        sf: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Fira Sans",
          "Droid Sans",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      width: {
        card: "32rem",
        "input-wide": "16rem", // Wider input width
      },
      fontSize: {
        "message": "1.125rem", // 18px
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true, // This is important for resetting browser styles
  },
  safelist: [],
};