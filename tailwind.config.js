/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: "hsl(var(--emerald-50) / <alpha-value>)",
          100: "hsl(var(--emerald-100) / <alpha-value>)",
          200: "hsl(var(--emerald-200) / <alpha-value>)",
          300: "hsl(var(--emerald-300) / <alpha-value>)",
          400: "hsl(var(--emerald-400) / <alpha-value>)",
          500: "hsl(var(--emerald-500) / <alpha-value>)",
          600: "hsl(var(--emerald-600) / <alpha-value>)",
          700: "hsl(var(--emerald-700) / <alpha-value>)",
          800: "hsl(var(--emerald-800) / <alpha-value>)",
          900: "hsl(var(--emerald-900) / <alpha-value>)",
          950: "hsl(var(--emerald-950) / <alpha-value>)"
        },
        felt: {
          50: "hsl(var(--felt-50) / <alpha-value>)",
          100: "hsl(var(--felt-100) / <alpha-value>)",
          200: "hsl(var(--felt-200) / <alpha-value>)",
          300: "hsl(var(--felt-300) / <alpha-value>)",
          400: "hsl(var(--felt-400) / <alpha-value>)",
          500: "hsl(var(--felt-500) / <alpha-value>)",
          600: "hsl(var(--felt-600) / <alpha-value>)",
          700: "hsl(var(--felt-700) / <alpha-value>)",
          800: "hsl(var(--felt-800) / <alpha-value>)",
          900: "hsl(var(--felt-900) / <alpha-value>)",
          950: "hsl(var(--felt-950) / <alpha-value>)"
        },
        gold: {
          50: "hsl(var(--gold-50) / <alpha-value>)",
          100: "hsl(var(--gold-100) / <alpha-value>)",
          200: "hsl(var(--gold-200) / <alpha-value>)",
          300: "hsl(var(--gold-300) / <alpha-value>)",
          400: "hsl(var(--gold-400) / <alpha-value>)",
          500: "hsl(var(--gold-500) / <alpha-value>)",
          600: "hsl(var(--gold-600) / <alpha-value>)",
          700: "hsl(var(--gold-700) / <alpha-value>)",
          800: "hsl(var(--gold-800) / <alpha-value>)",
          900: "hsl(var(--gold-900) / <alpha-value>)",
          950: "hsl(var(--gold-950) / <alpha-value>)"
        },
        ink: {
          50: "hsl(var(--ink-50) / <alpha-value>)",
          100: "hsl(var(--ink-100) / <alpha-value>)",
          200: "hsl(var(--ink-200) / <alpha-value>)",
          300: "hsl(var(--ink-300) / <alpha-value>)",
          400: "hsl(var(--ink-400) / <alpha-value>)",
          500: "hsl(var(--ink-500) / <alpha-value>)",
          600: "hsl(var(--ink-600) / <alpha-value>)",
          700: "hsl(var(--ink-700) / <alpha-value>)",
          800: "hsl(var(--ink-800) / <alpha-value>)",
          900: "hsl(var(--ink-900) / <alpha-value>)",
          950: "hsl(var(--ink-950) / <alpha-value>)"
        }
      }
    }
  },
  plugins: []
};
