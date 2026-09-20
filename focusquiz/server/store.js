// Session history. Uses Supabase when SUPABASE_URL + SUPABASE_SERVICE_KEY are set,
// otherwise a JSON file so the prototype runs with zero setup.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, 'data', 'sessions.json');
const MAX_FILE_ROWS = 200;

let sb = null;
function supa() {
  if (sb) return sb;
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  }
  return sb;
}

export const storageKind = () => (supa() ? 'supabase' : 'file');

async function readFileRows() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return [];
  }
}

const shape = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  focusScore: r.focus_score,
  totalMs: Number(r.total_ms),
  summary: r.summary
});

export async function saveSession(clientId, summary) {
  const row = {
    client_id: clientId,
    focus_score: Math.round(summary.focusScore),
    total_ms: Math.round(summary.totalMs),
    summary
  };
  const db = supa();
  if (db) {
    const { data, error } = await db.from('sessions').insert(row).select().single();
    if (error) throw new Error(error.message);
    return shape(data);
  }
  const rows = await readFileRows();
  const saved = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
  rows.push(saved);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows.slice(-MAX_FILE_ROWS), null, 2));
  return shape(saved);
}

export async function listSessions(clientId, limit = 20) {
  const db = supa();
  if (db) {
    const { data, error } = await db
      .from('sessions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data.map(shape);
  }
  const rows = await readFileRows();
  return rows
    .filter((r) => r.client_id === clientId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .map(shape);
}
