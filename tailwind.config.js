/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        uniswap: {
          pink: '#FF007A',
          blue: '#2172E5',
        }
      }
    },
  },
  plugins: [],
}