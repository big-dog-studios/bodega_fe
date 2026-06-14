import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bodega.app',
  appName: 'Bodega Finder',
  webDir: 'dist',
  plugins: {
    // The Cloud Run API sends no CORS headers, so a webview fetch from
    // capacitor://localhost (iOS) / http://localhost (Android) would be blocked.
    // Patch fetch/XHR to go through the native HTTP layer, which isn't subject to CORS.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
