/**
 * Store sync: keep the local SQLite cache in step with the server.
 *
 * Ties the HTTP feed (`api.getSyncStores`) to the local DB. Full snapshot when
 * nothing is cached (first launch, or web after an in-memory reset); otherwise
 * an incremental delta from the saved cursor. Either way the cursor advances to
 * the server's clock so the next run only asks for what changed.
 */
import { getSyncStores } from './api';
import { getCursor, saveStores, setCursor, storeCount } from './db';

/** Sentinel `since` for a full snapshot — everything updated after the epoch. */
const EPOCH = '1970-01-01T00:00:00+00:00';

/**
 * Run one sync pass. Returns how many store rows were applied (upserted or
 * pruned). Throws on network/HTTP failure — callers offline should catch and
 * fall back to whatever's already cached.
 */
export async function syncStores(signal?: AbortSignal): Promise<number> {
  // No cached rows ⇒ force a full pull even if a stale cursor lingers (web reset).
  const cached = await storeCount();
  const since = (cached > 0 ? await getCursor() : null) ?? EPOCH;

  const { stores, server_time } = await getSyncStores(since, signal);
  if (stores.length) await saveStores(stores);
  await setCursor(server_time);
  return stores.length;
}
