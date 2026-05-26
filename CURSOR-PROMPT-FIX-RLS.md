# 🔧 Cursor Prompt — แก้ RLS Policy Error "new row violates row-level security policy"

> คัดลอกทั้งหมดนี้วางใน Cursor

---

## ปัญหา

เมื่อกดบันทึกโปรเจกต์หรืออัปโหลด PDF ขึ้น error:
```
upload "Attach_TOR_1.pdf" ไม่สำเร็จ: new row violates row-level security policy
```

สาเหตุ: RLS policy ใน Supabase บล็อก INSERT เพราะ:
1. ถ้าใช้ dev-bypass-auth → Supabase client ไม่มี auth session จริง → `auth.uid()` = null → policy ปฏิเสธ
2. หรือ policy ที่สร้างไว้ไม่ครอบคลุม INSERT operation

---

## วิธีแก้ (ทำ 2 อย่าง)

### 1. สร้างไฟล์ SQL สำหรับแก้ RLS policies

สร้างไฟล์ `supabase/fix-rls-policies.sql` ที่มีเนื้อหาดังนี้:

```sql
-- ============================================================
-- Fix RLS Policies — อนุญาต INSERT/UPDATE/DELETE สำหรับ authenticated users
-- รันใน Supabase SQL Editor: https://supabase.com/dashboard/project/buklxcucghgwxqpmkybt/sql
-- ============================================================

-- 1. ตรวจสอบ table ที่มี RLS เปิดอยู่
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 2. แก้ policy สำหรับทุก table ที่เกี่ยวข้อง

-- === projects table ===
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON projects;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON projects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON projects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON projects;

CREATE POLICY "Enable insert for authenticated users" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable select for authenticated users" ON projects
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users" ON projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for authenticated users" ON projects
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- === files / documents table (ถ้ามี) ===
-- ทำเหมือนกันสำหรับทุก table ที่มีในโปรเจกต์

-- === boq_items table (ถ้ามี) ===

-- === ถ้าต้องการเปิด public access ชั่วคราว (สำหรับ dev เท่านั้น) ===
-- WARNING: ห้ามใช้ใน production!
-- ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE files DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE boq_items DISABLE ROW LEVEL SECURITY;
```

### 2. แก้โค้ด — ให้ handle RLS error + แสดงวิธีแก้

แก้ไฟล์ที่เกี่ยวกับ Supabase upload/save ให้:

**A. เช็ค auth session ก่อน save:**
```typescript
// ก่อน insert ทุกครั้ง เช็คว่ามี session จริง
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // ถ้า dev-bypass-auth → ไม่มี session → ต้อง save local แทน
  console.warn('[save] No Supabase session — saving locally only');
  // save to localStorage/IndexedDB แทน
  return saveLocal(data);
}
```

**B. ถ้า RLS error → fallback เป็น local save + แสดง toast ที่ชัดเจน:**
```typescript
try {
  const { error } = await supabase.from('table').insert(data);
  if (error) {
    if (error.message.includes('row-level security')) {
      toast.error('บันทึกไม่ได้: ต้อง Login ก่อน หรือแก้ RLS policy ใน Supabase');
      console.error('[save] RLS blocked — user:', session?.user?.id, 'table:', tableName);
      // Fallback: save locally
      return saveLocal(data);
    }
    throw error;
  }
} catch (err) {
  // ...
}
```

**C. ถ้าเป็น file upload ไป Supabase Storage:**
```typescript
// เช็คว่า Storage bucket มี policy ที่อนุญาตด้วย
// ไปที่ Supabase Dashboard → Storage → Policies → สร้าง policy:
// - Bucket: project-files (หรือชื่อที่ใช้)
// - Operation: INSERT
// - Policy: authenticated users can upload
```

### 3. ทางเลือก — ปิด RLS ชั่วคราว (dev only)

ถ้าต้องการทดสอบเร็ว ให้เพิ่มปุ่มใน UI (dev mode เท่านั้น):

```typescript
// ใน dev mode แสดงข้อความแนะนำ
if (import.meta.env.DEV && error?.message?.includes('row-level security')) {
  toast.error(
    'RLS Error — ไปที่ Supabase SQL Editor รัน:\n' +
    'ALTER TABLE [ชื่อtable] DISABLE ROW LEVEL SECURITY;',
    { duration: 10000 }
  );
}
```

---

## 4. ข้อกำหนด

- ตรวจสอบทุก table ที่มีในโปรเจกต์ (projects, files, boq_items, etc.)
- สร้าง SQL file ที่ถูกต้องตาม table schema จริง
- ถ้า table ใช้ `user_id` → policy ต้อง match `auth.uid() = user_id`
- ถ้า table ไม่มี `user_id` → ใช้ policy ที่อ้างผ่าน join (เช่น files → projects.user_id)
- dev-bypass-auth ต้อง fallback เป็น local save อัตโนมัติ (ไม่ error)
- แสดงทุก table name + RLS status ใน console เมื่อ app เริ่ม
- สร้างคำสั่ง SQL ที่ถูกต้อง 100% สำหรับ copy-paste ไปรันใน SQL Editor
