/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#060b0b',      // Глубокий изумрудно-черный
        darkCard: '#0d1715',    // Темная изумрудная карточка
        neonPurple: '#10b981',  // Изумрудный акцент
        neonGreen: '#22c55e',   // Неоновый зеленый
        neonCyan: '#fbbf24',    // Золотой акцент (Avarice)
        neonRed: '#ef4444',     // Неоновый красный
        gold: '#fbbf24',        // Золотой для редких дропов
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        neonPurple: '0 0 15px rgba(16, 185, 129, 0.4)',
        neonGreen: '0 0 15px rgba(34, 197, 94, 0.4)',
        neonCyan: '0 0 15px rgba(251, 191, 36, 0.4)',
      }
    },
  },
  plugins: [],
}
