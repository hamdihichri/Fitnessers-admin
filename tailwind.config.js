/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        secondaryBackground: 'var(--secondaryBackground)',
        tertiary: 'var(--tertiary)',
        primaryText: 'var(--primaryText)',
        secondaryText: 'var(--secondaryText)',
        accentText: 'var(--accentText)',

        bg: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-surface)',
        border: 'var(--border)',
        border2: 'var(--tertiary)',
        blue: 'var(--secondary)',
        'blue-h': 'var(--accent-blue-h)',
        active: 'var(--secondary)',
        emerald: '#10B981',
        amber: '#F59E0B',
        danger: '#EF4444',
        purple: '#8B5CF6',
        ink: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        muted2: 'var(--text-muted)',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: { DEFAULT: '8px', lg: '12px', xl: '16px', '2xl': '20px' },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4)',
        modal: '0 24px 64px rgba(0,0,0,0.6)',
      }
    }
  },
  plugins: []
}
