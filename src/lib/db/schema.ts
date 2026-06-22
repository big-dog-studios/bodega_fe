/**
 * SQLite schema. `CREATE TABLE IF NOT EXISTS` so it's safe to run on every open.
 *
 * `stores` keeps typed columns only for what we filter/sort on (bbox + flags),
 * plus a `data` blob holding the full Store JSON — so the detail sheet renders
 * offline without rebuilding the record column-by-column. `store_hours` is split
 * out so the "open now" filter can evaluate it in SQL.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS stores (
  license_number TEXT PRIMARY KEY,
  dba TEXT,
  lat REAL,
  lon REAL,
  has_snap INTEGER,
  has_tobacco INTEGER,
  has_lottery INTEGER,
  has_quick_draw INTEGER,
  has_prepared_food INTEGER,
  has_wic INTEGER,
  has_atm INTEGER,
  has_cat INTEGER,
  alc_class INTEGER,
  takeout INTEGER,
  delivery INTEGER,
  updated_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stores_lonlat ON stores (lon, lat);

CREATE TABLE IF NOT EXISTS store_hours (
  license_number TEXT NOT NULL,
  dow INTEGER NOT NULL,
  open_min INTEGER,
  close_min INTEGER,
  PRIMARY KEY (license_number, dow)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;
