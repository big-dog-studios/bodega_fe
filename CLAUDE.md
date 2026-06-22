# CLAUDE.md — Frontend (map app)

Project instructions for `frontend/`. A hybrid (iOS/Android/web) map app that shows bodega
pins from the read API and a detail sheet on tap. Read this before working in this folder.

## What this is

A thin client over the Map API (`api/`). Core loop: the map reports its visible bounds →
fetch pins for that viewport → render them → tap a pin → fetch + show that store's full
record. No heavy local logic; the server owns the data, the client owns the map + UI.

## Stack

- **Capacitor** — hybrid shell. The app is a web app that packages to native iOS/Android,
  and also runs as a plain web app. Native projects are real source you can open.
- **React + Ionic** — Ionic gives native-feeling mobile UI (sheets, transitions, tabs) so it
  doesn't feel like a website. React chosen over Angular for the mature map wrappers and the
  React-first Capacitor/Ionic ecosystem; keep it minimal — no heavy state libs for this size.
- **MapLibre GL** via **react-map-gl** — WebGL map. (Mapbox GL works the same via the same
  wrapper if you want their tiles/styles; MapLibre is the open default.)
- **@capacitor/geolocation** — device location for "near me" (the one native API this app uses).

## The core loop (most important part)

```
map settles (idle/moveend)
  → read map.getBounds()                 // SDK gives lat/lng
  → debounce ~250ms                      // fast pan = ONE request, not ten
  → pad bounds ~20%                      // pre-load a margin so panning edges aren't empty
  → GET /stores?bbox=west,south,east,north   // bbox = [W, S, E, N] = lon,lat order!
  → render returned pins
tap pin → GET /stores/{license_number} → open detail sheet
```

Three things that bite map clients (carry these):
- **Axis order:** the SDK hands you `{lat, lng}`; the API bbox is `lon` first
  (`[sw.lng, sw.lat, ne.lng, ne.lat]`). Convert at the fetch call so it's explicit.
- **Debounce** the idle/moveend event (~250ms) — don't fetch on every frame of a drag.
- **Pad** the bbox ~20% beyond the viewport so a small pan doesn't reveal empty edges.

## Markers — let the GPU draw them

DOM/HTML markers (`<div>` per pin) get sluggish in a webview past a few hundred. The viewport
bbox query + `LIMIT 2000` already caps how many you render, but still use MapLibre's **native
symbol/circle layer** (GPU/WebGL) to draw pins, NOT HTML overlay markers. Feed the API
response in as a GeoJSON source and render a `circle`/`symbol` layer. This keeps it smooth on
device even near the 2000-pin cap. HTML markers only for the one selected/active pin, if at all.

## Detail sheet

On tap, fetch `GET /stores/{license_number}` and present an Ionic sheet/modal with the store's
flags. The API returns booleans (`has_snap`, `has_tobacco`, `has_lottery`, `has_quick_draw`,
`has_prepared_food`) and `alc_class` (int; `NULL` = no alcohol, else a class code the API maps
to a label). Render these as simple badges — "Beer", "SNAP/EBT", "Lottery", "Deli", "Cigarettes".
Catalog/price will come later from the same detail response once that layer exists.

## API contract (this is what the app depends on)

- `GET /stores?bbox=W,S,E,N` → `[{ license_number, dba, lat, lon }, ...]` (light pins).
- `GET /stores/{license_number}` → full record (identity + flags + alc_class + coords).
- Base URL = the Cloud Run Service for `api/`. Keep it in one config/env value, not inline.
- If the API shape changes, update `api/CLAUDE.md` and this contract together.

## Geolocation

`@capacitor/geolocation` for "find bodegas near me": get the device position, center the map
there, let the normal bbox loop fetch pins. It's a native permission on iOS/Android — request
it on user action (a "locate me" button), not on app launch. Web falls back to the browser
geolocation API automatically through the same plugin.

## Localization (i18n)

UI strings are localized with **react-i18next**. `src/i18n/index.ts` inits it and
auto-detects the device language from `navigator.languages` (primary subtag, e.g.
`zh-CN`→`zh`), falling back to English. No in-app language switcher by design.

- **Catalogs:** `src/i18n/locales/{en,es,zh,ru,bn,el,ht,ko}.json`. `en.json` is the
  source of truth + fallback; keep all locales key-complete with it.
- **Usage:** `const { t } = useTranslation()` → `t('detail.call')`. Outside components
  (pure helpers like `hours.ts`) use the default `i18n` instance: `i18n.t(...)`.
- **Shared feature labels** live under `features.*`; filters/badges/questions reference
  them by `labelKey`, so add a new feature's label once there.
- **Don't translate** analytics event names (`track('Call Tapped')`) — those are fixed keys.
- Non-English catalogs were machine-translated; flag for native review before relying on them.

## Analytics

Amplitude via a thin wrapper in `src/lib/analytics.ts`. `initAnalytics()` runs once
in `main.tsx`; `track('Event Name', { ...props })` emits custom events. Both **no-op
when `VITE_AMPLITUDE_API_KEY` is unset** (local dev), so call sites stay unconditional.

- Event names are fixed English string keys (`'Directions Opened'`) — never localize them.
- The key is a client-side ingestion key (ships in the bundle); set per env like the API URL.

## Notes / conduct

- This app only reads the public API; nothing here touches the delivery-scraping layer. Keep
  that separation — the frontend has no business calling Uber endpoints.
- Start as the web app, add Capacitor native builds when you want App Store / device testing;
  Capacitor doesn't force that decision early.

## Status / next steps

- [ ] Scaffold Capacitor + React + Ionic; add MapLibre via react-map-gl.
- [ ] Map with the bbox-on-idle loop (read bounds → debounce → pad → fetch → render).
- [ ] Render pins as a WebGL circle/symbol layer from a GeoJSON source (not HTML markers).
- [ ] Detail sheet on tap → `GET /stores/{license_number}` → flag badges.
- [ ] `@capacitor/geolocation` "locate me" button (permission on user action).
- [ ] API base URL in env/config; one place to point at the Cloud Run Service.
- [ ] Later: clustering at low zoom (mirror server clusters or MapLibre's cluster layer);
      catalog/price in the detail sheet once that layer lands.