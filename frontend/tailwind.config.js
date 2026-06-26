/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0f19',      // Глубокий космический черный
        darkCard: '#151c2c',    // Темная карточка
        neonPurple: '#a855f7',  // Неоновый фиолетовый
        neonGreen: '#22c55e',   // Неоновый зеленый
        neonCyan: '#06b6d4',    // Неоновый голубой
        neonRed: '#ef4444',     // Неоновый красный
        gold: '#fbbf24',        // Золотой для редких дропов
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        neonPurple: '0 0 15px rgba(168, 85, 247, 0.4)',
        neonGreen: '0 0 15px rgba(34, 197, 94, 0.4)',
        neonCyan: '0 0 15px rgba(6, 182, 212, 0.4)',
      }
    },
  },
  plugins: [],
}
