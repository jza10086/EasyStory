/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          500: '#4361ee',
          600: '#3a56d4',
          700: '#2b44b8',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
