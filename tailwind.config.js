/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          bg: '#0A0E1A',
          secondary: '#0F1628',
          accent: '#1A56FF',
          purple: '#7B2FFF',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#8B9AB2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7B2FFF, #1A56FF)',
        'gradient-hero': 'linear-gradient(135deg, #0A0E1A 0%, #1A1F3A 50%, #2A1F4A 100%)',
        'gradient-section': 'linear-gradient(180deg, #0A0E1A 0%, #0F1628 100%)',
        'gradient-section-alt': 'linear-gradient(180deg, #0F1628 0%, #0A0E1A 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
