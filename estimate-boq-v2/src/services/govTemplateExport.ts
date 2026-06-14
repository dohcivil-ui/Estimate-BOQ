/**
 * govTemplateExport.ts — orchestrator (UI layer): por456 → buildExportData → verify → fill master
 * ─────────────────────────────────────────────────────────────────────────
 * เชื่อม pipeline "เลขล็อก" เข้ากับ template ราชการ (ระบบ B):
 *   buildPor456ViewModel(groups,…).por4
 *     → factorFBracketFor(directCost,…)            (bracket ให้ master interpolate เอง)
 *     → buildExportData({por4, meta, factorF})      → BoqExportData
 *     → verifyBoqInput(data)                        (double-entry — บล็อกถ้ามี error)
 *     → fillBoqTemplate(masterBuffer, data)         (กรอกลง boq-master.xlsx)
 *
 * ไม่แตะ logic ในไฟล์ที่ล็อก (por456/buildExportData/govExcelVerify/govExcelExport ของ export/)
 * — เรียกใช้อย่างเดียว. ตัวนี้เป็นชั้นประกอบ + โหลด master + ดาวน์โหลด เท่านั้น
 *
 * master template: วางที่ public/boq-master.xlsx → โหลด runtime ผ่าน BASE_URL
 */
import type { DisciplineGroup, ProjectMeta } from '@/types/boq';
import { buildPor456ViewModel } from '@/services/compute/por456ViewModel';
import { factorFBracketFor } from '@/core/boqCalc';
import { buildExportData } from '@/services/export/buildExportData';
import {
  verifyBoqInput,
  type VerifyIssue,
} from '@/services/export/govExcelVerify';
import type { BoqExportData } from '@/services/export/govExcelExport';
import JSZip from 'jszip';
// master template ราชการ 7 ชีต (โหลดเป็น asset ผ่าน Vite — เคารพ base path ตอน deploy)
import boqMasterUrl from '@/assets/templates/boq-master-cgd.xlsx?url';

export interface GovTemplatePrep {
  /** พร้อมดาวน์โหลดไหม (ไม่มี error จาก verify และมี bracket Factor F) */
  ok: boolean;
  /** ปัญหาจาก verifyBoqInput (error = บล็อก · warn = เตือน) */
  issues: VerifyIssue[];
  /** คำเตือนจาก buildExportData (UNMAPPED_CGD / EXPORT_RECONCILE / SLOT_OVERFLOW) */
  buildWarnings: string[];
  /** ค่างานต้นทุน (Direct Cost) จาก ปร.4 — ไว้แสดง */
  directCost: number;
  /** data ที่จะกรอกลง master (มีค่าเมื่อสร้างได้) */
  data?: BoqExportData;
  /** ชื่อไฟล์ที่จะดาวน์โหลด */
  fileName: string;
}

export interface GovTemplateInput {
  groups: DisciplineGroup[];
  meta: ProjectMeta;
}

/**
 * เตรียมข้อมูล + ตรวจสอบ (sync, เร็ว — ไม่โหลด master) เพื่อแสดงผลก่อนยืนยันดาวน์โหลด
 */
export function prepareGovTemplateExport(input: GovTemplateInput): GovTemplatePrep {
  const { groups, meta } = input;
  const fileName = `ปร456-${meta.name?.trim() || 'โครงการ'}.xlsx`;

  const vm = buildPor456ViewModel({
    groups,
    factorFOverride: meta.factorF ?? 0,
    advancePct: meta.advancePct ?? 0,
    retentionPct: meta.retentionPct ?? 0,
  });
  const directCost = vm.por4.directCost;

  const bracket = factorFBracketFor(
    directCost,
    meta.advancePct ?? 0,
    meta.retentionPct ?? 0,
  );
  if (!bracket) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'FACTORF_BRACKET_NULL',
          where: 'Factor F',
          msg: `ค่างานต้นทุน ${directCost.toLocaleString()} บาท หาช่วงในตาราง Factor F CGD ไม่ได้ (นอกช่วงตาราง) — ตรวจ advance/retention หรือยอดต้นทุน`,
        },
      ],
      buildWarnings: [],
      directCost,
      fileName,
    };
  }

  const { data, warnings } = buildExportData({
    por4: vm.por4,
    meta: {
      projectName: meta.name ?? '',
      location: meta.location ?? '',
      province: meta.province ?? '',
      agency: meta.client || undefined,
    },
    factorF: bracket,
    conditions: {
      loanInterest: 0.06,
      vat: (meta.vatPct ?? 7) / 100,
      equipmentVat: (meta.vatPct ?? 7) / 100,
    },
  });

  const verify = verifyBoqInput(data, { factorFRule: 'ceil', roundStep: 1000 });

  return {
    ok: verify.ok,
    issues: verify.issues,
    buildWarnings: warnings,
    directCost,
    data,
    fileName,
  };
}

/**
 * ถอด drawings/media/externalLinks ออกจาก master ก่อน load
 * ─────────────────────────────────────────────────────────────────────────
 * ExcelJS 4.4.0 reconcile รูป/external link ไม่ได้ (`Cannot read … 'anchors'`)
 * รูปอยู่บนชีต "factor F" (ซ่อน) เท่านั้น → ถอดออกไม่กระทบฟอร์มพิมพ์ ปร.4/5/6
 * + ลบ orphan reference (<drawing/> ในชีต, <externalReferences> ใน workbook) กัน load error
 */
export async function stripUnsupportedParts(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  let touched = false;
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/(drawings|media|externalLinks)\//.test(name)) {
      zip.remove(name);
      touched = true;
    }
  }
  if (!touched) return buffer;

  const scrub = async (path: string, patterns: RegExp[]): Promise<void> => {
    const f = zip.file(path);
    if (!f) return;
    let xml = await f.async('string');
    for (const re of patterns) xml = xml.replace(re, '');
    zip.file(path, xml);
  };
  for (const path of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      await scrub(path, [/<drawing[^>]*\/>/g]);
    }
  }
  await scrub('xl/workbook.xml', [/<externalReferences>[\s\S]*?<\/externalReferences>/g]);

  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * โหลด master template + กรอกข้อมูล + ดาวน์โหลด (async)
 * เรียกหลังผู้ใช้ยืนยัน (prep.ok === true เท่านั้น)
 */
export async function downloadGovTemplate(
  data: BoqExportData,
  fileName: string,
): Promise<void> {
  const res = await fetch(boqMasterUrl);
  if (!res.ok) {
    throw new Error(`โหลด template ไม่สำเร็จ (${res.status}) — path: ${boqMasterUrl}`);
  }
  const raw = await res.arrayBuffer();
  const masterBuffer = await stripUnsupportedParts(raw);

  const { fillBoqTemplate } = await import('@/services/export/govExcelExport');
  const out = await fillBoqTemplate(masterBuffer, data);

  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
