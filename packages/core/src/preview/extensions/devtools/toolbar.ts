import { get, isRef, str, type ApxComponent } from '../../apexlang.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml } from '../../theme.ts';
import { authorizationSchemes, roles, viewAsLabel } from './view-as.ts';

/** Developer toolbar tools rendered on the server: session state, debug, view as, pages, viewport, reset. */

const button = (panel: string, icon: string, label: string, title: string, extra = '') =>
  `<button type="button" class="apex-local-tb-button${extra}" data-apex-local-panel="${panel}" title="${escapeHtml(title)}"><span class="fa ${icon}" aria-hidden="true"></span><span class="apex-local-tb-label">${escapeHtml(label)}</span></button>`;

const panel = (name: string, title: string, actions: string, body: string) =>
  `<div class="apex-local-panel" data-panel="${name}" hidden><header><strong>${escapeHtml(title)}</strong>${actions}</header>${body}</div>`;

function itemRows(entries: [string, string, string][]): string {
  if (!entries.length) return '<tr><td colspan="2" class="apex-local-muted">None</td></tr>';
  return entries
    .map(
      ([name, value, label]) =>
        `<tr><th scope="row" title="${escapeHtml(label)}"><code>${escapeHtml(name)}</code></th><td><input type="text" class="apex-local-input" data-apex-local-item="${escapeHtml(name)}" data-original="${escapeHtml(value)}" value="${escapeHtml(value)}" aria-label="${escapeHtml(name)}"></td></tr>`,
    )
    .join('');
}

function sessionPanel(renderer: ApexRenderer, ctx: RenderContext): string {
  const session = ctx.session;
  const pageItems = renderer.pageComponents(ctx, 'pageItem').map((item): [string, string, string] => {
    const name = item.id.toUpperCase();
    return [name, session.items[name] ?? '', `${str(item.props, 'type', 'item')} · ${renderer.label(item)}`];
  });
  const appItems = [...renderer.app.shared, ...renderer.app.app.children]
    .filter((component) => component.type === 'appItem')
    .map((item): [string, string, string] => {
      const name = item.id.toUpperCase();
      return [name, session.items[name] ?? '', 'application item'];
    });
  const known = new Set([...pageItems, ...appItems].map(([name]) => name));
  const other = Object.keys(session.items)
    .filter((name) => !known.has(name))
    .sort()
    .map((name): [string, string, string] => [name, session.items[name] ?? '', 'session state']);
  const info = [
    ['User', session.user],
    ['Session', session.id],
    ['Page', `${ctx.pageId} · ${str(ctx.page.props, 'name')}`],
    ['Request', ctx.request || '(none)'],
    ['Theme style', session.themeStyle ?? 'application default'],
    ['View as', viewAsLabel(renderer, session.viewAs)],
    [
      'Data',
      renderer.oracle
        ? `Oracle ${renderer.oracle.environment} (${renderer.oracle.target}) · every request rolled back`
        : 'Local SQLite simulation',
    ],
  ]
    .map(([name, value]) => `<tr><th scope="row">${name}</th><td>${escapeHtml(value!)}</td></tr>`)
    .join('');
  const body = `<form class="apex-local-session" data-apex-local-session><table class="apex-local-table">${info}</table>
<h3>Page items</h3><table class="apex-local-table">${itemRows(pageItems)}</table>
<h3>Application items</h3><table class="apex-local-table">${itemRows(appItems)}</table>
<h3>Other session state</h3><table class="apex-local-table">${itemRows(other)}</table>
<div class="apex-local-row"><input type="text" class="apex-local-input" data-apex-local-new-name placeholder="ITEM_NAME" aria-label="New item name"><input type="text" class="apex-local-input" data-apex-local-new-value placeholder="value" aria-label="New item value"></div>
<div class="apex-local-row"><button type="submit" class="apex-local-action is-primary">Set values and reload</button><button type="button" class="apex-local-action" data-apex-local-clear-page="${escapeHtml(ctx.pageId)}">Clear page items</button></div></form>`;
  return (
    button('session', 'fa-database', 'Session', 'Session state: items, request, user') +
    panel('session', 'Session state', '<span class="apex-local-muted">Edit values, then reload</span>', body)
  );
}

function debugPanel(): string {
  return (
    button('debug', 'fa-bug', 'Debug', 'Debug log of recent requests') +
    panel(
      'debug',
      'Debug log',
      '<button type="button" class="apex-local-action" data-apex-local-debug-refresh>Refresh</button><button type="button" class="apex-local-action" data-apex-local-debug-clear>Clear</button>',
      '<div class="apex-local-debug" data-apex-local-debug><p class="apex-local-muted">Loading…</p></div>',
    )
  );
}

function viewAsPanel(renderer: ApexRenderer, ctx: RenderContext): string {
  const viewAs = ctx.session.viewAs;
  const roleList = roles(renderer);
  const schemes = authorizationSchemes(renderer);
  const checked = (on: boolean) => (on ? ' checked' : '');
  const roleBoxes = roleList.length
    ? roleList
        .map(
          (role) =>
            `<label class="apex-local-check"><input type="checkbox" name="role" value="${escapeHtml(role.id)}"${checked(Boolean(viewAs?.roles.some((id) => id.toLowerCase() === role.id.toLowerCase())))}> ${escapeHtml(str(role.props, 'name', role.id))} <code>${escapeHtml(role.id)}</code></label>`,
        )
        .join('')
    : '<p class="apex-local-muted">The application defines no ACL roles.</p>';
  const schemeBoxes = schemes.length
    ? schemes
        .map(
          (scheme) =>
            `<label class="apex-local-check"><input type="checkbox" name="deny" value="${escapeHtml(scheme.id)}"${checked(Boolean(viewAs?.deny.some((id) => id.toLowerCase() === scheme.id.toLowerCase())))}> ${escapeHtml(str(scheme.props, 'name', scheme.id))} <span class="apex-local-muted">${escapeHtml(str(scheme.props, 'type'))}</span></label>`,
        )
        .join('')
    : '<p class="apex-local-muted">The application defines no authorization schemes.</p>';
  const body = `<form class="apex-local-viewas" data-apex-local-viewas>
<label class="apex-local-check"><input type="radio" name="mode" value="off"${checked(!viewAs)}> <strong>Everything allowed</strong> <span class="apex-local-muted">(default: schemes are evaluated and reported, never enforced)</span></label>
<label class="apex-local-check"><input type="radio" name="mode" value="on"${checked(Boolean(viewAs))}> <strong>Enforce authorization</strong> for a user with these roles:</label>
<fieldset><legend>ACL roles</legend>${roleBoxes}</fieldset>
<fieldset><legend>Always deny these schemes</legend>${schemeBoxes}</fieldset>
<p class="apex-local-muted">Role checks (Is In Role or Group, apex_acl) use the roles above; PL/SQL and SQL schemes run locally. Denied pages show an access error, denied regions, items, buttons and list entries are hidden. A design aid only, not APEX security.</p>
<div class="apex-local-row"><button type="submit" class="apex-local-action is-primary">Apply and reload</button></div></form>`;
  return (
    button(
      'viewas',
      'fa-user-secret',
      viewAs ? `View as: ${viewAsLabel(renderer, viewAs)}` : 'View as',
      'View as a role: enforce authorization schemes',
      viewAs ? ' is-on' : '',
    ) + panel('viewas', 'View as', '', body)
  );
}

const schemeOf = (page: ApxComponent) => {
  const value = get(page.props, 'security.authorizationScheme');
  return isRef(value) ? value.ref : typeof value === 'string' ? value : '';
};

function pagesPanel(renderer: ApexRenderer, ctx: RenderContext): string {
  const pages = [...renderer.app.pages.values()]
    .filter((page) => page.id !== '0')
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((page) => {
      const mode = str(page.props, 'appearance.pageMode', 'normal');
      const scheme = schemeOf(page);
      const tags = [
        mode !== 'normal' ? `<span class="apex-local-tag">${escapeHtml(mode)}</span>` : '',
        scheme
          ? `<span class="apex-local-tag" title="Authorization scheme">${escapeHtml(scheme)}</span>`
          : '',
      ].join('');
      return `<li${page.id === ctx.pageId ? ' class="is-current"' : ''}><a href="${escapeHtml(renderer.pagePath(page))}"><span class="apex-local-page-id">${escapeHtml(page.id)}</span> ${escapeHtml(str(page.props, 'name', page.id))}</a>${tags}</li>`;
    })
    .join('');
  return (
    button('pages', 'fa-sitemap', 'Pages', 'Quick links to every page') +
    panel(
      'pages',
      `Pages (${renderer.app.pages.size - (renderer.app.pages.has('0') ? 1 : 0)})`,
      '<input type="search" class="apex-local-input" data-apex-local-page-filter placeholder="Filter" aria-label="Filter pages">',
      `<ul class="apex-local-pages">${pages}</ul>`,
    )
  );
}

function viewportButtons(): string {
  const modes: [string, string, string][] = [
    ['desktop', 'fa-desktop', 'Desktop (full width)'],
    ['tablet', 'fa-tablet', 'Tablet (768 × 1024)'],
    ['phone', 'fa-mobile', 'Phone (375 × 812)'],
  ];
  return `<span class="apex-local-tb-group" role="group" aria-label="Viewport">${modes
    .map(
      ([mode, icon, title]) =>
        `<button type="button" class="apex-local-tb-button${mode === 'desktop' ? ' is-active' : ''}" data-apex-local-viewport="${mode}" title="${title}" aria-pressed="${mode === 'desktop'}"><span class="fa ${icon}" aria-hidden="true"></span></button>`,
    )
    .join('')}</span>`;
}

const resetButton = () =>
  `<button type="button" class="apex-local-tb-button" data-apex-local-reset title="Reset data: rebuild the SQLite database from .apex-local/*.sql"><span class="fa fa-refresh" aria-hidden="true"></span><span class="apex-local-tb-label">Reset data</span></button>`;

export function toolbarTools(renderer: ApexRenderer, ctx: RenderContext): string {
  return [
    sessionPanel(renderer, ctx),
    debugPanel(),
    viewAsPanel(renderer, ctx),
    pagesPanel(renderer, ctx),
    viewportButtons(),
    resetButton(),
  ].join('');
}
