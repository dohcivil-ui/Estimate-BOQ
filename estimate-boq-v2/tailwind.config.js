/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ธีมเข้มแนว doh-thai.com — navy primary + gold accent
        bg: {
          base: '#0b1220',
          panel: '#0f172a',
          raised: '#111c2e',
          hover: '#1a2640',
          border: '#1f2c44',
        },
        ink: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#64748b',
          inverse: '#0f172a',
        },
        // primary = navy หลัก (doh-thai)
        primary: {
          DEFAULT: '#1e3a5f',
          hover: '#2a4d7a',
          subtle: '#16293f',
        },
        // accent = ทอง (doh-thai)
        accent: {
          DEFAULT: '#c9a227',
          hover: '#b08d1f',
          subtle: '#3d3415',
        },
        // สีเครื่องมือวัดบน canvas
        measure: '#8b5cf6', // ม่วง — ความยาว
        area: '#06b6d4', // ฟ้าน้ำเงิน — พื้นที่
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
