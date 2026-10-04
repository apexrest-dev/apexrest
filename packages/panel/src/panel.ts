import type { PanelSnapshot } from '../../core/src/panel.ts';
import type { PanelAction } from '../../core/src/panel-schema.ts';
import logo from '../../../plugins/apexrest-apex/assets/apexrest-logo.svg';
import { CompositionJobs, ReviewRequests } from './composer-jobs.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const element = document.createElement(tag);
  element.className = cls;
  element.textContent = text;
  return element;
};
const human = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const active = (status: string) => ['running', 'queued', 'cancelling'].includes(status);
const badge = (value: string) =>
  node(
    'span',
    'badge ' +
      (['completed', 'pass', 'passed', 'approve', 'succeeded', 'live'].includes(value)
        ? 'good'
        : active(value)
          ? 'running'
          : ['failed', 'fail', 'blocked', 'verification_failed', 'outcome_unknown', 'unavailable'].includes(
                value,
              )
            ? 'bad'
            : ['not_run', 'cancelled'].includes(value)
              ? 'warn'
              : ''),
    human(value),
  );
const empty = (message: string) => node('div', 'empty', message);
const card = (title: string, content: HTMLElement, subtitle?: string) => {
  const box = node('div', 'card'),
    heading = node('div', 'section-heading'),
    label = node('div');
  label.append(node('h2', '', title));
  if (subtitle) label.append(node('p', 'subtle', subtitle));
  heading.append(label);
  box.append(heading, content);
  return box;
};
const kv = (items: [string, unknown][]) => {
  const dl = node('dl');
  for (const [key, value] of items) {
    const row = node('div', 'kv');
    row.append(node('dt', '', key), node('dd', '', value == null ? 'Not available' : String(value)));
    dl.append(row);
  }
  return dl;
};
const codeDetails = (title: string, value: unknown) => {
  const d = node('details');
  d.append(node('summary', '', title), node('pre', '', JSON.stringify(value, null, 2)));
  return d;
};
const notice = (message: string, error = false) => {
  const box = $('notice');
  box.hidden = !message;
  box.classList.toggle('error', error);
  box.textContent = message;
};

const launch = new URLSearchParams(location.hash.slice(1));
let snapshot: PanelSnapshot | undefined,
  busy = false,
  connected = false,
  initialized = false,
  sqlclDirty = false,
  sqlclSignature = '',
  preferencesDirty = false,
  preferencesSignature = '';
let bridgeProject: string | undefined,
  bridgeReady = false,
  requestId = 0;
let currentView = 'overview',
  savedConnectionsState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle',
  savedConnectionNames: string[] = [],
  savedConnectionsError = '';
const embedded = window.parent !== window;
// Global SQLcl execution and restriction settings are not exposed to Codex
// tools; only the local dashboard or the terminal can change them.
const embeddedSqlclNote =
  'Change SQLcl settings in the local dashboard (apexrest_panel_open) or with apexrest sqlcl configure.';
const token = launch.get('session') ?? '';
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();
function bridge(method: string, params: unknown): Promise<unknown> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Codex did not answer the panel request.'));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}
window.addEventListener('message', (event) => {
  if (event.source !== window.parent || !embedded || !event.data || event.data.jsonrpc !== '2.0') return;
  const message = event.data;
  const waiter = pending.get(message.id);
  if (waiter) {
    clearTimeout(waiter.timer);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(String(message.error.message)));
    else waiter.resolve(message.result);
  }
  if (
    message.method === 'ui/notifications/tool-input' &&
    typeof message.params?.arguments?.project === 'string'
  )
    bridgeProject = message.params.arguments.project;
  if (message.method === 'ui/notifications/tool-result') {
    const result = message.params?._meta?.['apexrest/panelResult'] ?? message.params?.structuredContent;
    if (typeof result?.data?.project === 'string') bridgeProject = result.data.project;
    if (bridgeProject) void refresh();
  }
});
async function api(action?: PanelAction): Promise<unknown> {
  if (embedded) {
    if (action?.kind === 'connection' && action.password)
      throw new Error('Enter the password in the local dashboard or use CLI --password-file.');
    if (action?.kind === 'sqlcl') throw new Error(embeddedSqlclNote);
    if (!bridgeReady || !bridgeProject) throw new Error('Waiting for the Codex workspace context.');
    const response = (await bridge('tools/call', {
      name: action ? 'apexrest_panel_action' : 'apexrest_panel_status',
      arguments: {
        project: bridgeProject,
        ...(action ? { action } : {}),
      },
    })) as {
      _meta?: { 'apexrest/panelResult'?: { ok: boolean; summary: string; data: unknown } };
      structuredContent?: { ok: boolean; summary: string; data: unknown };
      content?: { type: string; text?: string }[];
    };
    const envelope =
      response._meta?.['apexrest/panelResult'] ??
      response.structuredContent ??
      JSON.parse(response.content?.find((c) => c.type === 'text')?.text ?? '{}');
    if (!envelope.ok) throw new Error(envelope.summary ?? 'Codex rejected this panel action.');
    return envelope.data;
  }
  const response = await fetch(action ? '/api/action' : '/api/status', {
    method: action ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      ...(action ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(action ? { body: JSON.stringify(action) } : {}),
    signal: AbortSignal.timeout(action?.kind === 'saved-connections' ? 60000 : 15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.summary ?? result.error ?? 'The local panel request failed.');
  return result;
}
function renderSavedConnections(selected = input('connection-direct').value) {
  const select = $<HTMLSelectElement>('connection-direct'),
    current = snapshot?.connections[input('connection-ref').value.trim()]?.name,
    selectedCurrent = !!current && selected === current,
    names = [
      ...new Set([...savedConnectionNames, ...(current ? [current] : []), ...(selected ? [selected] : [])]),
    ];
  const placeholder = node('option', '', 'Choose a saved connection');
  placeholder.value = '';
  select.replaceChildren(
    placeholder,
    ...names.map((name) => {
      const retained = !savedConnectionNames.includes(name);
      const label =
        retained && savedConnectionsState === 'loaded'
          ? `${name} · ${name === current ? 'current mapping' : 'previous selection'} (not in SQLcl list)`
          : retained && name === current
            ? `${name} · current mapping`
            : name;
      const option = node('option', '', label);
      option.value = name;
      return option;
    }),
  );
  select.value = selected;
  select.disabled = savedConnectionsState === 'loading';
  const status = $('saved-connections-status');
  status.dataset.state = savedConnectionsState;
  status.textContent =
    savedConnectionsState === 'loading'
      ? 'Loading saved connections from SQLcl…'
      : savedConnectionsState === 'error'
        ? 'Could not load saved SQLcl connections. ' + savedConnectionsError + ' Use Retry to try again.'
        : savedConnectionsState === 'loaded'
          ? savedConnectionNames.length
            ? `${savedConnectionNames.length} saved SQLcl connection${savedConnectionNames.length === 1 ? '' : 's'} loaded.${selectedCurrent && !savedConnectionNames.includes(current) ? ' The current mapping is retained even though SQLcl did not list it.' : ''}`
            : 'No saved SQLcl connections found. Save a direct connection in SQLcl, then refresh.' +
              (selectedCurrent ? ' The current mapping is retained.' : '')
          : snapshot && !snapshot.trusted
            ? 'Trust this project before loading saved SQLcl connections.'
            : 'Saved connections load when you open Direct connection settings.';
  $('saved-connections-refresh').textContent =
    savedConnectionsState === 'loading'
      ? 'Loading…'
      : savedConnectionsState === 'error'
        ? 'Retry'
        : savedConnectionsState === 'idle'
          ? 'Load saved connections'
          : 'Refresh saved connections';
  controls();
}
async function loadSavedConnections(force = false) {
  if (
    !connected ||
    !snapshot?.trusted ||
    busy ||
    savedConnectionsState === 'loading' ||
    (!force && savedConnectionsState === 'loaded')
  )
    return;
  savedConnectionsState = 'loading';
  savedConnectionsError = '';
  renderSavedConnections();
  try {
    const result = (await api({ kind: 'saved-connections' })) as {
      source?: unknown;
      connections?: { name?: unknown }[];
    };
    if (
      result.source !== 'sqlcl-store' ||
      !Array.isArray(result.connections) ||
      result.connections.some((connection) => typeof connection?.name !== 'string' || !connection.name)
    )
      throw new Error('SQLcl returned an invalid connection list.');
    savedConnectionNames = result.connections.map((connection) => connection.name as string);
    savedConnectionsState = 'loaded';
  } catch (error) {
    savedConnectionsState = 'error';
    savedConnectionsError = error instanceof Error ? error.message : String(error);
  }
  renderSavedConnections();
}
let selectedBlock = '',
  blueprintReview: Extract<PanelAction, { kind: 'blueprint-add' }> | undefined,
  composeJob = '',
  reviewedPlan: { plan: string; planDigest: string } | undefined;
type CompositionResponse = {
  job: { status: string; result?: { data?: { status: string; plan: string; planDigest: string } } };
  materializable: boolean;
};
const compositionJobs = new CompositionJobs<CompositionResponse>(
  async (id) => (await api({ kind: 'compose-status', id })) as CompositionResponse,
  (response) => {
    notice('');
    $('compose-review').textContent = JSON.stringify(response.job, null, 2);
  },
  controls,
  (error, paused) => {
    notice(
      (error instanceof Error ? error.message : String(error)) +
        (paused
          ? ' Job outcome is unknown. Retry job status to continue observing the same operation.'
          : ' Retrying the existing job status.'),
      true,
    );
  },
);
const blueprintReviews = new ReviewRequests();

function controls() {
  const canAct = connected && !!snapshot?.trusted && !busy;
  for (const id of ['validate', 'run-tests', 'plan', 'open-browser'])
    $<HTMLButtonElement>(id).disabled = !canAct || !snapshot?.configured;
  for (const form of ['catalog-search', 'catalog-add', 'sqlcl-form', 'connection-form', 'preferences-form'])
    $(form)
      .querySelectorAll<HTMLButtonElement>('button[type=submit]')
      .forEach((button) => {
        button.disabled = !canAct || (embedded && form === 'sqlcl-form');
      });
  $<HTMLButtonElement>('compose-plan').disabled = !canAct || !snapshot?.configured || compositionJobs.running;
  $('compose-plan').textContent = compositionJobs.pending ? 'Retry job status' : 'Plan and compile offline';
  $<HTMLButtonElement>('compose-materialize').disabled =
    !canAct || !reviewedPlan || compositionJobs.running || !!compositionJobs.pending;
  $<HTMLButtonElement>('compose-cancel').disabled = !canAct || !compositionJobs.pending;
  $<HTMLButtonElement>('blueprint-apply').disabled = !canAct || !blueprintReview;
  $<HTMLButtonElement>('saved-connections-refresh').disabled = !canAct || savedConnectionsState === 'loading';
  $<HTMLButtonElement>('connection-save').disabled =
    !canAct || (input('sqlcl-transport').value === 'direct' && savedConnectionsState === 'loading');
}
async function act(action: PanelAction) {
  if (busy || !connected) return;
  busy = true;
  controls();
  try {
    const result = (await api(action)) as { status?: string; url?: string; nextAction?: string };
    notice(
      action.kind === 'browser'
        ? result.status === 'host_action_required'
          ? 'Open this application in the Codex in-app browser: ' +
            result.url +
            '. Opening it does not verify the application.'
          : 'Verification browser opened. Inspect the affected behavior; opening it does not verify the application.'
        : ['sqlcl', 'connection', 'preferences'].includes(action.kind)
          ? 'Settings saved.'
          : action.kind === 'cancel-job'
            ? 'Stop requested. Existing changes are not rolled back.'
            : 'Operation accepted. Follow its actual status below.',
    );
    if (action.kind === 'preferences') preferencesDirty = false;
    if (action.kind === 'sqlcl') sqlclDirty = false;
    if (action.kind === 'connection') input('connection-ords-password').value = '';
    await refresh();
  } catch (error) {
    notice(error instanceof Error ? error.message : String(error), true);
  } finally {
    busy = false;
    controls();
  }
}
const rendered = new Map<string, string>();
function draw(id: string, data: unknown, render: () => HTMLElement[]) {
  const key = JSON.stringify(data);
  if (rendered.get(id) === key) return;
  // Live polling must not replace a focused control while the user is operating it.
  if ($(id).contains(document.activeElement) && document.activeElement !== document.body) return;
  $(id).replaceChildren(...render());
  rendered.set(id, key);
}
function operations(data: PanelSnapshot) {
  const box = node('div', 'table-wrap');
  if (!data.jobs.length) box.append(empty('No APEX operation jobs recorded for this project.'));
  else {
    const table = node('table'),
      head = node('tr');
    ['Operation', 'Status', 'Result', ''].forEach((s) => head.append(node('th', '', s)));
    const thead = node('thead');
    thead.append(head);
    table.append(thead);
    const body = node('tbody');
    for (const job of data.jobs) {
      const row = node('tr'),
        state = node('td'),
        summary = node('td'),
        action = node('td');
      state.append(badge(job.status));
      summary.append(node('p', '', job.summary || 'Awaiting a result'));
      if (job.diagnostics.length || job.artifacts.length)
        summary.append(
          codeDetails('Diagnostics & artifacts', { diagnostics: job.diagnostics, artifacts: job.artifacts }),
        );
      if (active(job.status)) {
        const stop = node('button', 'danger', 'Stop');
        stop.disabled = !connected || busy || !data.trusted;
        stop.onclick = () => {
          void act({ kind: 'cancel-job', id: job.id });
        };
        action.append(stop);
      }
      row.append(node('td', '', job.operation), state, summary, action);
      body.append(row);
    }
    table.append(body);
    box.append(table);
  }
  const omitted = data.history?.jobsOmitted ?? 0;
  const output = [
    card(
      'Operation jobs',
      box,
      'Compile, export, tests and deployment work' +
        (omitted ? ` · ${omitted} older record${omitted === 1 ? '' : 's'} not shown` : ''),
    ),
  ];
  const sync = node('div');
  for (const entry of data.sync) {
    const row = node('div', 'journal-entry');
    row.append(badge(entry.status), node('p', '', entry.environment));
    if ('exportedAt' in entry) row.append(node('p', 'subtle', 'Initial export: ' + entry.exportedAt));
    if ('lastSuccessfulImport' in entry && entry.lastSuccessfulImport)
      row.append(node('p', 'subtle', 'Latest successful import: ' + entry.lastSuccessfulImport.at));
    if ('blockedReason' in entry && entry.blockedReason) row.append(node('p', '', entry.blockedReason));
    if ('dirty' in entry)
      row.append(node('p', '', entry.dirty ? 'Local edits present' : 'Local checkpoint matches'));
    sync.append(row);
  }
  output.push(card('Working-copy sync', sync, 'Local status only; server freshness is not checked'));
  const deployments = node('div');
  if (!data.deployments.length) deployments.append(empty('No deployment runs recorded.'));
  for (const deployment of data.deployments) {
    const row = node('div', 'journal-entry');
    row.append(
      badge(deployment.status),
      node('p', 'subtle', new Date(deployment.at).toLocaleString()),
      node('pre', '', deployment.details),
    );
    deployments.append(row);
  }
  output.push(
    card(
      'Deployment & import journal',
      deployments,
      'Actual durable runtime state; an unknown outcome remains unknown',
    ),
  );
  return output;
}
function render(data: PanelSnapshot) {
  const connectionsChanged = JSON.stringify(snapshot?.connections) !== JSON.stringify(data.connections);
  snapshot = data;
  connected = true;
  $('project-name').textContent = data.configuration?.application.alias ?? 'Unconfigured workspace';
  $('project-path').textContent = data.project;
  $('version').textContent = data.version;
  $('connection').className = 'badge good';
  $('connection').textContent = 'Live';
  $('updated').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleTimeString();
  $('connection-error').hidden = true;
  document.body.dataset.disconnected = 'false';
  const nextPreferences = JSON.stringify(data.preferences);
  const nextSqlcl = JSON.stringify(data.sqlcl);
  if (!sqlclDirty && nextSqlcl !== sqlclSignature) {
    input('sqlcl-mode').value = data.sqlcl.mode;
    input('sqlcl-level').value = data.sqlcl.mcpRestrictLevel;
    input('sqlcl-transport').value = data.sqlcl.databaseTransport ?? 'direct';
    sqlclControls();
    sqlclSignature = nextSqlcl;
  }
  if (!preferencesDirty && nextPreferences !== preferencesSignature) {
    input('default-browser-mode').value = data.preferences.browserMode;
    preferencesSignature = nextPreferences;
  }
  if (!initialized) {
    initialized = true;
    if (embedded) {
      input('connection-ords-password').disabled = true;
      $('connection-password-note').textContent =
        'Set the password in the local dashboard opened by apexrest panel open, or use CLI --password-file. Passwords are never sent through the embedded Codex panel.';
    }
    const environment = $<HTMLSelectElement>('environment');
    for (const [name, env] of Object.entries(data.configuration?.environments ?? {})) {
      const option = node('option', '', name + ' · ' + env.kind);
      option.value = name;
      environment.append(option);
    }
    if (!data.configured)
      notice(
        'This folder has no apexrest.json. Initialize or open an APEXREST application project to run APEX operations.',
      );
    else if (!data.trusted)
      notice(
        'This project is not trusted in APEXREST. The panel can display its state; actions require the existing project trust setup.',
      );
  }
  draw('connection-refs', [data.connections, data.configuration?.environments], () =>
    Array.from(
      new Set([
        ...Object.keys(data.connections),
        ...Object.values(data.configuration?.environments ?? {}).flatMap((env) => [
          env.readConnectionRef,
          env.deployConnectionRef,
        ]),
      ]),
    ).map((name) => {
      const option = node('option');
      option.value = name;
      return option;
    }),
  );
  draw('metrics', [data.sqlcl, data.jobs, data.deployments, data.trusted], () =>
    [
      ['APEX operations', String(data.jobs.filter((job) => active(job.status)).length), 'Running or queued'],
      ['Recorded deployments', String(data.deployments.length), 'Recent deployment journal entries'],
      ['Project access', data.trusted ? 'Trusted' : 'Read only', 'Existing authorization gates apply'],
      [
        'Database connectivity',
        data.sqlcl.databaseTransport === 'ords' ? 'ORDS HTTP(S)' : 'Direct Oracle',
        data.sqlcl.mode === 'mcp' ? 'SQLcl MCP · restriction ' + data.sqlcl.mcpRestrictLevel : 'SQLcl CLI',
      ],
    ].map(([label, value, sub]) => {
      const box = node('div', 'metric');
      box.append(node('div', 'subtle', label), node('div', 'value', value), node('div', 'subtle', sub));
      return box;
    }),
  );
  draw('overview-live', [data.changes, data.configuration, data.trusted], () => {
    const columns = node('div', 'two-columns'),
      changeBox = node('div');
    changeBox.append(
      data.changes.files.length
        ? node('pre', '', data.changes.files.join('\n'))
        : empty(
            data.changes.status === 'available'
              ? 'No uncommitted Git changes.'
              : 'Git status is unavailable for this folder.',
          ),
    );
    columns.append(
      card(
        'Project context',
        kv([
          ['Application', data.configuration?.application.alias],
          ['Source', data.configuration?.application.sourceDir],
          [
            'Environments',
            Object.keys(data.configuration?.environments ?? {}).join(', ') || 'None configured',
          ],
          ['Required suites', data.configuration?.tests.requiredSuites.join(', ') || 'None declared'],
          ['Trust', data.trusted ? 'Trusted project' : 'Not granted'],
        ]),
      ),
      card('Working changes', changeBox),
    );
    return [
      card(
        'Current Codex session',
        node(
          'p',
          'subtle',
          'Describe changes and review results in your open Codex conversation. This panel runs APEX operations and manages project settings.',
        ),
      ),
      columns,
    ];
  });
  draw('operations-live', [data.jobs, data.deployments, data.sync, busy], () => operations(data));
  draw(
    'settings-live',
    [data.preferences, data.configuration, data.connections, data.toolchain, data.permissions],
    () => {
      const box = node('div');
      box.append(
        card(
          'Project & target settings',
          kv([
            ['Project', data.project],
            ['Source directory', data.configuration?.application.sourceDir],
            ['Artifacts', data.configuration?.artifacts.directory],
            [
              'Artifact retention',
              data.configuration ? data.configuration.artifacts.retentionDays + ' days' : null,
            ],
            ['Required suites', data.configuration?.tests.requiredSuites.join(', ') || 'None declared'],
            ['Automated browser', data.configuration?.tests.defaultBrowser],
            [
              'Verification browser',
              data.preferences.browserMode === 'external'
                ? 'External system browser'
                : 'Codex in-app browser',
            ],
            ['Active deploy/test grants', data.permissions.activeGrants.length],
          ]),
        ),
      );
      for (const [name, env] of Object.entries(data.configuration?.environments ?? {}))
        box.append(
          card(
            name + ' · ' + human(env.kind),
            kv([
              ['Application ID', env.applicationId],
              ['Workspace', env.workspace],
              ['Parsing schema', env.parsingSchema],
              ['Database', env.databaseIdentity.dbUniqueName],
              ['Service', env.databaseIdentity.serviceName],
              ['Read connection', env.readConnectionRef],
              ['Deploy connection', env.deployConnectionRef],
              ['Control mode', env.deploymentControl ?? 'local'],
              ['Application URL', env.baseUrl],
            ]),
          ),
        );
      box.append(
        card(
          'Configuration details',
          codeDetails('Project, toolchain and connection references', {
            configuration: data.configuration,
            toolchain: data.toolchain,
            connectionReferences: data.connections,
            authorization: data.permissions,
          }),
        ),
      );
      return [box];
    },
  );
  if (connectionsChanged) renderSavedConnections();
  controls();
  if (
    currentView === 'settings' &&
    input('sqlcl-transport').value === 'direct' &&
    savedConnectionsState === 'idle'
  )
    void loadSavedConnections();
}
let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    render((await api()) as PanelSnapshot);
    if (reviewedPlan && composeJob) {
      const assessed = (await api({ kind: 'compose-status', id: composeJob })) as { materializable: boolean };
      if (!assessed.materializable) {
        reviewedPlan = undefined;
        $<HTMLButtonElement>('compose-materialize').disabled = true;
      }
    }
  } catch (error) {
    connected = false;
    $('connection').textContent = 'Disconnected';
    $('connection').className = 'badge bad';
    $('connection-error').hidden = false;
    $('connection-error').textContent =
      (error instanceof Error ? error.message : String(error)) +
      (snapshot ? ' Showing the last received state.' : '');
    document.body.dataset.disconnected = 'true';
    controls();
  } finally {
    refreshing = false;
  }
}
const views: Record<string, [string, string]> = {
  overview: ['Workspace overview', 'Project settings and APEX operations for your current Codex session.'],
  operations: ['APEX operations', 'Compile, verify and follow deployment state.'],
  catalog: ['Composer catalog', 'Find blocks, review bindings and compile a local application plan.'],
  settings: ['Workspace settings', 'Inspect configuration, database connections and browser preferences.'],
};
function view(name: string) {
  currentView = name;
  document.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== name;
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    if ((button as HTMLElement).dataset.view === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const titles = views[name]!;
  $('view-title').textContent = titles[0];
  $('view-subtitle').textContent = titles[1];
  if (name === 'settings' && input('sqlcl-transport').value === 'direct') void loadSavedConnections();
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.onclick = () => view(button.dataset.view!);
});
$('refresh').onclick = () => {
  void refresh();
};
$('preferences-form').oninput = () => {
  preferencesDirty = true;
};
$('preferences-form').onsubmit = (event) => {
  event.preventDefault();
  void act({
    kind: 'preferences',
    settings: {
      browserMode: input('default-browser-mode').value as 'codex' | 'external',
    },
  });
};
$('sqlcl-form').onsubmit = (event) => {
  event.preventDefault();
  void act({
    kind: 'sqlcl',
    settings: {
      schemaVersion: 1,
      mode: input('sqlcl-mode').value as 'cli' | 'mcp',
      mcpRestrictLevel: input('sqlcl-level').value as '4' | '1',
      databaseTransport: input('sqlcl-transport').value as 'direct' | 'ords',
    },
  });
};
function sqlclControls() {
  const ords = input('sqlcl-transport').value === 'ords';
  if (ords) input('sqlcl-mode').value = 'cli';
  $<HTMLSelectElement>('sqlcl-mode').querySelector<HTMLOptionElement>('option[value=mcp]')!.disabled = ords;
  input('sqlcl-level').disabled = input('sqlcl-mode').value !== 'mcp';
  $('sqlcl-transport-note').textContent = ords
    ? 'Connect through ORDS over HTTP(S) when the Oracle listener is unavailable. Uses SQLcl CLI and the ORDS settings for each connection reference below.'
    : 'Connect through the Oracle listener using saved SQLcl connections.';
  if (embedded) $('sqlcl-transport-note').textContent += ' ' + embeddedSqlclNote;
  for (const [id, enabled] of [
    ['connection-direct-group', !ords],
    ['connection-ords-group', ords],
  ] as const) {
    const group = $<HTMLFieldSetElement>(id);
    group.hidden = !enabled;
    group.disabled = !enabled;
  }
  input('connection-ords-password').disabled = embedded;
  $('connection-mode-note').textContent = ords
    ? 'Editing ORDS HTTP(S) settings for the selected connection reference.'
    : 'Editing the direct Oracle connection for the selected connection reference.';
  $('connection-save').textContent = ords ? 'Save ORDS connection' : 'Save direct connection';
  controls();
}
$('sqlcl-form').oninput = (event) => {
  sqlclDirty = true;
  sqlclControls();
  if (
    (event.target as HTMLElement).id === 'sqlcl-transport' &&
    input('sqlcl-transport').value === 'direct' &&
    currentView === 'settings'
  )
    void loadSavedConnections();
};
$('saved-connections-refresh').onclick = () => {
  void loadSavedConnections(true);
};
input('connection-direct').onchange = () => renderSavedConnections();
input('connection-ref').onchange = () => {
  const connection = snapshot?.connections[input('connection-ref').value.trim()];
  renderSavedConnections(connection?.name ?? '');
  input('connection-ords-url').value = connection?.ords?.url ?? '';
  input('connection-ords-user').value = connection?.ords?.username ?? '';
  input('connection-ords-password').value = '';
};
$('connection-form').onsubmit = (event) => {
  event.preventDefault();
  const ords = input('sqlcl-transport').value === 'ords',
    sqlclName = input('connection-direct').value,
    ordsUrl = input('connection-ords-url').value.trim(),
    ordsUsername = input('connection-ords-user').value.trim(),
    password = input('connection-ords-password').value;
  if (ords && embedded && password) {
    notice('Enter the password in the local dashboard or use CLI --password-file.', true);
    return;
  }
  if (!ords && !sqlclName) {
    notice('Choose a saved SQLcl connection for this reference.', true);
    return;
  }
  if (ords && (!ordsUrl || !ordsUsername)) {
    notice('Enter the ORDS schema URL and your database username.', true);
    return;
  }
  void act({
    kind: 'connection',
    name: input('connection-ref').value.trim(),
    ...(!ords ? { sqlclName } : { ordsUrl, ordsUsername, ...(password ? { password } : {}) }),
  });
};
$('validate').onclick = () => {
  void act({ kind: 'validate' });
};
$('open-browser').onclick = () => {
  const env = input('environment').value;
  if (!env) {
    notice('Choose an explicit environment before opening its application.', true);
    return;
  }
  void act({ kind: 'browser', env });
};
$('plan').onclick = () => {
  const env = input('environment').value;
  if (!env) {
    notice('Choose an explicit environment before planning a deployment.', true);
    return;
  }
  void act({ kind: 'plan', env });
};
$('run-tests').onclick = () => {
  const suite = input('suite').value as 'unit' | 'sql' | 'api' | 'e2e' | 'all',
    env = input('environment').value;
  if (suite !== 'unit' && !env) {
    notice('Choose an explicit environment for this test suite.', true);
    return;
  }
  void act({ kind: 'test', suite, ...(env ? { env } : {}) });
};
controls();
const initialView = launch.get('view');
if (initialView && views[initialView]) view(initialView);
const mark = document.querySelector('.brand-mark');
if (mark) {
  const icon = node('img');
  icon.src = logo;
  icon.alt = '';
  icon.width = 38;
  icon.height = 38;
  mark.replaceChildren(icon);
}
if (embedded) {
  void bridge('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'apexrest-panel', version: '1.0.0' },
    appCapabilities: {},
  })
    .then(() => {
      bridgeReady = true;
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
      void refresh();
    })
    .catch((error) => notice(String(error), true));
} else void refresh();
function scheduleRefresh() {
  setTimeout(
    () => {
      if (!document.hidden) void refresh();
      scheduleRefresh();
    },
    snapshot?.jobs.some((job) => active(job.status)) ? 2000 : 10000,
  );
}
scheduleRefresh();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refresh();
});

function invalidateBlueprintReview() {
  blueprintReviews.invalidate();
  blueprintReview = undefined;
  controls();
}
async function catalogAction(action: PanelAction) {
  try {
    return await api(action);
  } catch (error) {
    notice(error instanceof Error ? error.message : String(error), true);
    throw error;
  }
}
$('catalog-search').onsubmit = (event) => {
  event.preventDefault();
  void (async () => {
    const result = (await catalogAction({ kind: 'catalog-search', query: input('catalog-query').value })) as {
      results: { id: string; title: string; status: string }[];
    };
    $('catalog-hits').replaceChildren();
    for (const hit of result.results) {
      const b = node('button', 'quiet', hit.title + ' · ' + hit.status);
      b.type = 'button';
      b.onclick = () => {
        selectedBlock = hit.id;
        invalidateBlueprintReview();
        void catalogAction({ kind: 'catalog-read', id: hit.id, offset: 0 }).then(
          (data) => {
            $('catalog-detail').textContent = (data as { content: string }).content;
          },
          () => controls(),
        );
      };
      $('catalog-hits').append(b);
    }
  })().catch(() => controls());
};
$('catalog-add').onsubmit = (event) => {
  event.preventDefault();
  invalidateBlueprintReview();
  void (async () => {
    if (!selectedBlock) throw new Error('Select a block from the catalog.');
    const blueprint = input('compose-blueprint').value,
      instanceId = input('compose-instance').value,
      instance = {
        ...JSON.parse($<HTMLTextAreaElement>('compose-parameters').value),
        use: selectedBlock,
      };
    const reviewed = await blueprintReviews.run(async () => {
      const state = (await catalogAction({ kind: 'blueprint-read', blueprint })) as { digest: string };
      const action: Extract<PanelAction, { kind: 'blueprint-add' }> = {
        kind: 'blueprint-add',
        blueprint,
        instanceId,
        instance,
        expectedDigest: state.digest,
        apply: false,
      };
      const diff = (await catalogAction(action)) as { before: string; after: string };
      return { action, diff };
    });
    if (!reviewed) return;
    blueprintReview = { ...reviewed.action, apply: true };
    $('blueprint-diff').textContent = 'BEFORE\n' + reviewed.diff.before + '\nAFTER\n' + reviewed.diff.after;
    controls();
  })().catch((error) => notice(String(error), true));
};
$('blueprint-apply').onclick = () => {
  if (blueprintReview)
    void catalogAction(blueprintReview)
      .then(() => {
        blueprintReview = undefined;
        blueprintReviews.invalidate();
        reviewedPlan = undefined;
        compositionJobs.invalidate();
        $<HTMLButtonElement>('blueprint-apply').disabled = true;
        $<HTMLButtonElement>('compose-materialize').disabled = true;
        notice('Blueprint updated. Create and review a new plan.');
      })
      // catalogAction already shows the error; keep the review and restore its controls.
      .catch(() => controls());
};
async function startComposition(action: PanelAction) {
  if (compositionJobs.running) return;
  reviewedPlan = undefined;
  controls();
  try {
    const completed = await compositionJobs.run(async () => {
      composeJob = ((await catalogAction(action)) as { jobId: string }).jobId;
      return composeJob;
    });
    const result = completed?.response.job.result?.data;
    reviewedPlan =
      completed?.current && completed.response.materializable && result?.planDigest
        ? { plan: result.plan, planDigest: result.planDigest }
        : undefined;
  } catch (error) {
    notice(error instanceof Error ? error.message : String(error), true);
  } finally {
    controls();
  }
}
input('compose-blueprint').oninput = () => {
  invalidateBlueprintReview();
  reviewedPlan = undefined;
  compositionJobs.invalidate();
  controls();
};
input('compose-instance').oninput = invalidateBlueprintReview;
$<HTMLTextAreaElement>('compose-parameters').oninput = invalidateBlueprintReview;
$('compose-plan').onclick = () => {
  void startComposition({
    kind: 'compose-plan',
    blueprint: input('compose-blueprint').value,
    out: '.apexrest/composer/panel-plan.json',
    mode: 'offline',
    validation: 'compiler',
    action: 'compose',
  });
};
$('compose-materialize').onclick = () => {
  if (reviewedPlan)
    void startComposition({
      kind: 'compose-materialize',
      plan: reviewedPlan.plan,
      expectedDigest: reviewedPlan.planDigest,
    });
};
$('compose-cancel').onclick = () => {
  if (composeJob) void catalogAction({ kind: 'cancel-job', id: composeJob });
};
