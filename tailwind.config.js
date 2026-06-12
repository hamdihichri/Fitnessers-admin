/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#151C2C',
        surface:  '#1A2235',
        card:     '#1E2A3B',
        border:   '#243047',
        border2:  '#2E3D56',
        blue:     '#4F6BF4',
        'blue-h': '#6B83F6',
        active:   '#2D3FBF',
        emerald:  '#10B981',
        amber:    '#F59E0B',
        danger:   '#EF4444',
        purple:   '#8B5CF6',
        ink:      '#E4EBF5',
        muted:    '#64748B',
        muted2:   '#8FA3BF',
      },
      fontFamily: {
        sans:  ['var(--font-jakarta)','sans-serif'],
        mono:  ['var(--font-mono)','monospace'],
      },
      borderRadius: { DEFAULT:'8px', lg:'12px', xl:'16px', '2xl':'20px' },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.4)',
        modal: '0 24px 64px rgba(0,0,0,0.6)',
      }
    }
  },
  plugins: []
}
