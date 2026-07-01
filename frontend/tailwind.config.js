/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Class strategy: a `dark` class on <html> flips every `dark:` variant.
  // The class is set by ThemeContext (and pre-set by an inline script in
  // index.html to avoid a light flash before React mounts).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand pumpkin-orange — single accent for the whole app, anchored on #E2611B (600)
        // with #bc4d14 (700) as the dark shade used in the landing-page gradient.
        // The accent maps shade-for-shade onto this scale.
        brand: {
          50: '#fdf4ee',
          100: '#fbe6d6',
          200: '#f6cbab',
          300: '#efa878',
          400: '#e9854a',
          500: '#e56f2d',
          600: '#E2611B',
          700: '#bc4d14',
          800: '#963d14',
          900: '#793314',
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
          from: { boxShadow: '0 0 10px rgba(226, 97, 27, 0.4)' },
          to: { boxShadow: '0 0 30px rgba(226, 97, 27, 0.8), 0 0 60px rgba(226, 97, 27, 0.3)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
