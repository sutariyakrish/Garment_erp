/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        // Primary Deep Indigo palette (from Stitch design system)
        brand: {
          50:  '#e8eaf6',
          100: '#c5cae9',
          200: '#9fa8da',
          300: '#7986cb',
          400: '#5c6bc0',
          500: '#3949ab',   // secondary indigo — accent
          600: '#1a237e',   // primary container / sidebar
          700: '#000d70',
          800: '#000666',   // primary
          900: '#000454',
          950: '#000232',
        },
        // Surface/background grays
        surface: {
          DEFAULT: '#f8f9fb',
          dim:     '#d8dadc',
          bright:  '#f8f9fb',
          low:     '#f2f4f6',
          base:    '#eceef0',
          high:    '#e6e8ea',
          highest: '#e0e3e5',
        },
        // On-surface text
        ink: {
          DEFAULT: '#191c1e',
          soft:    '#454652',
          outline: '#767683',
          faint:   '#c6c5d4',
        },
      },
      boxShadow: {
        'indigo-sm': '0 1px 3px 0 rgba(26,35,126,0.10), 0 1px 2px -1px rgba(26,35,126,0.06)',
        'indigo-md': '0 4px 24px 0 rgba(26,35,126,0.08)',
        'indigo-lg': '0 8px 40px 0 rgba(26,35,126,0.12)',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}
