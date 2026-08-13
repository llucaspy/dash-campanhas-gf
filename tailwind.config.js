/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#355CFF",
        border: "#E9EDF5",
        background: "#F5F7FB",
      },
      borderRadius: {
        lg: "18px",
      },
    },
  },
  plugins: [],
}
