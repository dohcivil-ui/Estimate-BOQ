/**
 * AI Prompt Presets — สำหรับ Phase B (editable prompt + preset dropdown)
 *
 * แนวคิด:
 *   - system prompt (กฎ 1-15) อยู่ใน aiPrompts.ts → inject อัตโนมัติทุก mode
 *   - preset = "user message เริ่มต้น" ที่เติมลง textarea → user แก้ต่อได้
 *   - preset เตือน AI ถึงกฎสำคัญเฉพาะหมวด + ช่อง [หน้า] ให้ user กรอก
 *
 * การใช้:
 *   - เลือก preset → เติม prompt ลง textarea (replace ค่าเดิม)
 *   - user แก้ [หน้าหลัก]/[อ้างอิง] + เพิ่มคำสั่งพิเศษได้
 *   - กด "วิเคราะห์" → ส่ง prompt นี้ + PDF page (document type)
 */
import type { AIEngine } from './aiEngines';
import type { AIMode } from '@/types/ai';

export interface PromptPreset {
  id: string;
  label: string;
  icon: string;
  /** mode ที่ map ไป system prompt (aiPrompts.ts) */
  mode: AIMode;
  /** engine แนะนำ — default Opus เพราะแม่นสุดกับงานอ่านแบบ */
  defaultEngine: AIEngine;
  /** prompt เริ่มต้น (user แก้ได้) */
  prompt: string;
}

/** placeholder ที่ user ต้องแทนที่ — UI highlight ได้ */
export const PLACEHOLDER_MAIN = '[หน้าหลัก]';
export const PLACEHOLDER_REF = '[อ้างอิง]';

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'structural',
    label: 'โครงสร้าง',
    icon: '🏗️',
    mode: 'structural',
    defaultEngine: 'anthropic-opus',
    prompt: `ถอดปริมาณงานโครงสร้าง หน้า ${PLACEHOLDER_MAIN} อ้างอิง ${PLACEHOLDER_REF}`,
  },
  {
    id: 'architectural',
    label: 'สถาปัตยกรรม',
    icon: '🏛️',
    mode: 'architectural',
    defaultEngine: 'anthropic-opus',
    prompt: `ถอดปริมาณงานสถาปัตยกรรม หน้า ${PLACEHOLDER_MAIN} อ้างอิง ${PLACEHOLDER_REF}`,
  },
  {
    id: 'electrical',
    label: 'ไฟฟ้า',
    icon: '⚡',
    mode: 'electrical',
    defaultEngine: 'anthropic-opus',
    prompt: `ถอดปริมาณงานไฟฟ้า หน้า ${PLACEHOLDER_MAIN} อ้างอิง ${PLACEHOLDER_REF}`,
  },
  {
    id: 'sanitary',
    label: 'สุขาภิบาล',
    icon: '🚰',
    mode: 'sanitary',
    defaultEngine: 'anthropic-opus',
    prompt: `ถอดปริมาณงานสุขาภิบาล หน้า ${PLACEHOLDER_MAIN} อ้างอิง ${PLACEHOLDER_REF}`,
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '✏️',
    mode: 'auto',
    defaultEngine: 'anthropic-opus',
    prompt: `ถอดปริมาณ หน้า ${PLACEHOLDER_MAIN} อ้างอิง ${PLACEHOLDER_REF}

(พิมพ์คำสั่งของคุณที่นี่ — เช่น เน้นเฉพาะฐานราก, ถอดเฉพาะคาน, ตรวจสอบจำนวน F2)`,
  },
];

/** หา preset จาก id */
export function getPreset(id: string): PromptPreset | undefined {
  return PROMPT_PRESETS.find((p) => p.id === id);
}

/** preset เริ่มต้น (โครงสร้าง) */
export const DEFAULT_PRESET = PROMPT_PRESETS[0];

/**
 * เติมเลขหน้าลง prompt — แทนที่ placeholder
 * @param prompt prompt จาก preset
 * @param mainPage เลขหน้าหลัก (เช่น "17")
 * @param refPages หน้าอ้างอิง (เช่น "15,16,18,19")
 */
export function fillPagePlaceholders(
  prompt: string,
  mainPage: string,
  refPages: string,
): string {
  return prompt
    .replace(PLACEHOLDER_MAIN, mainPage || PLACEHOLDER_MAIN)
    .replace(PLACEHOLDER_REF, refPages || PLACEHOLDER_REF);
}
