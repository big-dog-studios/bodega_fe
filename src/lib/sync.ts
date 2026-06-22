/**
 * Store sync: keep the local SQLite cache in step with the server.
 *
 * Ties the HTTP feed (`api.getSyncStores`) to the local DB. Full snapshot when
 * nothing is cached (first launch, or web after an in-memory reset); otherwise
 * an incremental delta from the saved cursor. Either way the cursor advances to
 * the server's clock so the next run only asks for what changed.
 */
import { Network } from '@capacitor/network';
import { getSyncStores } from './api';
import { getCursor, saveStores, setCursor, storeCount } from './db';

/** Sentinel `since` for a full snapshot — everything updated after the epoch. */
const EPOCH = '1970-01-01T00:00:00+00:00';

/** Skip a sync if the last one landed within this window (cursor = last server_time). */
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Run one sync pass. Returns how many store rows were applied (upserted or
 * pruned). Throws on network/HTTP failure — callers offline should catch and
 * fall back to whatever's already cached.
 */
export async function syncStores(signal?: AbortSignal): Promise<number> {
  // No cached rows ⇒ force a full pull even if a stale cursor lingers (web reset).
  const cursor = (await storeCount()) > 0 ? await getCursor() : null;

  // Throttle: if we already have data and synced < 10 min ago, do nothing.
  if (cursor && Date.now() - Date.parse(cursor) < MIN_SYNC_INTERVAL_MS) return 0;

  const since = cursor ?? EPOCH;
  const { stores, server_time } = await getSyncStores(since, signal);
  if (stores.length) await saveStores(stores);
  await setCursor(server_time);
  return stores.length;
}

/**
 * Coalesce concurrent sync triggers (startup, reconnect, a manual refresh) into
 * one in-flight pass. The single chokepoint every caller should go through.
 */
let inFlight: Promise<number> | null = null;
export function syncStoresOnce(): Promise<number> {
  inFlight ??= syncStores().finally(() => (inFlight = null));
  return inFlight;
}

/**
 * Start keeping the cache fresh: sync once on startup, then again whenever the
 * device regains connectivity. Fire-and-forget. Failures are swallowed so the
 * app keeps running on whatever's already cached.
 */
export async function startSync(): Promise<void> {
  await syncStoresOnce().catch((err) => console.warn('[sync] failed', err));
  await Network.addListener('networkStatusChange', (status) => {
    if (status.connected) void syncStoresOnce().catch((err) => console.warn('[sync] failed', err));
  });
}
