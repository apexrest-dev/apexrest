import fs from 'node:fs';
import path from 'node:path';
import { get, list, num, str, bool, type ApxComponent } from '../../apexlang.ts';
import type { Row } from '../../database.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { parseDate } from './format.ts';
import { rowSubstitute, substituteDeep } from './model.ts';

export interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  className?: string;
  url?: string;
  description?: string;
}

/** Marker replaced in the browser with the clicked date (`&APEX$NEW_START_DATE.`). */
export const NEW_START = 'APEXLOCALNEWSTART';
export const NEW_END = 'APEXLOCALNEWEND';

const SUPPORTED = new Set([
  'displayColumn',
  'startDateColumn',
  'endDateColumn',
  'pkColumn',
  'cssClass',
  'viewEditLink',
  'createLink',
  'supplementalInfo',
  'additionalCalendarViews',
  'calendarViewsAndNavigation',
  'timeFormat',
  'firstHour',
  'showWeekend',
  'maxEventsDay',
  'allDayEventColumn',
  'startOfWeek',
  'firstDayOfWeek',
  'showTime',
]);

function isoOf(value: unknown): { iso: string; date: Date; midnight: boolean } | undefined {
  const date = parseDate(typeof value === 'number' ? String(value) : value);
  if (!date) return undefined;
  const pad = (part: number) => String(part).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const midnight = !date.getHours() && !date.getMinutes() && !date.getSeconds();
  return {
    iso: midnight
      ? day
      : `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    date,
    midnight,
  };
}

const settingColumn = (region: ApxComponent, key: string) =>
  str(region.props, `settings.${key}`).toUpperCase();

export function calendarEvents(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  range: { start?: Date | undefined; end?: Date | undefined } = {},
): { events: CalendarEvent[]; error?: string } {
  const sql = renderer.regionSql(ctx, region);
  if (!sql) return { events: [], error: 'The calendar has no SQL source.' };
  let result = renderer.query(ctx, region, sql, 20_000);
  if (result.error) return { events: [], error: result.error };
  // Auto-created sample tables only know the columns other components asked for; referencing
  // the calendar's columns lets the preview add them with sample values.
  const required = ['displayColumn', 'startDateColumn', 'endDateColumn', 'pkColumn', 'cssClass']
    .map((key) => settingColumn(region, key))
    .filter((column) => column && !result.columns.includes(column));
  if (required.length) {
    const probe = renderer.query(
      ctx,
      region,
      `select * from (${sql}) where 1 = 1 or ${required.map((column) => `"${column}" is null`).join(' or ')}`,
      20_000,
    );
    if (!probe.error) result = renderer.query(ctx, region, sql, 20_000);
  }
  const display = settingColumn(region, 'displayColumn') || result.columns[0] || '';
  const startColumn = settingColumn(region, 'startDateColumn');
  const endColumn = settingColumn(region, 'endDateColumn');
  const allDayColumn = settingColumn(region, 'allDayEventColumn');
  const cssColumn = settingColumn(region, 'cssClass');
  const pkColumn = settingColumn(region, 'pkColumn');
  const supplemental = str(region.props, 'settings.supplementalInfo');
  const viewEdit = get(region.props, 'settings.viewEditLink');
  const events: CalendarEvent[] = [];
  for (const row of result.rows) {
    const start = isoOf(row[startColumn]);
    if (!start) continue;
    const end = endColumn ? isoOf(row[endColumn]) : undefined;
    const allDayValue = allDayColumn ? String(row[allDayColumn] ?? '').toUpperCase() : '';
    const allDay = allDayColumn
      ? ['Y', 'YES', '1', 'TRUE'].includes(allDayValue)
      : start.midnight && (!end || end.midnight);
    let endIso = end?.iso;
    if (end && allDay) {
      // APEX end dates are inclusive; FullCalendar expects an exclusive end for all-day events.
      const next = new Date(end.date);
      next.setDate(next.getDate() + 1);
      endIso = isoOf(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
      )!.iso;
    }
    const stop = end?.date ?? start.date;
    if (range.start && stop < range.start) continue;
    if (range.end && start.date >= range.end) continue;
    const event: CalendarEvent = {
      title: String(row[display] ?? ''),
      start: allDay ? start.iso.slice(0, 10) : start.iso,
      allDay,
    };
    if (endIso) event.end = allDay ? endIso.slice(0, 10) : endIso;
    if (pkColumn && row[pkColumn] !== undefined) event.id = String(row[pkColumn]);
    if (cssColumn && row[cssColumn]) event.className = String(row[cssColumn]);
    if (viewEdit !== undefined) event.url = renderer.link(ctx, substituteDeep(viewEdit, row), row);
    if (supplemental) event.description = rowSubstitute(supplemental, row as Row);
    events.push(event);
  }
  return { events };
}

/** The date the calendar opens on: today when it has events nearby, else the closest event. */
export function initialDate(events: CalendarEvent[], today = new Date()): string {
  if (!events.length) return isoOf(today.toISOString().slice(0, 10))!.iso;
  const month = (date: Date) => date.getFullYear() * 12 + date.getMonth();
  const dates = events.map((event) => parseDate(event.start.replace('T', ' '))!).filter(Boolean);
  if (dates.some((date) => month(date) === month(today))) return isoOf(today.toISOString().slice(0, 10))!.iso;
  const upcoming = dates.filter((date) => date >= today).sort((a, b) => a.getTime() - b.getTime())[0];
  const latest = dates.sort((a, b) => b.getTime() - a.getTime())[0]!;
  return isoOf(upcoming ?? latest)!.iso.slice(0, 10);
}

export function fullCalendarScript(renderer: ApexRenderer): string | undefined {
  const root = path.join(renderer.assets.imagesDir, 'libraries', 'fullcalendar');
  try {
    const versions = fs
      .readdirSync(root)
      .filter((entry) => fs.existsSync(path.join(root, entry, 'dist', 'index.global.min.js')))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const version = versions.at(-1);
    return version ? `#APEX_FILES#libraries/fullcalendar/${version}/dist/index.global.min.js` : undefined;
  } catch {
    return undefined;
  }
}

const VIEW_NAMES: Record<string, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  list: 'listMonth',
};

const options = (region: ApxComponent, key: string): string[] | undefined => {
  if (get(region.props, `settings.${key}`) === undefined) return undefined;
  return list(region.props, `settings.${key}`)
    .flatMap((value) => String(value).split(/[\s:,]+/u))
    .map((value) => value.toLowerCase())
    .filter(Boolean);
};

/**
 * FullCalendar views and the prev/next/today navigation, as APEX derives them: with `showTime`
 * the `calendarViewsAndNavigation` checkboxes (default month, week, day, list, navigation),
 * otherwise the month view plus `additionalCalendarViews` (default list, navigation). An explicit
 * `calendarViewsAndNavigation` is honoured without `showTime` as well.
 */
export function calendarViews(region: ApxComponent): { views: string[]; navigation: boolean } {
  const timed = bool(region.props, 'settings.showTime', false);
  const combined = options(region, 'calendarViewsAndNavigation');
  const additional = options(region, 'additionalCalendarViews');
  const chosen =
    timed || (combined && !additional)
      ? (combined ?? ['month', 'week', 'day', 'list', 'navigation'])
      : ['month', ...(additional ?? ['list', 'navigation'])];
  const views = ['month', 'week', 'day', 'list']
    .filter((view) => chosen.includes(view))
    .map((view) => VIEW_NAMES[view]!);
  return { views: views.length ? views : ['dayGridMonth'], navigation: chosen.includes('navigation') };
}

export function renderCalendar(renderer: ApexRenderer, ctx: RenderContext, region: ApxComponent): string {
  const domId = renderer.regionDomId(region);
  const settings = get(region.props, 'settings');
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const ignored = Object.keys(settings).filter((key) => !SUPPORTED.has(key));
    if (ignored.length)
      renderer.diagnose(
        'info',
        `Calendar ${region.id}: settings ${ignored.join(', ')} not simulated locally`,
        ctx.pageId,
        region.id,
      );
  }
  if (bool(region.props, 'settings.dragAndDrop', false))
    renderer.diagnose(
      'info',
      `Calendar ${region.id}: drag and drop is shown but changes are not saved locally`,
      ctx.pageId,
      region.id,
    );
  if (str(region.props, 'componentAdvanced.initJavaScriptFunction'))
    renderer.diagnose(
      'info',
      `Calendar ${region.id}: the initialization JavaScript function is not applied locally`,
      ctx.pageId,
      region.id,
    );
  const { events, error } = calendarEvents(renderer, ctx, region);
  if (error) renderer.diagnose('warning', `Calendar ${region.id}: ${error}`, ctx.pageId, region.id);
  const { views, navigation } = calendarViews(region);
  const create = get(region.props, 'settings.createLink');
  let createUrl: string | undefined;
  if (create !== undefined) {
    const marker = { APEX$NEW_START_DATE: NEW_START, APEX$NEW_END_DATE: NEW_END };
    const withMarkers = substituteDeep(create, marker as unknown as Row);
    createUrl = renderer.link(ctx, withMarkers);
  }
  const config = {
    region: region.id,
    initialDate: initialDate(events),
    navigation,
    views,
    list: views.includes('listMonth'),
    timeFormat: str(region.props, 'settings.timeFormat'),
    firstHour: num(region.props, 'settings.firstHour', 8),
    weekends: bool(region.props, 'settings.showWeekend', true),
    maxEvents: num(region.props, 'settings.maxEventsDay', 0) || undefined,
    firstDay: num(region.props, 'settings.startOfWeek', num(region.props, 'settings.firstDayOfWeek', 0)),
    createUrl,
    error,
    count: events.length,
  };
  return `<div class="apex-local-calendar" id="${escapeHtml(domId)}_calendar" data-calendar="${escapeHtml(JSON.stringify(config))}"></div>`;
}
