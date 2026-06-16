/**
 * Pure helpers + types for the store-hours picker. The picker edits a list of
 * day groups (runs of weekdays sharing one schedule) and serializes them to a
 * JSON string that rides along in the report's existing `hours` field.
 */

/** Day labels, Monday-first. Index 0 = Mon … 6 = Sun. */
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Minutes in a day; times are stored as minutes past midnight (0–1440). */
export const MINUTES_IN_DAY = 1440;

/** A schedule kind: explicit open/close window, always-open, or closed. */
export type HoursMode = 'hours' | '24' | 'closed';

/** One run of days sharing a schedule. `open`/`close` are present only for `hours`. */
export interface HoursGroup {
  /** Day indices (0 = Mon … 6 = Sun). */
  days: number[];
  mode: HoursMode;
  /** Minutes past midnight; omitted for `24`/`closed` (the times are meaningless there). */
  open?: number;
  close?: number;
}

/** Shape stored as JSON in the report `hours` field. Versioned for future migration. */
export interface HoursValue {
  v: 1;
  groups: HoursGroup[];
}

/** Minutes → "9:00 AM". Midnight (0 or 1440) renders as "12:00 AM". */
export function formatTime(min: number): string {
  const m = ((min % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const meridiem = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm < 10 ? `0${mm}` : mm} ${meridiem}`;
}

/** Compress sorted day indices into ranges, e.g. [0,1,2,4] → "Mon–Wed, Fri". */
export function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  const flush = () => {
    parts.push(start === prev ? DAY_LABELS[start] : `${DAY_LABELS[start]}–${DAY_LABELS[prev]}`);
  };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    flush();
    start = prev = sorted[i];
  }
  flush();
  return parts.join(', ');
}

/** Human label for a group's schedule, e.g. "9:00 AM – 9:00 PM" / "Open 24 hours". */
export function formatGroupHours(group: HoursGroup): string {
  if (group.mode === '24') return 'Open 24 hours';
  if (group.mode === 'closed') return 'Closed';
  return `${formatTime(group.open ?? 0)} – ${formatTime(group.close ?? 0)}`;
}

/** One-line summary across all groups, ordered by their earliest day. */
export function summarize(groups: HoursGroup[]): string {
  return [...groups]
    .sort((a, b) => Math.min(...a.days) - Math.min(...b.days))
    .map((g) => `${formatDays(g.days)} ${formatGroupHours(g)}`)
    .join(' · ');
}

/** Serialize groups to the JSON string posted in `hours`; '' when nothing is set. */
export function serialize(groups: HoursGroup[]): string {
  if (groups.length === 0) return '';
  const value: HoursValue = { v: 1, groups };
  return JSON.stringify(value);
}

/** Parse the `hours` JSON back into groups; returns [] for empty or non-JSON values. */
export function deserialize(json: string | null | undefined): HoursGroup[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Partial<HoursValue>;
    if (parsed && Array.isArray(parsed.groups)) {
      return parsed.groups.filter(
        (g): g is HoursGroup => !!g && Array.isArray(g.days) && g.days.length > 0,
      );
    }
  } catch {
    // Not our JSON (e.g. a legacy free-text summary) — start the picker empty.
  }
  return [];
}
