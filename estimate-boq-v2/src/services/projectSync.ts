/**
 * Save / Load project — Supabase DB + Storage
 *
 * Save flow:
 *   1. upsert project row
 *   2. upload PDF/image raw blobs (Storage) — เฉพาะที่ยังไม่ upload
 *   3. upsert drawing_files + drawing_pages
 *   4. delete + insert shapes (measurements) ทั้งหมดของ project
 *   5. delete + insert boq_items
 *   6. update lastSavedAt
 *
 * Load flow:
 *   1. fetch project + drawing_files + drawing_pages + shapes + boq_items
 *   2. download Storage blobs
 *   3. re-render PDF/image โดย preserve DB IDs
 *   4. populate stores
 */
import { requireSupabase } from '@/lib/supabase';
import { useCurrentProject } from '@/stores/currentProjectStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { useScaleStore } from '@/stores/scaleStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useBOQStore } from '@/stores/boqStore';
import { useRawFileStore } from '@/stores/rawFileStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useAIStore } from '@/stores/aiStore';
import { loadDrawingFile } from './loadDrawing';
import type { Measurement } from '@/types/measurement';
import type { BOQItem } from '@/types/boq';
import type { ScaleProfile } from '@/core/scale';
import type {
  DrawingFile,
  DrawingPage,
} from '@/types/drawing';

const BUCKET = 'drawings';

// ─── Types matching DB rows ─────────────────────────────────────────────
interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  client: string | null;
  location: string | null;
  province: string | null;
  factor_f: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DrawingFileRow {
  id: string;
  project_id: string;
  name: string;
  source_type: 'pdf' | 'image';
  page_count: number;
  file_size: number | null;
  storage_path: string;
  imported_at: string;
}

interface DrawingPageRow {
  id: string;
  project_id: string;
  file_id: string;
  page_index: number;
  title: string | null;
  width_px: number | null;
  height_px: number | null;
  scale_value: number | null;
  rotation_deg: number | null;
}

interface ShapeRow {
  id: string;
  project_id: string;
  page_id: string | null;
  type: string;
  name: string | null;
  layer: string | null;
  points_json: unknown;
  area_m2: number | null;
  length_m: number | null;
  count_n: number | null;
}

interface BOQItemRow {
  id: string;
  project_id: string;
  category: string | null;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  is_material: boolean;
  waste_pct: number;
  thickness_m: number | null;
  source: string;
  source_ref: string | null;
  notes: string | null;
}

export interface ProjectListItem {
  id: string;
  name: string;
  client: string | null;
  province: string | null;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Error class สำหรับกรณี RLS policy บล็อก — UI แสดงขั้นตอนแก้ได้
 */
export class RLSError extends Error {
  readonly tableName: string;
  readonly operation: string;
  readonly originalMessage: string;
  constructor(tableName: string, operation: string, originalMessage: string) {
    super(
      `RLS บล็อก ${operation} บน ${tableName}\n` +
        `เหตุผลที่เป็นไปได้:\n` +
        `  • Migration ยังไม่ได้รัน — เปิดไฟล์ supabase/fix-rls-policies.sql แล้ว copy ไปรันใน Supabase SQL Editor\n` +
        `  • โปรเจกต์นี้ owner เป็นบัญชีอื่น — เริ่มโปรเจกต์ใหม่ หรือให้ admin โอน owner_id\n` +
        `  • Profile ของบัญชีนี้ยังไม่มีใน DB — ออกแล้ว login ใหม่`,
    );
    this.name = 'RLSError';
    this.tableName = tableName;
    this.operation = operation;
    this.originalMessage = originalMessage;
  }
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
}

function isRLSError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as SupabaseLikeError;
  const msg = e.message?.toLowerCase() ?? '';
  return (
    msg.includes('row-level security') ||
    msg.includes('row level security') ||
    e.code === '42501'
  );
}

function wrapDbError(
  err: unknown,
  tableName: string,
  operation: string,
): Error {
  if (err instanceof RLSError) return err;
  const original = err instanceof Error ? err.message : String(err);
  if (isRLSError(err)) {
    return new RLSError(tableName, operation, original);
  }
  return new Error(`${operation} ${tableName} ไม่สำเร็จ: ${original}`);
}

/**
 * ตรวจว่าพร้อม save แล้ว:
 *   1. มี session จริง (auth.uid() ใช้ได้)
 *   2. profile row มีอยู่ใน DB (กัน FK constraint fail ตอน upsert projects)
 *   3. ถ้า projectId เดิมมีอยู่แล้ว ตรวจ owner_id ตรงกับ user ปัจจุบัน
 *
 * คืน { ownerId, projectIdToUse }
 */
async function assertReadyForSave(
  client: ReturnType<typeof requireSupabase>,
  storedProjectId: string | null,
): Promise<{ ownerId: string; projectIdToUse: string; isNewProject: boolean }> {
  // 1. session
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error(
      'ยังไม่ได้ login กับ Supabase — ปิด VITE_DEV_BYPASS_AUTH (ถ้าเปิดอยู่) แล้ว login ด้วย Google',
    );
  }
  const ownerId = userData.user.id;

  // 2. ensure profile (กัน FK fail) — เรียก RPC ที่มี security definer
  // ถ้า function ไม่มี (ยังไม่ได้รัน fix-rls-policies.sql) จะ silent fail แล้ว fallback เป็น direct upsert
  const ensureRes = await client.rpc('ensure_profile');
  if (ensureRes.error) {
    // fallback: upsert profile โดยตรง (RLS อนุญาตให้ user upsert ของตัวเอง)
    const { error: upErr } = await client
      .from('profiles')
      .upsert(
        {
          id: ownerId,
          email: userData.user.email ?? `${ownerId}@unknown`,
          role: 'user',
        },
        { onConflict: 'id' },
      );
    if (upErr && !isRLSError(upErr)) {
      console.warn('[save] ensure_profile fallback failed:', upErr.message);
    }
  }

  // 3. ตรวจ ownership ของ project เก่า (ถ้ามี)
  if (storedProjectId) {
    const { data: existing, error: selErr } = await client
      .from('projects')
      .select('id, owner_id')
      .eq('id', storedProjectId)
      .maybeSingle();
    if (selErr && !isRLSError(selErr)) {
      throw new Error(`ตรวจ project เก่าไม่สำเร็จ: ${selErr.message}`);
    }
    if (existing && (existing as { owner_id: string }).owner_id !== ownerId) {
      throw new Error(
        `โปรเจกต์เดิม (id: ${storedProjectId.slice(0, 8)}…) เป็นของบัญชีอื่น — ` +
          `กรุณากด "📂 รายการโปรเจกต์" แล้วเริ่มโปรเจกต์ใหม่ หรือเลือกโปรเจกต์ของคุณ`,
      );
    }
    // โปรเจกต์เดิมเป็นของเรา → ใช้ id เดิม
    return {
      ownerId,
      projectIdToUse: storedProjectId,
      isNewProject: !existing,
    };
  }

  // ไม่มี projectId เดิม → สร้าง id ใหม่
  return {
    ownerId,
    projectIdToUse: crypto.randomUUID(),
    isNewProject: true,
  };
}

export async function saveProject(): Promise<string> {
  const client = requireSupabase();
  const meta = useProjectMeta.getState();
  const current = useCurrentProject.getState();
  const drawing = useDrawingStore.getState();
  const scaleStore = useScaleStore.getState();
  const rotation = useRotationStore.getState();
  const measurements = useMeasurementStore.getState();
  const boq = useBOQStore.getState();
  const rawFiles = useRawFileStore.getState();

  // ─── 1. ตรวจ session + profile + ownership ─────────────────────────────
  const { ownerId, projectIdToUse: projectId } = await assertReadyForSave(
    client,
    current.projectId,
  );

  // ─── 2. upsert project ────────────────────────────────────────────────
  {
    const { error } = await client.from('projects').upsert(
      {
        id: projectId,
        owner_id: ownerId,
        name: meta.name || 'โปรเจกต์ไม่มีชื่อ',
        client: meta.client || null,
        location: meta.location || null,
        province: meta.province || null,
        factor_f: meta.factorF,
        notes: null,
      },
      { onConflict: 'id' },
    );
    if (error) throw wrapDbError(error, 'projects', 'บันทึก');
  }

  // ─── 3. upload Storage + upsert drawing_files ─────────────────────────
  for (const file of drawing.files) {
    const path = storagePathFor(projectId, file);
    if (!rawFiles.isUploaded(file.id)) {
      const blob = rawFiles.getBlob(file.id);
      if (!blob) {
        // ไม่มี blob in-memory (อาจปิด browser แล้วเปิดใหม่)
        // → ข้าม upload แต่ยังคง upsert row (Storage จะมีไฟล์เดิมอยู่จาก save ก่อนหน้า)
        console.warn(`[save] ไม่มี blob ของ ${file.name} — ข้าม upload (ถือว่ามีอยู่แล้วใน Storage)`);
      } else {
        const { error } = await client.storage
          .from(BUCKET)
          .upload(path, blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: blobMime(file.sourceType),
          });
        if (error)
          throw wrapDbError(
            error,
            `Storage:drawings/${file.name}`,
            'upload',
          );
        rawFiles.markUploaded(file.id);
      }
    }

    const { error } = await client.from('drawing_files').upsert(
      {
        id: file.id,
        project_id: projectId,
        name: file.name,
        source_type: file.sourceType,
        page_count: file.pageCount,
        file_size: file.fileSize,
        storage_path: path,
        imported_at: file.importedAt,
      },
      { onConflict: 'id' },
    );
    if (error) throw wrapDbError(error, 'drawing_files', 'บันทึก');
  }

  // ─── 4. upsert drawing_pages ──────────────────────────────────────────
  const pageRows = drawing.pages.map((p) => ({
    id: p.id,
    project_id: projectId,
    file_id: p.fileId,
    page_index: p.pageNumber,
    width_px: p.pageWidth,
    height_px: p.pageHeight,
    scale_value: scaleStore.byPageId[p.id]?.unitPerPixel ?? null,
    rotation_deg: rotation.byPageId[p.id] ?? 0,
  }));
  if (pageRows.length > 0) {
    const { error } = await client
      .from('drawing_pages')
      .upsert(pageRows, { onConflict: 'id' });
    if (error) throw wrapDbError(error, 'drawing_pages', 'บันทึก');
  }

  // ─── 5. delete + insert shapes (เพราะ undo อาจลบ measurement) ────────
  {
    const { error: delErr } = await client
      .from('shapes')
      .delete()
      .eq('project_id', projectId);
    if (delErr) throw wrapDbError(delErr, 'shapes', 'ลบ');

    const shapeRows = measurements.measurements.map((m) =>
      measurementToRow(m, projectId),
    );
    if (shapeRows.length > 0) {
      const { error } = await client.from('shapes').insert(shapeRows);
      if (error) throw wrapDbError(error, 'shapes', 'บันทึก measurements ใน');
    }
  }

  // ─── 6. delete + insert boq_items ────────────────────────────────────
  {
    const { error: delErr } = await client
      .from('boq_items')
      .delete()
      .eq('project_id', projectId);
    if (delErr) throw wrapDbError(delErr, 'boq_items', 'ลบ');

    const boqRows = boq.items.map((it) => boqToRow(it, projectId));
    if (boqRows.length > 0) {
      const { error } = await client.from('boq_items').insert(boqRows);
      if (error) throw wrapDbError(error, 'boq_items', 'บันทึก');
    }
  }

  // ─── 7. update store state ────────────────────────────────────────────
  current.setProjectId(projectId);
  current.setLastSavedAt(new Date().toISOString());

  return projectId;
}

// ═══════════════════════════════════════════════════════════════════════
// LOAD
// ═══════════════════════════════════════════════════════════════════════

export interface LoadProgress {
  step:
    | 'fetching_meta'
    | 'fetching_files'
    | 'downloading'
    | 'rendering'
    | 'populating'
    | 'done';
  fileCurrent?: number;
  fileTotal?: number;
  fileName?: string;
}

export async function loadProject(
  projectId: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<void> {
  const client = requireSupabase();

  onProgress?.({ step: 'fetching_meta' });

  // ─── 1. fetch project + รวมทุก related rows แบบขนาน ───────────────────
  const [projectRes, filesRes, pagesRes, shapesRes, boqRes] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).single(),
    client.from('drawing_files').select('*').eq('project_id', projectId).order('imported_at'),
    client.from('drawing_pages').select('*').eq('project_id', projectId).order('page_index'),
    client.from('shapes').select('*').eq('project_id', projectId).order('id'),
    client.from('boq_items').select('*').eq('project_id', projectId).order('id'),
  ]);

  if (projectRes.error)
    throw new Error(`โหลด project ไม่สำเร็จ: ${projectRes.error.message}`);
  const project = projectRes.data as ProjectRow;
  if (filesRes.error)
    throw new Error(`โหลด files ไม่สำเร็จ: ${filesRes.error.message}`);
  const files = (filesRes.data ?? []) as DrawingFileRow[];
  if (pagesRes.error)
    throw new Error(`โหลด pages ไม่สำเร็จ: ${pagesRes.error.message}`);
  const pages = (pagesRes.data ?? []) as DrawingPageRow[];
  if (shapesRes.error)
    throw new Error(`โหลด shapes ไม่สำเร็จ: ${shapesRes.error.message}`);
  const shapes = (shapesRes.data ?? []) as ShapeRow[];
  if (boqRes.error)
    throw new Error(`โหลด BOQ ไม่สำเร็จ: ${boqRes.error.message}`);
  const boqRows = (boqRes.data ?? []) as BOQItemRow[];

  // ─── 2. clear stores ─────────────────────────────────────────────────
  resetAllStores();

  // ─── 3. populate project meta ────────────────────────────────────────
  // legacy: โปรเจกต์เก่าบันทึก factor_f = 1.2768 (default เดิม) → ใช้ตารางอัตโนมัติแทน (0)
  const savedFactorF = project.factor_f ?? 0;
  const factorF = Math.abs(savedFactorF - 1.2768) < 1e-9 ? 0 : savedFactorF;
  useProjectMeta.getState().setAll({
    name: project.name,
    client: project.client ?? '',
    location: project.location ?? '',
    province: project.province ?? '',
    factorF, // 0 = อัตโนมัติจากตาราง CGD 2567 (>0 = override กรอกเอง)
    vatPct: 7,
    advancePct: 0,
    retentionPct: 0,
  });

  // ─── 4. download files + re-render ───────────────────────────────────
  onProgress?.({ step: 'fetching_files', fileTotal: files.length });
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress?.({
      step: 'downloading',
      fileCurrent: i + 1,
      fileTotal: files.length,
      fileName: file.name,
    });

    const { data: blob, error: dlErr } = await client.storage
      .from(BUCKET)
      .download(file.storage_path);
    if (dlErr || !blob) {
      throw new Error(
        `download "${file.name}" ไม่สำเร็จ: ${dlErr?.message ?? 'unknown'}`,
      );
    }

    // store raw blob ไว้สำหรับ save ครั้งถัดไป (mark uploaded แล้ว)
    useRawFileStore.getState().setBlob(file.id, blob);
    useRawFileStore.getState().markUploaded(file.id);

    onProgress?.({
      step: 'rendering',
      fileCurrent: i + 1,
      fileTotal: files.length,
      fileName: file.name,
    });

    // หา pageIds ของ file นี้ เรียงตาม page_index
    const filePages = pages
      .filter((p) => p.file_id === file.id)
      .sort((a, b) => a.page_index - b.page_index);
    const pageIds = filePages.map((p) => p.id);

    // สร้าง File object จาก blob เพื่อใช้กับ loadDrawingFile
    const f = new File([blob], file.name, { type: blobMime(file.source_type) });
    const result = await loadDrawingFile(f, undefined, {
      fileId: file.id,
      pageIds,
    });

    useDrawingStore.getState().addImport(result);
  }

  // ─── 5. populate scale + rotation per page ───────────────────────────
  for (const p of pages) {
    if (p.scale_value != null) {
      const profile: ScaleProfile = {
        pixelDistance: 0,
        realDistance: 0,
        unit: 'm',
        unitPerPixel: p.scale_value,
        pixelPerUnit: 1 / p.scale_value,
        createdAt: new Date().toISOString(),
      };
      useScaleStore.getState().setScale(p.id, profile);
    }
    if (p.rotation_deg != null && p.rotation_deg !== 0) {
      useRotationStore.getState().set(p.id, p.rotation_deg);
    }
  }

  // ─── 6. populate measurements ────────────────────────────────────────
  onProgress?.({ step: 'populating' });
  for (const s of shapes) {
    const m = rowToMeasurement(s);
    if (m) useMeasurementStore.getState().add(m);
  }

  // ─── 7. populate BOQ ─────────────────────────────────────────────────
  const boqItems = boqRows.map(rowToBOQItem);
  if (boqItems.length > 0) {
    useBOQStore.getState().addMany(boqItems);
  }

  // ─── 8. update current project + mark saved ──────────────────────────
  useCurrentProject.getState().setProjectId(projectId);
  useCurrentProject.getState().setLastSavedAt(project.updated_at);

  onProgress?.({ step: 'done' });
}

// ═══════════════════════════════════════════════════════════════════════
// LIST / DELETE
// ═══════════════════════════════════════════════════════════════════════

export async function listProjects(): Promise<ProjectListItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('projects')
    .select('id, name, client, province, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`โหลดรายการโปรเจกต์ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as ProjectListItem[];
}

/**
 * ลบโปรเจกต์ — admin เท่านั้น (RLS)
 * ถ้าไม่ใช่ admin ให้ส่ง deleteRequest แทน
 */
export async function deleteProject(projectId: string): Promise<void> {
  const client = requireSupabase();
  // ลบ Storage objects ก่อน (RLS cascade ไม่ลบ Storage)
  const { data: filesData } = await client
    .from('drawing_files')
    .select('storage_path')
    .eq('project_id', projectId);
  const paths = (filesData ?? []).map((r) => r.storage_path);
  if (paths.length > 0) {
    await client.storage.from(BUCKET).remove(paths);
  }

  const { error } = await client.from('projects').delete().eq('id', projectId);
  if (error) {
    throw new Error(
      `ลบโปรเจกต์ไม่สำเร็จ: ${error.message} (เฉพาะ admin เท่านั้น — user ปกติให้ใช้ "ส่งคำขอลบ")`,
    );
  }
}

export async function requestDeleteProject(
  projectId: string,
  reason?: string,
): Promise<void> {
  const client = requireSupabase();
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

  const { error } = await client.from('delete_requests').insert({
    requester_id: userData.user.id,
    item_type: 'project',
    item_id: projectId,
    reason: reason ?? null,
    status: 'pending',
  });
  if (error) throw new Error(`ส่งคำขอลบไม่สำเร็จ: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════════
// helpers
// ═══════════════════════════════════════════════════════════════════════

function resetAllStores(): void {
  useDrawingStore.getState().clearAll();
  useRawFileStore.getState().clear();
  useMeasurementStore.setState({ measurements: [], past: [], future: [], selectedId: null });
  useBOQStore.setState({ items: [], past: [], future: [], selectedId: null });
  useScaleStore.setState({ byPageId: {} });
  useRotationStore.setState({ byPageId: {} });
  useViewportStore.setState({ byPageId: {} });
  useAIStore.getState().clearAll();
}

function storagePathFor(projectId: string, file: DrawingFile): string {
  // sanitize filename เล็กน้อยกัน path traversal
  const safe = file.name.replace(/[\\/]/g, '_');
  return `${projectId}/${file.id}/${safe}`;
}

function blobMime(sourceType: 'pdf' | 'image'): string {
  return sourceType === 'pdf' ? 'application/pdf' : 'image/png';
}

function measurementToRow(
  m: Measurement,
  projectId: string,
): Omit<ShapeRow, 'project_id' | 'page_id'> & {
  project_id: string;
  page_id: string;
} {
  return {
    id: m.id,
    project_id: projectId,
    page_id: m.pageId,
    type: m.type,
    name: m.name ?? null,
    layer: m.layer ?? null,
    // เก็บ measurement ทั้ง object ใน points_json (เก็บข้อมูลครบ)
    points_json: m as unknown,
    area_m2: m.type === 'area' ? m.areaM2 : null,
    length_m: m.type === 'length' ? m.lengthM : null,
    count_n: m.type === 'count' ? m.count : null,
  };
}

function rowToMeasurement(row: ShapeRow): Measurement | null {
  const j = row.points_json as Record<string, unknown> | null;
  if (!j || typeof j !== 'object') return null;
  // points_json เก็บ Measurement object เต็ม → cast กลับ
  // (ป้องกันด้วยการเช็ค type พื้นฐาน)
  if (
    typeof j.type !== 'string' ||
    !Array.isArray(j.points) ||
    typeof j.pageId !== 'string'
  ) {
    return null;
  }
  return j as unknown as Measurement;
}

function boqToRow(it: BOQItem, projectId: string): Omit<BOQItemRow, 'project_id'> & { project_id: string } {
  return {
    id: it.id,
    project_id: projectId,
    category: it.category || null,
    name: it.name,
    unit: it.unit,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    is_material: it.isMaterial,
    waste_pct: it.wastePct,
    thickness_m: it.thickness ?? null,
    source: it.source,
    source_ref: it.sourceRef ?? null,
    notes: it.notes ?? null,
  };
}

function rowToBOQItem(row: BOQItemRow): BOQItem {
  const now = new Date().toISOString();
  return {
    id: row.id,
    category: row.category ?? 'อื่นๆ',
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    isMaterial: row.is_material,
    wastePct: row.waste_pct,
    thickness: row.thickness_m ?? undefined,
    source: (row.source as BOQItem['source']) ?? 'manual',
    sourceRef: row.source_ref ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── DrawingPage typed re-export (เผื่อใช้ในอนาคต) ────────────────────
export type { DrawingPage };
