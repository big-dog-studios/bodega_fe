/**
 * Local SQLite store. One connection, opened once; runs on native (real SQLite)
 * and on web (sql.js wasm, set up in main.tsx). Callers `await initDb()` at
 * startup, then use the read/write helpers below.
 */
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { SCHEMA } from './schema';
import type { Bbox, Store, StoreFilters, StorePin } from '../types';

const DB_NAME = 'bodega';
const isWeb = Capacitor.getPlatform() === 'web';

let sqlite: SQLiteConnection;
let db: SQLiteDBConnection;

/** Boolean → SQLite integer (null stays null). */
const bit = (v: unknown): number | null => (v == null ? null : v ? 1 : 0);

/** StoreFilters key → boolean column it constrains. */
const FLAG_COLUMNS: Record<string, string> = {
  has_snap: 'has_snap',
  has_tobacco: 'has_tobacco',
  has_lottery: 'has_lottery',
  has_quick_draw: 'has_quick_draw',
  has_prepared_food: 'has_prepared_food',
  has_cat: 'has_cat',
  has_atm: 'has_atm',
  has_wic: 'has_wic',
  takeout: 'takeout',
  delivery: 'delivery',
};

/** Open the connection (reusing one if it survived a hot reload) and run the schema. */
export async function initDb(): Promise<void> {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  db = exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute(SCHEMA);
}

export function getDb(): SQLiteDBConnection {
  return db;
}

/** Web keeps the DB in memory; flush it to IndexedDB so writes survive reload. No-op on native. */
async function persist(): Promise<void> {
  if (isWeb) await sqlite.saveToStore(DB_NAME);
}

/** How many stores are cached — lets the sync decide full pull vs. delta. */
export async function storeCount(): Promise<number> {
  const res = await db.query('SELECT COUNT(*) AS n FROM stores;');
  return (res.values?.[0]?.n as number | undefined) ?? 0;
}

/** Build IN(?, ?, …) statements to delete a set of licenses, chunked by param limit. */
function deleteByLicense(table: string, licenses: string[], chunk: number) {
  const set: { statement: string; values: unknown[] }[] = [];
  for (let i = 0; i < licenses.length; i += chunk) {
    const ids = licenses.slice(i, i + chunk);
    set.push({
      statement: `DELETE FROM ${table} WHERE license_number IN (${ids.map(() => '?').join(',')});`,
      values: ids,
    });
  }
  return set;
}

const STORE_COLUMNS =
  'license_number, dba, lat, lon, has_snap, has_tobacco, has_lottery, has_quick_draw, ' +
  'has_prepared_food, has_wic, has_atm, has_cat, alc_class, takeout, delivery, updated_at, data';

/**
 * Apply a batch of stores from sync: upsert visible ones (and their hours),
 * delete any flagged `is_hidden`. Uses multi-row INSERTs (a few hundred
 * statements for a full 8k pull, not ~72k) so the wasm write doesn't lock the
 * main thread. Flushed to IndexedDB once at the end (web only).
 */
export async function saveStores(stores: Store[]): Promise<void> {
  const visible = stores.filter((s) => !s.is_hidden);
  const hidden = stores.filter((s) => s.is_hidden);
  const set: { statement: string; values: unknown[] }[] = [];

  // Prune hidden stores and their hours.
  if (hidden.length) {
    const ids = hidden.map((s) => s.license_number);
    set.push(...deleteByLicense('stores', ids, 400), ...deleteByLicense('store_hours', ids, 400));
  }

  // Stores: multi-row upsert. 17 cols × 200 rows = 3400 binds, well under SQLite's limit.
  const STORE_CHUNK = 200;
  for (let i = 0; i < visible.length; i += STORE_CHUNK) {
    const chunk = visible.slice(i, i + STORE_CHUNK);
    const values: unknown[] = [];
    for (const s of chunk) {
      values.push(
        s.license_number, s.dba, s.lat, s.lon,
        bit(s.has_snap), bit(s.has_tobacco), bit(s.has_lottery), bit(s.has_quick_draw),
        bit(s.has_prepared_food), bit(s.has_wic), bit(s.has_atm), bit(s.has_cat),
        s.alc_class, bit(s.takeout), bit(s.delivery), s.updated_at, JSON.stringify(s),
      );
    }
    const rows = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    set.push({ statement: `INSERT OR REPLACE INTO stores (${STORE_COLUMNS}) VALUES ${rows};`, values });
  }

  // Hours: clear the stores we're touching, then bulk-insert their rows.
  set.push(...deleteByLicense('store_hours', visible.map((s) => s.license_number), 400));
  const hourRows = visible.flatMap((s) =>
    (s.hours ?? []).map((h) => [s.license_number, h.dow, h.open_min, h.close_min] as const),
  );
  const HOUR_CHUNK = 400; // 4 cols × 400 = 1600 binds
  for (let i = 0; i < hourRows.length; i += HOUR_CHUNK) {
    const chunk = hourRows.slice(i, i + HOUR_CHUNK);
    set.push({
      // OR REPLACE: the feed can carry a duplicate (license, dow) — overwrite, don't throw.
      statement: `INSERT OR REPLACE INTO store_hours (license_number, dow, open_min, close_min) VALUES ${chunk
        .map(() => '(?,?,?,?)')
        .join(',')};`,
      values: chunk.flat(),
    });
  }

  if (set.length) await db.executeSet(set, true);
  await persist();
}

/** Pins within the bbox, narrowed by feature filters. Unbounded — the map's WebGL layer handles the full set. */
export async function getPins(bbox: Bbox, filters?: StoreFilters): Promise<StorePin[]> {
  const [west, south, east, north] = bbox;
  const where = ['lon BETWEEN ? AND ?', 'lat BETWEEN ? AND ?'];
  const values: unknown[] = [west, east, south, north];
  const f = (filters ?? {}) as Record<string, unknown>;

  for (const [key, col] of Object.entries(FLAG_COLUMNS)) {
    if (f[key]) where.push(`${col} = 1`);
  }
  if (filters?.has_alcohol) where.push('alc_class IS NOT NULL');
  // has_products can't be evaluated offline (no local catalog) — ignored.
  if (filters?.is_open) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // JS Sun=0 → API Mon=0
    const minute = now.getHours() * 60 + now.getMinutes();
    where.push(`EXISTS (
      SELECT 1 FROM store_hours h
      WHERE h.license_number = stores.license_number AND h.dow = ?
        AND h.open_min IS NOT NULL AND h.close_min IS NOT NULL
        AND ((h.open_min <= h.close_min AND ? >= h.open_min AND ? < h.close_min)
          OR (h.open_min >  h.close_min AND (? >= h.open_min OR  ? < h.close_min))))`);
    values.push(dow, minute, minute, minute, minute);
  }

  const res = await db.query(
    `SELECT license_number, dba, lat, lon FROM stores WHERE ${where.join(' AND ')};`,
    values,
  );
  return (res.values ?? []) as StorePin[];
}

/** Full record for the detail sheet, or null if not cached. */
export async function getStore(license: string): Promise<Store | null> {
  const res = await db.query('SELECT data FROM stores WHERE license_number = ?;', [license]);
  const data = res.values?.[0]?.data as string | undefined;
  return data ? (JSON.parse(data) as Store) : null;
}

/** Delta cursor (last `server_time`), or null before the first sync. */
export async function getCursor(): Promise<string | null> {
  const res = await db.query("SELECT value FROM sync_meta WHERE key = 'cursor';");
  return (res.values?.[0]?.value as string | undefined) ?? null;
}

export async function setCursor(value: string): Promise<void> {
  await db.run("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('cursor', ?);", [value]);
  await persist();
}

/** A queued report awaiting POST. `payload` is the serialized submission JSON. */
export interface SubmissionRow {
  id: number;
  payload: string;
  attempts: number;
}

/** Queue a serialized submission for later POST. `createdAt` is an ISO timestamp. */
export async function enqueueSubmissionRow(payload: string, createdAt: string): Promise<void> {
  await db.run(
    "INSERT INTO submissions (payload, status, attempts, created_at) VALUES (?, 'pending', 0, ?);",
    [payload, createdAt],
  );
  await persist();
}

/** Pending submissions, oldest first — the order the flush should send them. */
export async function getPendingSubmissions(): Promise<SubmissionRow[]> {
  const res = await db.query(
    "SELECT id, payload, attempts FROM submissions WHERE status = 'pending' ORDER BY id ASC;",
  );
  return (res.values ?? []) as SubmissionRow[];
}

/** Drop a submission once the server has accepted it. */
export async function deleteSubmission(id: number): Promise<void> {
  await db.run('DELETE FROM submissions WHERE id = ?;', [id]);
  await persist();
}

/** Record a failed attempt; flip to 'failed' (stop retrying) once retries run out. */
export async function recordSubmissionFailure(
  id: number,
  error: string,
  giveUp: boolean,
): Promise<void> {
  await db.run(
    'UPDATE submissions SET attempts = attempts + 1, last_error = ?, status = ? WHERE id = ?;',
    [error, giveUp ? 'failed' : 'pending', id],
  );
  await persist();
}
