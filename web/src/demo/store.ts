import { persister, queryClient } from '@/lib/query-client';
import { createSeed, DEMO_DB_VERSION } from './seed';
import type { DemoDb } from './types';

const STORAGE_KEY = 'demoDb';

let db: DemoDb | null = null;

function load(): DemoDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoDb;
    return parsed.version === DEMO_DB_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDb(current: DemoDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage cheio/bloqueado (ex.: aba privada): a demo segue só em memória.
  }
}

export function getDb(): DemoDb {
  if (db) return db;
  const loaded = load() ?? createSeed(new Date());
  saveDb(loaded);
  db = loaded;
  return db;
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem acesso ao storage: o reload abaixo já recomeça do seed em memória.
  }
  db = null;
  persister.removeClient();
  queryClient.clear();
  window.location.assign('/');
}
