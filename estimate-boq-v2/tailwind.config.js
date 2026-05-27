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
        // ธีมเข้มที่ออกแบบสำหรับงานวิศวกรรม - cool slate base + accent
        // หมายเหตุ: สีเครื่องมือวัดบน canvas (ทอง/ม่วง/ฟ้า) อยู่ใน
        // src/components/canvas/canvasTheme.ts เท่านั้น ไม่ปนกับ accent global
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
        accent: {
          DEFAULT: '#38bdf8',
          hover: '#0ea5e9',
          subtle: '#0c4a6e',
        },
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
