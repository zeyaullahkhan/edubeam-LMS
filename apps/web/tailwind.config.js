/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Edubeam / Valuable Group brand palette (from VEPL logo)
        navy: {
          50:  '#E8EEFA',
          100: '#C5D2F0',
          200: '#8FAADA',
          300: '#5A82C3',
          400: '#2E61AD',
          500: '#0076BC',
          600: '#003087',   // primary brand navy
          700: '#001f5b',
          800: '#001240',
          900: '#000C2B',
        },
        sky: {
          50:  '#E0F4FA',
          100: '#A8DCEF',
          200: '#7DCBE3',
          300: '#5BBCD8',   // brand sky — accent/active
          400: '#3AAAC5',
          500: '#2898B2',
          600: '#1B7A90',
        },
        // Keep brand as an alias pointing to the Edubeam palette
        brand: {
          50:  '#E0F4FA',
          100: '#A8DCEF',
          200: '#5BBCD8',
          300: '#0076BC',
          400: '#005BAA',
          500: '#0076BC',
          600: '#003087',
          700: '#001f5b',
          800: '#001240',
          900: '#000C2B',
        },
        red: {
          50:  '#FEE9E9',
          100: '#FCC5C5',
          200: '#F88C8C',
          300: '#F05050',
          400: '#E02020',
          500: '#CC2020',   // brand red / CTA
          600: '#A81818',
          700: '#8A1010',
        },
      },
      backgroundImage: {
        'grad-navy': 'linear-gradient(135deg, #001240 0%, #003087 55%, #005BAA 100%)',
        'grad-sky':  'linear-gradient(135deg, #5BBCD8, #3AAAC5)',
        'grad-blue': 'linear-gradient(135deg, #003087, #0076BC)',
      },
      boxShadow: {
        'brand-sm': '0 2px 10px rgba(0, 48, 135, 0.10)',
        'brand-md': '0 6px 24px rgba(0, 48, 135, 0.13)',
        'brand-lg': '0 12px 48px rgba(0, 48, 135, 0.18)',
        'sky':      '0 6px 24px rgba(91, 188, 216, 0.30)',
      },
    },
  },
  plugins: [],
};
