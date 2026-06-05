import { test, expect, beforeEach, vi } from 'vitest';
import {
  getLastProjectId,
  setLastProjectId,
  clearLastProjectId,
} from './lastProject';

// stub localStorage ถ้า env ไม่มี (vitest node) — test logic ได้ทุก env
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

beforeEach(() => localStorage.clear());

test('ไม่มีคีย์ → null', () => {
  expect(getLastProjectId()).toBeNull();
});

test('set → get คืนค่าเดิม', () => {
  setLastProjectId('proj-123');
  expect(getLastProjectId()).toBe('proj-123');
});

test('clear → null', () => {
  setLastProjectId('proj-123');
  clearLastProjectId();
  expect(getLastProjectId()).toBeNull();
});

test('string ว่าง → null (กัน id เพี้ยน)', () => {
  setLastProjectId('');
  expect(getLastProjectId()).toBeNull();
});
