/**
 * Print → PDF — ใช้ browser native print
 * UI element ที่ไม่ใช่ BOQ ถูกซ่อนด้วย @media print CSS (ดู index.css)
 *
 * เพิ่ม class "printing" บน document.body ระหว่าง print เผื่อมี dynamic styles
 */
export function printBOQ(): void {
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 1000);
  }, 50);
}
