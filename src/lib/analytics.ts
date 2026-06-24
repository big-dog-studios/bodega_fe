/**
 * Thin wrapper over Amplitude. One place to init + emit events, so call sites
 * stay simple and analytics is a no-op when no key is configured (e.g. local
 * dev), keeping dev noise out of the production project.
 *
 * The key is a client-side ingestion key (it ships in the bundle) — set it via
 * VITE_AMPLITUDE_API_KEY in the env files, same pattern as the API config.
 */
import * as amplitude from '@amplitude/analytics-browser';
import { Capacitor } from '@capacitor/core';
import { getDeviceId } from './device';

const AMPLITUDE_API_KEY: string | undefined = import.meta.env.VITE_AMPLITUDE_API_KEY;

let enabled = false;

/**
 * The browser SDK always stamps `platform: Web` because it only sees the
 * webview — it can't tell it's wrapped in a native Capacitor shell. This
 * enrichment plugin overrides `platform` from Capacitor's runtime check so
 * native installs report `iOS`/`Android`. Web is left as the SDK's default.
 */
function platformOverridePlugin(): amplitude.Types.EnrichmentPlugin {
  const native = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'
  const platform = native === 'ios' ? 'iOS' : native === 'android' ? 'Android' : null;
  return {
    name: 'capacitor-platform-override',
    type: 'enrichment',
    setup: async () => undefined,
    execute: async (event) => {
      if (platform) event.platform = platform;
      return event;
    },
  };
}

/**
 * Initialize Amplitude once at app start. No-ops if no key is set. Resolves the
 * user id first and passes it as Amplitude's userId so every event is attributed
 * from the start (no anonymous→identified switch mid-session). Events fired
 * before this resolves are dropped by the `enabled` guard in track().
 */
export async function initAnalytics(): Promise<void> {
  if (enabled || !AMPLITUDE_API_KEY) return;
  const userId = await getDeviceId();
  amplitude.add(platformOverridePlugin());
  amplitude.init(AMPLITUDE_API_KEY, {
    userId,
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
