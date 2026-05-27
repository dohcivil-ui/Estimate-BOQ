/**
 * ส่งออกค่าวัด/BOQ → text ไปให้ Custom GPT ใช้คำนวณ
 * (ในระหว่าง Step 2.4–2.6 — Step 2.5 จะมี AI ในตัว ผ่าน Edge Function)
 */
import type { Measurement } from '@/types/measurement';
import type { ProjectMeta } from '@/types/boq';

/** สร้างข้อความสรุปสำหรับ paste ใส่ Custom GPT */
export function buildGPTPrompt(
  measurements: Measurement[],
  meta: ProjectMeta,
): string {
  const lines: string[] = [];
  lines.push(`# ข้อมูลโปรเจกต์`);
  lines.push(`- ชื่อ: ${meta.name || '(ไม่ระบุ)'}`);
  if (meta.client) lines.push(`- เจ้าของ: ${meta.client}`);
  if (meta.location) lines.push(`- ที่ตั้ง: ${meta.location}`);
  if (meta.province) lines.push(`- จังหวัด: ${meta.province}`);
  lines.push(
    `- Factor F: ${
      meta.factorF > 0
        ? `${meta.factorF.toFixed(4)} (กำหนดเอง)`
        : 'ตามตาราง Factor F กรมบัญชีกลาง สงป.2567 (คำนวณจากค่างาน)'
    }`,
  );
  lines.push('');

  if (measurements.length === 0) {
    lines.push(`# ค่าวัด`);
    lines.push('(ยังไม่มีค่าวัด)');
  } else {
    lines.push(`# ค่าวัดจากแบบ (${measurements.length} รายการ)`);

    const grouped: Record<string, Measurement[]> = {};
    for (const m of measurements) {
      (grouped[m.type] ??= []).push(m);
    }

    for (const [type, list] of Object.entries(grouped)) {
      lines.push(`\n## ${typeLabel(type as Measurement['type'])} (${list.length} รายการ)`);
      list.forEach((m, idx) => {
        const name = m.name || `#${idx + 1}`;
        if (m.type === 'length') {
          lines.push(`- ${name}: ${m.lengthM.toFixed(2)} ม. (${m.points.length} จุด)`);
        } else if (m.type === 'area') {
          lines.push(
            `- ${name}: ${m.areaM2.toFixed(2)} ตร.ม., เส้นรอบรูป ${m.perimeterM.toFixed(2)} ม.`,
          );
        } else if (m.type === 'count') {
          lines.push(`- ${name}: ${m.count} จุด`);
        } else if (m.type === 'scale') {
          lines.push(`- สเกล: ${m.realDistance} ${m.unit} ≡ ${m.points.length} จุดอ้างอิง`);
        }
      });
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('# คำขอ');
  lines.push(
    'กรุณาวิเคราะห์ค่าวัดด้านบนแล้วถอดเป็น BOQ ตามค่าแรง ว.809 (14 พ.ย. 68) กรมบัญชีกลาง',
  );
  lines.push('ตอบเป็น JSON ตาม format นี้เท่านั้น (ห้ามมีข้อความอื่น):');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        project: meta.name || 'โปรเจกต์',
        factorF: meta.factorF,
        boq: [
          {
            category: 'งานโครงสร้าง',
            name: 'คอนกรีตผสมเสร็จ ชั้นเดียว',
            unit: 'ลบ.ม.',
            rate: 421,
            qty: 0,
            isMat: false,
            waste: 3,
            notes: '',
          },
        ],
      },
      null,
      2,
    ),
  );
  lines.push('```');
  return lines.join('\n');
}

function typeLabel(t: Measurement['type']): string {
  switch (t) {
    case 'length':
      return '📏 ความยาว';
    case 'area':
      return '⬡ พื้นที่';
    case 'count':
      return '🔢 นับจำนวน';
    case 'scale':
      return '📐 สเกล';
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/** สร้าง BOQ items + apply factorF ผ่าน AI import (สลับสีเดือนต่อ store ผู้เรียก) */
