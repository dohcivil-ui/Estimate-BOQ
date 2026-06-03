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
          base: '#F6F4EF',
          panel: '#FFFFFF',
          raised: '#FAF7F1',
          hover: '#F0EBE0',
          border: '#E8E3D9',
        },
        ink: {
          primary: '#2B2B2B',
          secondary: '#6E6E6E',
          muted: '#857F75',
          inverse: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#C0202A',
          hover: '#971820',
          subtle: '#FBE6E7',
        },
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
