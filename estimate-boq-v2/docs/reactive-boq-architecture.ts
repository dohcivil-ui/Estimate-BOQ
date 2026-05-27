// ============================================================
// 🔄 REACTIVE BOQ ARCHITECTURE
// ============================================================
// แก้ปัญหา 3 จุด:
//   1. AI วิเคราะห์ใหม่ → BOQ auto-update
//   2. Excel export = BOQ ปัจจุบันเสมอ
//   3. Save สะสมงานข้ามรอบ (สถาปัตย์ → โครงสร้าง → ไฟฟ้า)
// ============================================================

// ─────────────────────────────────────────────────────────────
// 1) DATA MODEL — แยก BOQ ตาม discipline + page
// ─────────────────────────────────────────────────────────────

/**
 * แต่ละรายการใน BOQ
 */
interface BOQItem {
  id: string;               // uuid
  name: string;             // "พื้น ค.ส.ล. ขัดมัน F1"
  unit: string;             // "ตร.ม."
  qty: number;              // 200.00
  laborRate: number;        // ค่าแรง ว.809
  matRate: number;          // ค่าวัสดุ
  isMaterial: boolean;
  thickness: number;
  wastePercent: number;
  source: 'ai' | 'manual' | 'import';  // ← ที่มาของรายการ
  confidence: number;       // 0-1 จาก AI
  pageRef: string;          // "A-02" — หน้าที่ถอดมา
}

/**
 * กลุ่มงานแยกตาม discipline + หน้าแบบ
 */
interface DisciplineGroup {
  discipline: 'architectural' | 'structural' | 'electrical' | 'sanitary' | 'other';
  pageId: string;           // "A-02", "S-01"
  pageName: string;         // "แปลนพื้นชั้น 1"
  items: BOQItem[];
  analyzedAt: string;       // ISO timestamp — วิเคราะห์ล่าสุดเมื่อไหร่
  status: 'draft' | 'confirmed';
}

/**
 * โปรเจกต์ทั้งหมด
 */
interface ProjectState {
  id: string;
  name: string;
  location: string;
  factorF: number;
  
  // ─── BOQ แยกตาม discipline ───
  disciplineGroups: DisciplineGroup[];
  
  // ─── ค่าที่คำนวณได้ (derived — auto-compute) ───
  // ไม่ต้อง save — คำนวณจาก disciplineGroups เสมอ
  // totalBOQ, grandTotal, etc.
}


// ─────────────────────────────────────────────────────────────
// 2) ZUSTAND STORE — Single Source of Truth + Auto-sync
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

interface BOQStore {
  // State
  disciplineGroups: DisciplineGroup[];
  factorF: number;
  
  // === AI วิเคราะห์เสร็จ → REPLACE รายการของหน้านั้น ===
  replacePageItems: (pageId: string, discipline: string, newItems: BOQItem[]) => void;
  
  // === แก้ไขรายการด้วยมือ ===
  updateItem: (itemId: string, changes: Partial<BOQItem>) => void;
  addItem: (pageId: string, item: Omit<BOQItem, 'id'>) => void;
  removeItem: (itemId: string) => void;
  
  // === Computed (auto-sync) ===
  getAllItems: () => BOQItem[];
  getItemsByDiscipline: (d: string) => BOQItem[];
  getGrandTotal: () => number;
  
  // === Save/Load ===
  exportState: () => ProjectSaveData;
  importState: (data: ProjectSaveData) => void;
}

const useBOQStore = create<BOQStore>((set, get) => ({
  disciplineGroups: [],
  factorF: 1.2768,  // default Factor F
  
  // ──────────────────────────────────────────────────
  // 🔑 KEY FUNCTION: AI วิเคราะห์เสร็จ → REPLACE ทั้งหน้า
  // ──────────────────────────────────────────────────
  // เมื่อ AI วิเคราะห์หน้า A-02 ใหม่:
  //   - ลบ items เก่าของหน้า A-02 ทิ้งหมด
  //   - ใส่ items ใหม่จาก AI แทน
  //   - ไม่กระทบหน้าอื่น (S-01, EE-01, etc.)
  //   - BOQ tab + Excel = ข้อมูลล่าสุดทันที
  // ──────────────────────────────────────────────────
  replacePageItems: (pageId, discipline, newItems) => {
    set((state) => {
      // หา group เดิมของหน้านี้
      const existingIdx = state.disciplineGroups.findIndex(
        g => g.pageId === pageId
      );
      
      const newGroup: DisciplineGroup = {
        discipline: discipline as any,
        pageId,
        pageName: `หน้า ${pageId}`,
        items: newItems.map(item => ({ ...item, id: item.id || uuid() })),
        analyzedAt: new Date().toISOString(),
        status: 'draft',
      };
      
      const groups = [...state.disciplineGroups];
      
      if (existingIdx >= 0) {
        // ★ REPLACE — ลบเก่า ใส่ใหม่
        groups[existingIdx] = newGroup;
      } else {
        // ★ ADD — หน้าใหม่ที่ยังไม่เคยวิเคราะห์
        groups.push(newGroup);
      }
      
      return { disciplineGroups: groups };
    });
    
    // ★ AUTO-NOTIFY: ทุก component ที่ subscribe จะ re-render อัตโนมัติ
    // BOQ tab, Excel preview, Summary — ทุกอย่าง update พร้อมกัน
    console.log(`✅ BOQ updated: ${pageId} (${discipline}) — ${newItems.length} items`);
  },
  
  updateItem: (itemId, changes) => {
    set((state) => ({
      disciplineGroups: state.disciplineGroups.map(group => ({
        ...group,
        items: group.items.map(item =>
          item.id === itemId ? { ...item, ...changes } : item
        ),
      })),
    }));
  },
  
  addItem: (pageId, item) => {
    set((state) => ({
      disciplineGroups: state.disciplineGroups.map(group =>
        group.pageId === pageId
          ? { ...group, items: [...group.items, { ...item, id: uuid() }] }
          : group
      ),
    }));
  },
  
  removeItem: (itemId) => {
    set((state) => ({
      disciplineGroups: state.disciplineGroups.map(group => ({
        ...group,
        items: group.items.filter(item => item.id !== itemId),
      })),
    }));
  },
  
  // ──────────────────────────────────────────────────
  // 🔑 COMPUTED VALUES — ใช้ทุกที่ ไม่ต้อง duplicate
  // ──────────────────────────────────────────────────
  getAllItems: () => {
    return get().disciplineGroups.flatMap(g => g.items);
  },
  
  getItemsByDiscipline: (d) => {
    return get().disciplineGroups
      .filter(g => g.discipline === d)
      .flatMap(g => g.items);
  },
  
  getGrandTotal: () => {
    const allItems = get().getAllItems();
    const factorF = get().factorF;
    return allItems.reduce((sum, item) => {
      const cost = item.qty * (item.laborRate + item.matRate);
      return sum + cost;
    }, 0) * factorF;
  },
  
  // ──────────────────────────────────────────────────
  // 🔑 SAVE/LOAD — สะสมงานข้ามรอบ
  // ──────────────────────────────────────────────────
  exportState: () => {
    const state = get();
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      factorF: state.factorF,
      disciplineGroups: state.disciplineGroups,
      // ★ บันทึกทุก discipline ที่ทำไว้แล้ว
      // เปิดมาทำต่อ → ข้อมูลเดิมอยู่ครบ
    };
  },
  
  importState: (data) => {
    set({
      factorF: data.factorF,
      disciplineGroups: data.disciplineGroups,
    });
  },
}));


// ─────────────────────────────────────────────────────────────
// 3) AUTO-SYNC FLOW — ทุกจุดเชื่อมกันอัตโนมัติ
// ─────────────────────────────────────────────────────────────

/**
 * เมื่อ AI วิเคราะห์แบบเสร็จ → เรียก function นี้
 * ทุกอย่างจะ update อัตโนมัติตลอดสาย
 */
async function onAIAnalysisComplete(
  pageId: string,          // "A-02"  
  discipline: string,      // "architectural"
  aiResponse: any          // JSON จาก AI
) {
  const store = useBOQStore.getState();
  
  // 1. แปลง AI response → BOQItem[]
  const newItems: BOQItem[] = aiResponse.items.map((raw: any) => ({
    id: uuid(),
    name: raw.name,
    unit: raw.unit,
    qty: raw.qty,
    laborRate: raw.labor_rate || 0,
    matRate: raw.mat_rate || 0,
    isMaterial: raw.is_material || false,
    thickness: raw.thickness || 0,
    wastePercent: raw.waste_pct || 5,
    source: 'ai' as const,
    confidence: raw.confidence || 0.85,
    pageRef: pageId,
  }));
  
  // 2. ★ REPLACE — ลบเก่าของหน้านี้ ใส่ใหม่
  //    ไม่กระทบหน้า/discipline อื่น
  store.replacePageItems(pageId, discipline, newItems);
  
  // 3. ★ AUTO-SYNC เกิดขึ้นอัตโนมัติ:
  //    - BOQ tab → re-render (Zustand subscription)
  //    - Summary → recalculate (computed values)
  //    - Excel export → ถ้ากดตอนนี้จะได้ข้อมูลล่าสุด
  //    - ไม่ต้องกดอะไรเพิ่ม!
}


// ─────────────────────────────────────────────────────────────
// 4) EXCEL EXPORT — ดึงจาก store ปัจจุบันเสมอ
// ─────────────────────────────────────────────────────────────

/**
 * ★ Excel export ต้องดึงจาก store.getAllItems() เสมอ
 * ห้ามดึงจาก cache หรือ state เก่า
 */
function exportToExcel() {
  const store = useBOQStore.getState();
  const allGroups = store.disciplineGroups;
  const factorF = store.factorF;
  
  // จัดกลุ่มตาม discipline สำหรับ sheet แยก
  const byDiscipline = {
    architectural: allGroups.filter(g => g.discipline === 'architectural'),
    structural: allGroups.filter(g => g.discipline === 'structural'),
    electrical: allGroups.filter(g => g.discipline === 'electrical'),
    sanitary: allGroups.filter(g => g.discipline === 'sanitary'),
  };
  
  // สร้าง Excel workbook
  // const wb = XLSX.utils.book_new();
  
  // Sheet 1: สรุปรวม
  const summaryRows = [];
  summaryRows.push(['สรุปประมาณราคา', '', '', '', '', '']);
  summaryRows.push(['', '', '', '', '', '']);
  
  let grandTotal = 0;
  
  for (const [disc, groups] of Object.entries(byDiscipline)) {
    if (groups.length === 0) continue;
    
    const discName = {
      architectural: 'งานสถาปัตยกรรม',
      structural: 'งานโครงสร้าง',
      electrical: 'งานไฟฟ้า',
      sanitary: 'งานสุขาภิบาล',
    }[disc] || disc;
    
    summaryRows.push([`หมวด: ${discName}`, '', '', '', '', '']);
    summaryRows.push(['ลำดับ', 'รายการ', 'หน่วย', 'ปริมาณ', 'ราคา/หน่วย', 'รวม']);
    
    let seq = 1;
    for (const group of groups) {
      // ★ แสดงที่มา: หน้าไหน วิเคราะห์เมื่อไหร่
      summaryRows.push([`  [${group.pageId}] ${group.pageName}`, '', '', '', '', 
        `วิเคราะห์: ${new Date(group.analyzedAt).toLocaleString('th-TH')}`]);
      
      for (const item of group.items) {
        const unitPrice = item.laborRate + item.matRate;
        const total = item.qty * unitPrice;
        grandTotal += total;
        summaryRows.push([seq++, item.name, item.unit, item.qty, unitPrice, total]);
      }
    }
    summaryRows.push(['', '', '', '', '', '']);
  }
  
  summaryRows.push(['', '', '', '', 'รวมก่อน Factor F', grandTotal]);
  summaryRows.push(['', '', '', '', `Factor F (${factorF})`, grandTotal * factorF]);
  
  // ★ ทุกครั้งที่กด Export → ได้ข้อมูลล่าสุดจาก store
  // ไม่มี cache เก่า ไม่มีงานหลังคาที่ถูกลบแล้ว
  
  console.log('📊 Excel exported with', store.getAllItems().length, 'items from',
    allGroups.length, 'pages');
  
  return summaryRows;  // ส่งไปสร้าง XLSX
}


// ─────────────────────────────────────────────────────────────
// 5) SAVE/LOAD — สะสมงานข้ามรอบ
// ─────────────────────────────────────────────────────────────

/**
 * ★ SAVE FORMAT v2 — เก็บทุก discipline ที่ทำไว้แล้ว
 */
interface ProjectSaveData {
  version: 2;
  savedAt: string;
  factorF: number;
  disciplineGroups: DisciplineGroup[];
  // + shapes, drawings, settings, etc.
}

/**
 * SAVE — บันทึกทุกอย่างที่ทำไว้
 */
function saveProject() {
  const store = useBOQStore.getState();
  const saveData: ProjectSaveData = store.exportState();
  
  // เพิ่มข้อมูลอื่นๆ
  // saveData.shapes = shapeStore.getState().shapes;
  // saveData.drawings = drawingStore.getState().pages;
  
  const json = JSON.stringify(saveData, null, 2);
  
  // Download JSON
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  
  console.log('💾 Saved:', {
    disciplines: saveData.disciplineGroups.map(g => g.discipline),
    pages: saveData.disciplineGroups.map(g => g.pageId),
    totalItems: saveData.disciplineGroups.reduce((s, g) => s + g.items.length, 0),
  });
}

/**
 * LOAD — โหลดงานเดิม แล้วทำต่อได้
 * 
 * ★ ตัวอย่าง workflow:
 * 
 *   รอบที่ 1: ทำสถาปัตย์
 *     - วิเคราะห์ A-01, A-02, A-03
 *     - BOQ มี: พื้น F1, F3/F4, ผนัง, ประตู, หน้าต่าง
 *     - SAVE → ได้ไฟล์ project-2569-05-27.json
 *     - disciplineGroups = [
 *         { discipline: 'architectural', pageId: 'A-01', items: [...] },
 *         { discipline: 'architectural', pageId: 'A-02', items: [...] },
 *       ]
 * 
 *   รอบที่ 2: ทำโครงสร้าง
 *     - LOAD → project-2569-05-27.json
 *     - ★ BOQ แสดง: งานสถาปัตย์เดิมยังอยู่ครบ!
 *     - วิเคราะห์ S-01, S-02, S-03
 *     - BOQ เพิ่ม: ฐานราก, เสา, คาน, พื้น ค.ส.ล.
 *     - SAVE → project-2569-05-28.json
 *     - disciplineGroups = [
 *         { discipline: 'architectural', pageId: 'A-01', items: [...] },  ← เดิม
 *         { discipline: 'architectural', pageId: 'A-02', items: [...] },  ← เดิม
 *         { discipline: 'structural', pageId: 'S-01', items: [...] },     ← ใหม่
 *         { discipline: 'structural', pageId: 'S-02', items: [...] },     ← ใหม่
 *       ]
 * 
 *   รอบที่ 3: ทำไฟฟ้า + สุขาภิบาล
 *     - LOAD → project-2569-05-28.json
 *     - ★ BOQ แสดง: สถาปัตย์ + โครงสร้าง ยังอยู่ครบ!
 *     - วิเคราะห์ EE-01, SN-01
 *     - SAVE → ได้ทุก discipline รวมกัน
 * 
 *   Excel export ตอนไหนก็ได้: ได้ทุก discipline ที่ทำไว้
 */
function loadProject(json: string) {
  const data: ProjectSaveData = JSON.parse(json);
  
  if (data.version !== 2) {
    // migrate จาก v1 ถ้าจำเป็น
    console.warn('⚠️ Old save format — migrating...');
  }
  
  const store = useBOQStore.getState();
  store.importState(data);
  
  console.log('📂 Loaded:', {
    savedAt: data.savedAt,
    disciplines: [...new Set(data.disciplineGroups.map(g => g.discipline))],
    pages: data.disciplineGroups.map(g => g.pageId),
    totalItems: data.disciplineGroups.reduce((s, g) => s + g.items.length, 0),
  });
}


// ─────────────────────────────────────────────────────────────
// 6) DATA FLOW DIAGRAM
// ─────────────────────────────────────────────────────────────

/*
  ┌─────────────────────────────────────────────────────────┐
  │                    DATA FLOW (v2)                        │
  │                                                         │
  │  ┌──────────┐    replacePageItems()    ┌──────────────┐ │
  │  │ AI วิเคราะห์ │ ──────────────────────→ │              │ │
  │  │ หน้า A-02  │                        │              │ │
  │  └──────────┘                          │   ZUSTAND    │ │
  │                                        │   STORE      │ │
  │  ┌──────────┐    addItem()             │              │ │
  │  │ ผู้ใช้เพิ่ม   │ ──────────────────────→ │ discipline   │ │
  │  │ รายการด้วยมือ │                        │ Groups[]    │ │
  │  └──────────┘                          │              │ │
  │                                        │  ┌─────────┐ │ │
  │  ┌──────────┐    importState()         │  │ A-01    │ │ │
  │  │ Load JSON │ ──────────────────────→  │  │ A-02    │ │ │
  │  └──────────┘                          │  │ S-01    │ │ │
  │                                        │  │ S-02    │ │ │
  │                                        │  │ EE-01   │ │ │
  │                                        │  └─────────┘ │ │
  │                                        └──────┬───────┘ │
  │                                               │         │
  │                    ★ AUTO-SYNC (Zustand subscription)   │
  │                                               │         │
  │              ┌────────────┬──────────┬────────┘         │
  │              │            │          │                   │
  │              ▼            ▼          ▼                   │
  │        ┌──────────┐ ┌────────┐ ┌──────────┐             │
  │        │ BOQ Tab   │ │ สรุปรวม │ │ Excel    │             │
  │        │ แสดงรายการ  │ │ ราคารวม │ │ Export   │             │
  │        │ ล่าสุดเสมอ  │ │ Factor F│ │ ล่าสุดเสมอ│             │
  │        └──────────┘ └────────┘ └──────────┘             │
  │                                                         │
  │        ┌──────────┐                                     │
  │        │ Save JSON │ ← exportState()                    │
  │        │ ทุก discipline │ ← ได้ทุกหน้า ทุกหมวด ครบ         │
  │        └──────────┘                                     │
  └─────────────────────────────────────────────────────────┘
  
  
  ★ กฎสำคัญ:
  
  1. ข้อมูลอยู่ที่เดียว = Zustand Store
     ทุก component อ่านจากที่นี่ ไม่มี copy แยก
  
  2. AI วิเคราะห์ใหม่ = REPLACE เฉพาะหน้านั้น
     replacePageItems("A-02", "architectural", newItems)
     → ลบ items เก่าของ A-02
     → ใส่ items ใหม่
     → หน้าอื่น (S-01, EE-01) ไม่กระทบ
  
  3. BOQ / Excel / Summary = computed จาก store
     ไม่มี cache แยก → ไม่มีข้อมูลเก่าค้าง
  
  4. Save = snapshot ทุก discipline
     Load = restore ทั้งหมด → ทำต่อได้เลย
*/


// ─────────────────────────────────────────────────────────────
// 7) REACT COMPONENTS — ใช้ Zustand subscription
// ─────────────────────────────────────────────────────────────

/*
// BOQ Tab — auto-update เมื่อ store เปลี่ยน
function BOQPanel() {
  // ★ subscribe เฉพาะ disciplineGroups
  // เมื่อ AI วิเคราะห์ใหม่ → component นี้ re-render อัตโนมัติ
  const groups = useBOQStore(state => state.disciplineGroups);
  const factorF = useBOQStore(state => state.factorF);
  
  return (
    <div>
      {groups.map(group => (
        <DisciplineSection key={group.pageId} group={group} />
      ))}
      <GrandTotal groups={groups} factorF={factorF} />
    </div>
  );
}

// Summary — auto-update
function SummaryBadge() {
  const getGrandTotal = useBOQStore(state => state.getGrandTotal);
  const total = getGrandTotal();
  return <span>฿{total.toLocaleString()}</span>;
}

// Excel Export Button — ดึงจาก store ปัจจุบันเสมอ
function ExcelExportButton() {
  const handleExport = () => {
    // ★ ดึงจาก store ณ เวลาที่กด ไม่ใช่ cache
    const rows = exportToExcel();
    // สร้าง XLSX...
  };
  return <button onClick={handleExport}>📥 Export Excel</button>;
}
*/


// ─────────────────────────────────────────────────────────────
// 8) MIGRATION — แปลง save เดิม (v1) → v2
// ─────────────────────────────────────────────────────────────

interface V1SaveData {
  boq: Array<{ name: string; unit: string; qty: number; /* ... */ }>;
  shapes: any[];
  // ไม่มี discipline / pageId
}

function migrateV1toV2(v1: V1SaveData): ProjectSaveData {
  // v1 ไม่ได้แยก discipline → ใส่ทั้งหมดเป็น 'other'
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    factorF: 1.2768,
    disciplineGroups: [{
      discipline: 'other',
      pageId: 'legacy',
      pageName: 'ข้อมูลนำเข้าจากเวอร์ชันเก่า',
      items: v1.boq.map(item => ({
        id: uuid(),
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        laborRate: 0,
        matRate: 0,
        isMaterial: false,
        thickness: 0,
        wastePercent: 5,
        source: 'manual' as const,
        confidence: 1,
        pageRef: 'legacy',
      })),
      analyzedAt: new Date().toISOString(),
      status: 'confirmed',
    }],
  };
}

export {
  useBOQStore,
  onAIAnalysisComplete,
  exportToExcel,
  saveProject,
  loadProject,
  migrateV1toV2,
};
export type {
  BOQItem,
  DisciplineGroup,
  ProjectState,
  ProjectSaveData,
};
