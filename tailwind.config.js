/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        staff: {
          dark: '#F3E4C9',
          card: '#EDD9B5',
          'card-hover': '#E3CFA3',
          accent: '#BABF94',
          'accent-hover': '#A3A87A',
        },
      },
      textColor: {
        staff: {
          primary: '#5c3a28',
          secondary: '#8a6552',
          muted: '#A98B76',
          accent: '#BABF94',
          dark: '#5c3a28',
        },
      },
      borderColor: {
        staff: {
          accent: '#BABF94',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
