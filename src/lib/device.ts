import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

/**
 * A stable-per-install device identifier.
 *
 * `Device.getId()` already gives one on native (iOS `identifierForVendor`,
 * Android a persisted UUID) — both reset on uninstall/reinstall, which is fine.
 * But on web it returns a fresh UUID every call, so we persist the first value
 * in Preferences and reuse it. The result is one consistent id on every platform.
 *
 * Note: on native, Preferences is wiped on reinstall too, so this never extends
 * the id's lifetime beyond the OS value — it only makes web stable.
 */
const KEY = 'device_id';

// In-memory cache so repeat calls in a session skip the async plugin hops.
let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  const stored = await Preferences.get({ key: KEY });
  if (stored.value) {
    cached = stored.value;
    return cached;
  }

  const { identifier } = await Device.getId();
  await Preferences.set({ key: KEY, value: identifier });
  cached = identifier;
  return identifier;
}
