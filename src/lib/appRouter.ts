/**
 * Native → web deep-link channel. Any native entry point (Spotlight result,
 * App Intent / Siri, universal link) routes the app here via the AppRouter
 * plugin (ios/App/App/AppDelegate.swift). No-ops off iOS.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppRouterPluginDef {
  addListener(
    eventName: 'openRoute',
    listenerFunc: (event: { route: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const isNative = Capacitor.getPlatform() === 'ios';
const AppRouter = registerPlugin<AppRouterPluginDef>('AppRouter');

/**
 * Subscribe to native "open this route" events. Routes are opaque strings the
 * app's router understands (e.g. `bodega:{license}`, `filter:{key}`, `nearby`).
 * Returns an unsubscribe fn.
 */
export function onAppOpenRoute(cb: (route: string) => void): () => void {
  if (!isNative) return () => {};
  let handle: { remove: () => Promise<void> } | undefined;
  void AppRouter.addListener('openRoute', (e) => cb(e.route)).then((h) => {
    handle = h;
  });
  return () => {
    void handle?.remove();
  };
}
