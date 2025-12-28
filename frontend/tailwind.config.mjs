/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Base colors
        'dark-bg': '#0a0a0a',
        'dark-surface': '#121212',
        'dark-border': '#1e1e1e',
        
        // Deck orange accent
        'deck-orange': '#ff6e1a',
        
        // Rarity colors (gaming loot system)
        'rarity': {
          'legendary': '#ff8800', // Orange glow - 60%+ discount
          'epic': '#8b5cf6',      // Purple glow - 40-60%
          'rare': '#3b82f6',      // Blue glow - 20-40%
          'common': '#10b981',    // Green - <20%
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-legendary': '0 0 20px rgba(255, 136, 0, 0.3)',
        'glow-epic': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-rare': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-common': '0 0 20px rgba(16, 185, 129, 0.3)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}