/**
 * Admin operations — เรียกได้เฉพาะ user ที่ profiles.role='admin' (RLS bypass)
 * RLS policies จะปฏิเสธถ้า non-admin
 */
import { requireSupabase } from '@/lib/supabase';
import type { UserRole } from '@/types/user';
import { deleteProject } from './projectSync';

// ─── Types ─────────────────────────────────────────────────────────────
export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export type DeleteItemType =
  | 'project'
  | 'drawing_page'
  | 'shape'
  | 'boq_item';

export type DeleteRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminDeleteRequest {
  id: string;
  requester_id: string;
  /** joined จาก profiles (best-effort) */
  requester_email?: string | null;
  requester_name?: string | null;
  item_type: DeleteItemType;
  item_id: string;
  reason: string | null;
  status: DeleteRequestStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AdminMaterialPrice {
  id: string;
  province: string;
  item: string;
  unit: string;
  price: number;
  source: string | null;
  fetched_at: string | null;
  updated_at: string;
}

// ─── Users ─────────────────────────────────────────────────────────────

export async function listUsers(): Promise<AdminUserItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`โหลดรายชื่อ user ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as AdminUserItem[];
}

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw new Error(`เปลี่ยน role ไม่สำเร็จ: ${error.message}`);
}

// ─── Delete requests ───────────────────────────────────────────────────

export async function listDeleteRequests(
  statusFilter?: DeleteRequestStatus,
): Promise<AdminDeleteRequest[]> {
  const client = requireSupabase();
  let q = client
    .from('delete_requests')
    .select(
      `
      id, requester_id, item_type, item_id, reason, status,
      reviewer_id, reviewed_at, created_at,
      requester:profiles!delete_requests_requester_id_fkey(email, full_name)
    `,
    )
    .order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) throw new Error(`โหลดคำขอลบไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown> & {
      requester?: { email?: string; full_name?: string | null } | null;
    };
    return {
      id: row.id as string,
      requester_id: row.requester_id as string,
      requester_email: row.requester?.email ?? null,
      requester_name: row.requester?.full_name ?? null,
      item_type: row.item_type as DeleteItemType,
      item_id: row.item_id as string,
      reason: (row.reason as string | null) ?? null,
      status: row.status as DeleteRequestStatus,
      reviewer_id: (row.reviewer_id as string | null) ?? null,
      reviewed_at: (row.reviewed_at as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

/**
 * อนุมัติคำขอลบ — ลบ item จริง + update status='approved'
 * รองรับ project (ใช้ deleteProject ที่ลบ Storage ด้วย), drawing_page, shape, boq_item
 */
export async function approveDeleteRequest(
  request: AdminDeleteRequest,
): Promise<void> {
  const client = requireSupabase();
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

  // 1. ลบ item จริง
  if (request.item_type === 'project') {
    await deleteProject(request.item_id);
  } else {
    const table = tableForItemType(request.item_type);
    if (!table) {
      throw new Error(`ชนิด item ไม่รองรับ: ${request.item_type}`);
    }
    const { error } = await client.from(table).delete().eq('id', request.item_id);
    if (error)
      throw new Error(`ลบ ${request.item_type} ไม่สำเร็จ: ${error.message}`);
  }

  // 2. mark request เป็น approved
  const { error: upErr } = await client
    .from('delete_requests')
    .update({
      status: 'approved',
      reviewer_id: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (upErr)
    throw new Error(`อัปเดตสถานะคำขอไม่สำเร็จ: ${upErr.message}`);
}

export async function rejectDeleteRequest(
  requestId: string,
  reason?: string,
): Promise<void> {
  const client = requireSupabase();
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

  const { error } = await client
    .from('delete_requests')
    .update({
      status: 'rejected',
      reviewer_id: userData.user.id,
      reviewed_at: new Date().toISOString(),
      // ใส่เหตุผลใน reason field (concat ของเดิม)
      reason: reason ? `[ปฏิเสธ] ${reason}` : undefined,
    })
    .eq('id', requestId);
  if (error)
    throw new Error(`ปฏิเสธคำขอไม่สำเร็จ: ${error.message}`);
}

function tableForItemType(t: DeleteItemType): string | null {
  switch (t) {
    case 'drawing_page':
      return 'drawing_pages';
    case 'shape':
      return 'shapes';
    case 'boq_item':
      return 'boq_items';
    case 'project':
      return 'projects';
  }
}

// ─── Material prices (Step 2.9) ────────────────────────────────────────

export async function listMaterialPrices(
  province?: string,
): Promise<AdminMaterialPrice[]> {
  const client = requireSupabase();
  let q = client
    .from('material_prices')
    .select('*')
    .order('province')
    .order('item');
  if (province) q = q.eq('province', province);
  const { data, error } = await q;
  if (error) throw new Error(`โหลดราคาวัสดุไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as AdminMaterialPrice[];
}

export async function upsertMaterialPrice(
  item: Partial<AdminMaterialPrice> & {
    province: string;
    item: string;
    unit: string;
    price: number;
  },
): Promise<void> {
  const client = requireSupabase();
  const row = {
    id: item.id ?? crypto.randomUUID(),
    province: item.province,
    item: item.item,
    unit: item.unit,
    price: item.price,
    source: item.source ?? 'manual',
    fetched_at: item.fetched_at ?? new Date().toISOString(),
  };
  const { error } = await client
    .from('material_prices')
    .upsert(row, { onConflict: 'province,item,unit' });
  if (error) throw new Error(`บันทึกราคาวัสดุไม่สำเร็จ: ${error.message}`);
}

export async function deleteMaterialPrice(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('material_prices').delete().eq('id', id);
  if (error) throw new Error(`ลบรายการไม่สำเร็จ: ${error.message}`);
}

/**
 * ดึงราคา 1 รายการ จาก (province + item ที่ตรงกัน) — ใช้ใน BOQ table suggest
 */
export async function findMaterialPrice(
  province: string,
  itemName: string,
): Promise<AdminMaterialPrice | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('material_prices')
    .select('*')
    .eq('province', province)
    .ilike('item', `%${itemName}%`)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as AdminMaterialPrice | null;
}
