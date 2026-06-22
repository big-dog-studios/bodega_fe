import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import App from './App';
import './i18n';
import { initAnalytics } from './lib/analytics';
import { initDb } from './lib/db';
import { startSync } from './lib/sync';

void initAnalytics();

if (Capacitor.getPlatform() === 'web') {
  jeepSqlite(window);
  await customElements.whenDefined('jeep-sqlite');
  document.body.appendChild(document.createElement('jeep-sqlite'));
  await new SQLiteConnection(CapacitorSQLite).initWebStore();
}

// Open the local DB + run the schema before anything renders/queries it.
await initDb();

// Populate/refresh the cache in the background, and re-sync on reconnect.
// Not awaited — the app renders immediately on whatever's already cached.
void startSync();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);