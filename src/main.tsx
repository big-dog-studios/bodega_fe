import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import App from './App';
import './i18n';
import { initAnalytics } from './lib/analytics';

void initAnalytics();

if (Capacitor.getPlatform() === 'web') {
  jeepSqlite(window);
  await customElements.whenDefined('jeep-sqlite');
  document.body.appendChild(document.createElement('jeep-sqlite'));
  await new SQLiteConnection(CapacitorSQLite).initWebStore();
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);