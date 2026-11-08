/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Bellefair', 'Assistant', 'serif'],
        body: ['Assistant', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
