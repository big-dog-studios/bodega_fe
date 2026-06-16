/**
 * Thin wrapper over Amplitude. One place to init + emit events, so call sites
 * stay simple and analytics is a no-op when no key is configured (e.g. local
 * dev), keeping dev noise out of the production project.
 *
 * The key is a client-side ingestion key (it ships in the bundle) — set it via
 * VITE_AMPLITUDE_API_KEY in the env files, same pattern as the API config.
 */
import * as amplitude from '@amplitude/analytics-browser';

const AMPLITUDE_API_KEY: string | undefined = import.meta.env.VITE_AMPLITUDE_API_KEY;

let enabled = false;

/** Initialize Amplitude once at app start. No-ops if no key is set. */
export function initAnalytics(): void {
  if (enabled || !AMPLITUDE_API_KEY) return;
  amplitude.init(AMPLITUDE_API_KEY, {
    // Auto-capture sessions + install/attribution; skip noisy DOM autocapture
    // (this is a single-page map app — we emit our own meaningful events below).
    autocapture: {
      sessions: true,
      attribution: true,
      pageViews: false,
      formInteractions: false,
      fileDownloads: false,
      elementInteractions: false,
    },
  });
  enabled = true;
}

/** Emit a custom event. Silent no-op until initAnalytics() succeeds. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  amplitude.track(event, props);
}
