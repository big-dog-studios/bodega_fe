/**
 * Submission queue: durable, offline-tolerant writes (the mirror of `sync.ts`).
 *
 * Reports are written to the local `submissions` table first, then POSTed. If
 * the device is offline (or drops mid-flush) the row stays `pending` and a later
 * trigger retries it — so a report is never lost just because the network was
 * down. Online users see no difference: the enqueue triggers an immediate flush,
 * so the POST goes out in the same breath.
 */
import { Network } from '@capacitor/network';
import { submitReport } from './api';
import {
  deleteSubmission,
  enqueueSubmissionRow,
  getPendingSubmissions,
  recordSubmissionFailure,
} from './db';
import type { Report } from './types';

/** Server rejections (got an HTTP status) count toward this; after it, give up. */
const MAX_ATTEMPTS = 5;

/** A File stored in the queue: base64 bytes plus the metadata FormData needs. */
interface SerializedFile {
  name: string;
  type: string;
  /** base64-encoded file bytes (no data-URL prefix). */
  data: string;
}

/** A Report with its File fields swapped for serializable forms, so it's JSON-safe. */
interface SerializedReport extends Omit<Report, 'receipt' | 'photos'> {
  receipt: SerializedFile | null;
  photos: SerializedFile[];
}

/** File → base64 (Files can't be JSON-stringified; the bytes have to be inlined). */
function serializeFile(file: File): Promise<SerializedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      // readAsDataURL gives "data:<type>;base64,<bytes>" — keep only the bytes.
      resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] ?? '' });
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

/** base64 → File, rebuilding what `submitReport` appends to its FormData. */
function deserializeFile(s: SerializedFile): File {
  const binary = atob(s.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], s.name, { type: s.type });
}

/** Rebuild a live Report (with real File objects) from a stored payload. */
function deserializeReport(payload: string): Report {
  const s = JSON.parse(payload) as SerializedReport;
  return {
    ...s,
    receipt: s.receipt ? deserializeFile(s.receipt) : null,
    photos: s.photos.map(deserializeFile),
  };
}

/**
 * Queue a report, then try to send it immediately. Resolves once it's safely in
 * the local DB — that's the durable point, online or off. The actual POST is
 * fire-and-forget (the flush), so the UI can confirm without waiting on network.
 */
export async function enqueueSubmission(report: Report): Promise<void> {
  const payload: SerializedReport = {
    ...report,
    receipt: report.receipt ? await serializeFile(report.receipt) : null,
    photos: report.photos ? await Promise.all(report.photos.map(serializeFile)) : [],
  };
  await enqueueSubmissionRow(JSON.stringify(payload), new Date().toISOString());
  // Covers the "already online" case: no reconnect event will fire, so push now.
  void flushSubmissionsOnce();
}

/**
 * POST every pending submission, oldest first. No-op when offline. A server
 * rejection counts as an attempt (and is abandoned after MAX_ATTEMPTS so one bad
 * row can't loop forever); a transport error means we likely dropped offline
 * mid-flush, so stop and let the next trigger retry the rest untouched.
 */
export async function flushSubmissions(): Promise<void> {
  if (!(await Network.getStatus()).connected) return;

  for (const row of await getPendingSubmissions()) {
    try {
      await submitReport(deserializeReport(row.payload));
      await deleteSubmission(row.id);
    } catch (err) {
      // submitReport throws `API <status> …` on an HTTP rejection; anything else
      // (fetch/TypeError) is a transport failure.
      if (err instanceof Error && /^API \d/.test(err.message)) {
        await recordSubmissionFailure(row.id, err.message, row.attempts + 1 >= MAX_ATTEMPTS);
      } else {
        break;
      }
    }
  }
}

/** Coalesce concurrent flush triggers (enqueue, startup, reconnect) into one pass. */
let inFlight: Promise<void> | null = null;
export function flushSubmissionsOnce(): Promise<void> {
  inFlight ??= flushSubmissions().finally(() => (inFlight = null));
  return inFlight;
}

/**
 * Start draining the queue: flush once on startup, then again whenever the
 * device regains connectivity. Fire-and-forget; failures are swallowed so the
 * app keeps running and the rows just wait for the next pass.
 */
export async function startSubmissions(): Promise<void> {
  await flushSubmissionsOnce().catch((err) => console.warn('[submissions] flush failed', err));
  await Network.addListener('networkStatusChange', (status) => {
    if (status.connected)
      void flushSubmissionsOnce().catch((err) => console.warn('[submissions] flush failed', err));
  });
}
