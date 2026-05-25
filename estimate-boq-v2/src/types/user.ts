/**
 * User & RBAC types — sync กับ supabase/migrations/20260525120000_init.sql
 * ห้ามแก้ field โดยไม่อัปเดต migration ด้วย
 */

export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';
