/**
 * Thin wrapper over the native Spotlight plugin (ios/App/App/SpotlightPlugin.swift).
 * No-ops everywhere except iOS, so call sites stay unconditional.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SpotlightItem {
  /** Stable unique id, also the deep-link target: `bodega:{license}` / `filter:{key}`. */
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  /** Grouping id so a whole set can be cleared at once (viewed / favorites / categories). */
  domain: string;
}

interface SpotlightPluginDef {
  index(options: { items: SpotlightItem[] }): Promise<void>;
  delete(options: { ids: string[] }): Promise<void>;
  clear(options: { domain: string }): Promise<void>;
}

const isNative = Capacitor.getPlatform() === 'ios';
const Spotlight = registerPlugin<SpotlightPluginDef>('Spotlight');

export async function spotlightIndex(items: SpotlightItem[]): Promise<void> {
  if (!isNative || items.length === 0) return;
  try {
    await Spotlight.index({ items });
  } catch {
    // Best-effort — indexing failures must never surface to the user.
  }
}

export async function spotlightDelete(ids: string[]): Promise<void> {
  if (!isNative || ids.length === 0) return;
  try {
    await Spotlight.delete({ ids });
  } catch {
    /* ignore */
  }
}

export async function spotlightClear(domain: string): Promise<void> {
  if (!isNative) return;
  try {
    await Spotlight.clear({ domain });
  } catch {
    /* ignore */
  }
}
