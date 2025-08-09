/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        urbanist: ["Urbanist", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
        sans: ["Inter", "Urbanist", "sans-serif"],
      },
      colors: {
        // Custom color palette from Bankco template
        darkblack: {
          300: "#747681",
          400: "#2A313C", 
          500: "#23262B",
          600: "#1D1E24",
          700: "#151515",
        },
        success: {
          50: "#D9FBE6",
          100: "#B7FFD1", 
          200: "#4ADE80",
          300: "#22C55E",
          400: "#16A34A",
        },
        warning: {
          100: "#FDE047",
          200: "#FACC15", 
          300: "#EAB308",
        },
        error: {
          50: "#FCDEDE",
          100: "#FF7171",
          200: "#FF4747", 
          300: "#DD3333",
        },
        bgray: {
          50: "#FAFAFA",
          100: "#F7FAFC",
          200: "#EDF2F7",
          300: "#E2E8F0", 
          400: "#CBD5E0",
          500: "#A0AEC0",
          600: "#718096",
          700: "#4A5568",
          800: "#2D3748",
          900: "#1A202C",
        },
        // Primary colors for Ygri CRM
        primary: "#22C55E", // Green from template
        secondary: {
          100: "#F2F6FF",
          200: "#D8E3F8", 
          300: "#74787B",
          400: "#363B46",
        },
        // Additional accent colors
        orange: "#FF784B",
        purple: "#936DFF",
        bamber: {
          50: "#FFFBEB",
          100: "#FFC837",
          500: "#F6A723", 
        },
      },
      fontSize: {
        xs: "12px",
        sm: "14px", 
        base: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "28px",
        "4xl": "32px",
        "5xl": "48px",
      },
      lineHeight: {
        "extra-loose": "44.8px",
        "big-loose": "140%", 
        130: "130%",
        150: "150%",
        160: "160%",
        175: "175%",
        180: "180%",
        200: "200%",
        220: "220%",
      },
      borderRadius: {
        20: "20px",
      },
      letterSpacing: {
        tight: "-0.96px",
        40: "-0.4px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
}