/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand red — single accent for the whole app, anchored on #E60026 (600)
        // with #b3001e (700) as the dark shade used in the landing-page gradient.
        // The former indigo accent now maps shade-for-shade onto this scale.
        brand: {
          50: '#fff1f4',
          100: '#ffdfe6',
          200: '#ffbecb',
          300: '#ff8fa4',
          400: '#fa4768',
          500: '#f50f3e',
          600: '#E60026',
          700: '#b3001e',
          800: '#8c0018',
          900: '#730014',
        },
        obsidian: {
          50: '#f0f0ff',
          100: '#e4e4ff',
          200: '#c8c8ff',
          300: '#a8a8f8',
          400: '#8686f0',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#3730a3',
          800: '#1e1b72',
          900: '#12132a',
          950: '#0a0b1a',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Merriweather', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
        brand: ['Merriweather', 'Georgia', 'serif'],
        merriweather: ['Merriweather', 'Georgia', 'serif'],
      },
      fontSize: {
        // 16px minimum across the whole site — these small steps are floored to base.
        xs: ['1rem', { lineHeight: '1.4' }],
        sm: ['1rem', { lineHeight: '1.5' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'wave': 'wave 1.4s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { from: { transform: 'translateX(20px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        slideInLeft: { from: { transform: 'translateX(-20px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1.5)' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(230, 0, 38, 0.4)' },
          to: { boxShadow: '0 0 30px rgba(230, 0, 38, 0.8), 0 0 60px rgba(230, 0, 38, 0.3)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
