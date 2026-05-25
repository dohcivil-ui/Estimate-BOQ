# คู่มือสร้าง Supabase Project + Google OAuth

> ใช้กับ Step 2.1 ของ `estimate-boq-v2/` ตาม `../HANDOFF-v2.md` ส่วน 5
> ใช้เวลาประมาณ 15–25 นาที ทำครั้งเดียว

---

## ภาพรวม

```
Browser (Vite)
   │ VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
   ▼
Supabase Auth (Google OAuth) ───→ Postgres (RLS) ───→ Storage (PDF/JPG)
   │
   └────→ Edge Function ──┐
                          │ ANTHROPIC_API_KEY (secret, server-only)
                          ▼
                   Claude Sonnet API
```

**Frontend ใช้ public anon key** + RLS ป้องกัน
**Edge Function** เป็นที่เดียวที่เห็น `ANTHROPIC_API_KEY` (Step 2.5)

---

## 1. สร้าง Supabase Project

1. ไปที่ <https://supabase.com> → "New project"
2. กรอก:
   - **Name**: `estimate-boq-v2`
   - **Database Password**: รหัสยาวๆ (เก็บไว้ในที่ปลอดภัย)
   - **Region**: `Southeast Asia (Singapore)` — ใกล้ไทยที่สุด
   - **Pricing**: Free tier พอใช้ในการพัฒนา
3. รอประมาณ 2 นาที จน status เป็น "Ready"

---

## 2. ดึง URL + anon key

ใน Dashboard ไปที่:
- **Project Settings** → **API**
- คัดลอก 2 ค่า:
  - `Project URL` → `VITE_SUPABASE_URL`
  - `anon public` key → `VITE_SUPABASE_ANON_KEY`

ในเครื่องของคุณ:

```bash
cd estimate-boq-v2
cp .env.example .env.local
# แล้วเปิด .env.local เติมค่าทั้ง 2 ค่าจากด้านบน
```

**อย่าใส่ `service_role` key ลง frontend เด็ดขาด** — มันข้าม RLS ทุก policy

---

## 3. รัน Migration เพื่อสร้างตาราง + RLS

มี 2 วิธี เลือกอย่างใดอย่างหนึ่ง:

### วิธี A — ผ่าน Dashboard (เร็วสุด, แนะนำสำหรับครั้งแรก)

1. ไปที่ **SQL Editor** ใน Supabase Dashboard
2. กด "New query"
3. รัน **ตามลำดับ**:
   - `supabase/migrations/20260525120000_init.sql` — schema หลัก + RLS
   - `supabase/migrations/20260525130000_drawing_files_and_storage.sql` — drawing_files + Storage policies
4. คัดลอกเนื้อหา **ทั้งไฟล์** ของแต่ละ migration ไปวาง แล้วกด **Run**
5. ดู output — ต้องไม่มี error สีแดง

ตรวจว่าสำเร็จ:
- ไปที่ **Database** → **Tables** จะเห็น 8 tables:
  `profiles, projects, drawing_pages, shapes, boq_items, ai_analyses, material_prices, delete_requests`
- คลิกแต่ละ table → tab **Policies** → ต้องมี policy ครบ

### วิธี B — ผ่าน Supabase CLI (ถ้าจะใช้ migration ต่อในอนาคต)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>
supabase db push
```

`<YOUR-PROJECT-REF>` เอามาจาก URL ของ project เช่น
`https://abcdefgh.supabase.co` → ref คือ `abcdefgh`

---

## 4. ตั้ง Google OAuth Provider

### 4.1 สร้าง Google OAuth Client

1. เปิด <https://console.cloud.google.com>
2. สร้าง project ใหม่ (หรือใช้ของเดิม)
3. ไปที่ **APIs & Services** → **Credentials**
4. กด **+ CREATE CREDENTIALS** → **OAuth client ID**
5. ถ้ายังไม่ได้ตั้ง OAuth consent screen — ระบบจะให้ตั้งก่อน เลือก **External**, ใส่ชื่อ app + email ผู้ดูแล + ไม่ต้อง add scope อะไร, กด save ทั้งหมด
6. กลับมาที่ Create OAuth client ID:
   - **Application type**: Web application
   - **Name**: `estimate-boq-v2`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (สำหรับ dev)
     - `https://YOUR-DOMAIN.com` (เพิ่มภายหลังตอน deploy)
   - **Authorized redirect URIs**:
     - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
       (เปลี่ยน `<YOUR-PROJECT-REF>` ให้ตรงกับของจริง)
7. กด **Create** → จะได้ **Client ID** + **Client Secret** ค้างไว้

### 4.2 ใส่ใน Supabase

1. กลับไปที่ Supabase Dashboard → **Authentication** → **Providers**
2. หา **Google** → กด toggle เปิด
3. ใส่ **Client ID** + **Client Secret** จากด้านบน
4. **Skip nonce check**: ปล่อยปิดไว้
5. กด **Save**

### 4.3 ตั้ง redirect URL ของ Supabase

ใน Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `http://localhost:5173` (จะเปลี่ยนเป็น production URL ตอน deploy)
- **Redirect URLs**: เพิ่ม `http://localhost:5173/**` (มี wildcard `**` ท้าย)

---

## 5. ตั้ง Storage Bucket (สำหรับ Step 2.6 — save/load project)

Migration `20260525130000_drawing_files_and_storage.sql` จะสร้าง bucket อัตโนมัติ
แต่ถ้าจะตรวจให้ดู: **Storage** → ต้องมี bucket **drawings** (private)

Storage RLS policies ถูกตั้งใน migration เดียวกัน:
- **Read/Write**: เฉพาะ owner ของ project นั้น (หรือ admin)
- **Path convention**: `drawings/{project_id}/{file_id}/{filename}`

---

## 6. ทดสอบ

```bash
cd estimate-boq-v2
npm run dev
# เปิด http://localhost:5173
```

ในหน้าเว็บ:
1. ถ้า `.env.local` ตั้งถูก → status pill บน TopBar จะกลายเป็น **เขียว "Supabase: ok"**
2. กด **เข้าสู่ระบบด้วย Google** บนหน้า login
3. หลังอนุญาตแล้ว → จะกลับมาที่ app พร้อม user
4. ไปที่ Supabase Dashboard → **Authentication** → **Users** จะเห็นบัญชีคุณ
5. ไปที่ **Database** → **Tables** → `profiles` จะเห็น row ใหม่ พร้อม `role='user'`

---

## 7. ตั้งคนแรกให้เป็น admin

โดย default ทุกคนได้ `role='user'` ตั้ง admin คนแรกผ่าน SQL:

ใน Supabase **SQL Editor** รัน:

```sql
update public.profiles
   set role = 'admin'
 where email = 'your.email@gmail.com';

-- ตรวจสอบ
select id, email, role from public.profiles;
```

หลังจากนี้ admin คนนั้นสามารถเปลี่ยน role ของคนอื่นผ่าน admin panel (Step 2.8) ได้

---

## 8. Troubleshooting

| อาการ | แก้ |
|---|---|
| `Supabase: not configured` ไม่หาย | ตรวจ `.env.local` ว่าไม่ได้เผลอใส่ทับใน `.env.example` และ restart `npm run dev` |
| OAuth redirect แล้วเด้งกลับเป็น error | ตรวจ Authorized redirect URIs ใน Google Cloud ว่าตรงกับ `https://<ref>.supabase.co/auth/v1/callback` เป๊ะ (รวม https ไม่ใช่ http) |
| Login สำเร็จ แต่ user ปรากฏใน auth.users แต่ไม่มีใน profiles | trigger `on_auth_user_created` ไม่ได้สร้าง — ลองเปิด **SQL Editor** รัน `select * from public.profiles where id = auth.uid();` ถ้าว่างให้รัน migration ใหม่ |
| RLS error "new row violates row-level security policy" | ตรวจว่า `auth.uid()` ใน query เท่ากับ `owner_id` หรือไม่ ถ้าไม่ใช่เจ้าของก็ต้องเป็น admin |
| Migration fail "type user_role already exists" | enum สร้างไปแล้ว — ปลอดภัย ข้ามได้ migration เขียน guard ไว้แล้ว |

---

## 9. รายการ tables + RLS ที่สร้างใน migration นี้

| Table | Purpose | Read | Write | Delete |
|---|---|---|---|---|
| `profiles` | extends `auth.users` + role | self หรือ admin | self (ห้ามเปลี่ยน role) | admin |
| `projects` | โปรเจกต์ของผู้ใช้ | owner หรือ admin | owner หรือ admin | **admin เท่านั้น** |
| `drawing_pages` | หน้าแบบในแต่ละ project | via project | via project | via project |
| `shapes` | รูปวาด/วัด | via project | owner | **admin เท่านั้น** |
| `boq_items` | รายการ BOQ | via project | owner | **admin เท่านั้น** |
| `ai_analyses` | log การเรียก Claude | via project | service-role only | service-role only |
| `material_prices` | ราคาวัสดุไกด์ (global) | authenticated all | admin | admin |
| `delete_requests` | คำขอลบ | self หรือ admin | self (insert), admin (review) | — |

> Helper: `public.is_admin()` ใช้ตรวจ role ของ user ปัจจุบัน — เรียกใน RLS policy ได้

---

## 10. Deploy Edge Function `analyze-drawing` (Step 2.5)

### 10.1 ติดตั้ง Supabase CLI

```bash
npm install -g supabase
supabase --version
```

### 10.2 Login + Link project

```bash
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>
```

`<YOUR-PROJECT-REF>` = ตัวอักษรหน้า `.supabase.co` ใน URL

### 10.3 ตั้ง secrets

```bash
# จำเป็น (ขั้นต่ำ)
supabase secrets set QWEN_API_KEY=sk-your-dashscope-key

# ปรับ model ได้ (default: qwen3.5-flash)
supabase secrets set QWEN_MODEL=qwen3.5-flash
supabase secrets set QWEN_MODEL_HD=qwen-vl-max

# endpoint default = DashScope International
# supabase secrets set QWEN_ENDPOINT=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

> หาก API key หมดอายุหรือผิด — `analyze-drawing` จะ return 500 พร้อมข้อความบอก

### 10.4 Deploy function

```bash
cd estimate-boq-v2
supabase functions deploy analyze-drawing --no-verify-jwt
```

> `--no-verify-jwt` ถูกใส่เพราะ function ตรวจ JWT เอง (เรียก `auth.getUser(token)`)

ตรวจสอบ:
```bash
supabase functions list
# ต้องเห็น: analyze-drawing | LATEST
```

### 10.5 รัน function local (ก่อน deploy ได้)

```bash
cd estimate-boq-v2
cp supabase/functions/.env.example supabase/functions/.env
# แก้ .env เติม QWEN_API_KEY จริง

supabase functions serve analyze-drawing --env-file supabase/functions/.env
```

Frontend ของคุณจะเรียก local function อัตโนมัติถ้าตั้ง `VITE_SUPABASE_URL` เป็น
`http://127.0.0.1:54321` (supabase CLI default)

### 10.6 DEV-only direct mode (ข้าม Edge Function)

ตอนทดสอบเร็วๆ ก่อน deploy คุณสามารถให้ frontend เรียก Qwen ตรงได้ (INSECURE):

```bash
# .env.local
VITE_DEV_BYPASS_AUTH=true
VITE_QWEN_API_KEY_DEV=sk-xxx     # ⚠️ key หลุดมา browser
```

**ห้ามใช้กับ production deploy เด็ดขาด** — API key จะหลุดทุกคน

### 10.7 ทดสอบ

1. เปิด app → กด `🤖 AI วิเคราะห์` ใน TopBar
2. AI panel ขึ้น → กด `🤖 วิเคราะห์หน้านี้`
3. รอ ~3-10 วินาที (มี spinner)
4. ผลลัพธ์: summary + table elements + ✓/✕ ต่อแถว
5. กด ✓ → BOQ tab เห็นรายการที่สร้างจาก element นั้นๆ

ตรวจ log:
- Supabase → Edge Functions → `analyze-drawing` → Logs
- Database → ai_analyses → จะมี row ใหม่ (ถ้า project_id ถูกส่ง)

---

## 11. ทำต่อ

- [ ] **2.6** Storage bucket policy + sync projects/shapes/boq เข้า DB
- [ ] **2.7** Custom GPT Actions REST endpoint
- [ ] **2.8** Admin Panel + delete requests UI
