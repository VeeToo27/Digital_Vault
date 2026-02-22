import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui'],
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'system-ui'],
      },
      colors: {
        bg:      '#080b14',
        surface: '#0f1623',
        card:    '#141c2e',
        border:  '#1e2d45',
        muted:   '#2a3f5f',
        text:    '#e2eaff',
        soft:    '#7a90b8',
        accent:  '#4f7fff',
        violet:  '#7c5cfc',
        green:   '#22c55e',
        amber:   '#f59e0b',
        red:     '#ef4444',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease both',
        'slide-up':   'slideUp 0.35s ease both',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                    to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
export default config
