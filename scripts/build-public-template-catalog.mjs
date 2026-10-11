// Import licensed public APEXlang pages as reference data. Never runs upstream code.
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { sha256 } from './lib/release.mjs';

const root = 'resources/public-templates/26.2';
const prefix = 'oracle:26.2:public-template/';
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const pin = {
  repository: 'https://github.com/oracle/apex',
  commit: 'fbe095e4c6e783b3fa930ffae927e4826e549190',
  archiveSha256: 'f7ec2c4f5f04755b0744e7c3b6b87e326e0f4a575c666db720cef43297472bcc',
  license: 'UPL-1.0',
  apexVersion: '26.2',
  themeVersion: '26.2',
  mmdVersion: '26.2.0+3479',
};
const sourceUrl = (file) => `${pin.repository}/blob/${pin.commit}/${file}`;
const titleCase = (value) => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const aliases = {
  'sample-calendar': 'календар події розклад перетягування',
  'team-calendar': 'командний календар події розклад',
  'sample-cards': 'картки картка плитки',
  'sample-charts': 'графіки діаграми графік діаграма',
  'sample-interactive-grids': 'інтерактивна таблиця редагування рядків сітка',
  'sample-reporting': 'звіти звіт інтерактивний звіт',
  'sample-maps': 'карти карта мапа геолокація',
  'sample-master-detail': 'головний підлеглий деталі табличні частини',
  'sample-dynamic-actions': 'динамічні дії події оновлення',
  'sample-application-search': 'пошук фільтри',
  'sample-vector-search': 'векторний пошук штучний інтелект',
  'sample-approvals': 'погодження затвердження завдання процеси',
  'sample-data-loading': 'завантаження даних імпорт',
  'sample-file-upload-download': 'файли завантаження вивантаження',
  'sample-trees': 'дерево ієрархія навігація',
  'sample-collections': 'колекції тимчасові дані',
  'sample-rest-services': 'сервіси інтеграція запити',
  'universal-theme-reference': 'універсальна тема компоненти оформлення',
  'ux-pattern-catalog': 'шаблони інтерфейс форми компонування',
  customers: 'клієнти клієнт контакти',
  opportunities: 'продажі можливості угоди',
  poll: 'опитування голосування',
  qask: 'питання відповіді',
  'strategic-planner': 'стратегічне планування цілі проєкти',
};
const safe = (file) => {
  if (
    !/^[a-zA-Z0-9_. /-]+$/.test(file) ||
    file.startsWith('/') ||
    file.split('/').some((s) => !s || s === '.' || s === '..')
  )
    throw new Error(`Unsafe public template path: ${file}`);
  return file;
};
const generatorHash = async () => sha256(await readFile(fileURLToPath(import.meta.url)));
const scope =
  'Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.';

// The resource packager copies every file, including hidden files. Do not use the
// release helper's development-file exclusions for this exact-membership gate.
async function strictFiles(directory, relative = '') {
  const result = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const file = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in public template library: ${file}`);
    if (entry.isDirectory()) result.push(...(await strictFiles(directory, file)));
    else if (entry.isFile()) result.push(file);
    else throw new Error(`Special file in public template library: ${file}`);
  }
  return result;
}

export async function checkPublicTemplateCatalog(directory = root) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const lockText = await readFile(path.join(directory, 'source-lock.json'), 'utf8');
  const lock = JSON.parse(lockText);
  if (
    manifest.generatorSha256 !== (await generatorHash()) ||
    JSON.stringify(lock.source) !== JSON.stringify(pin) ||
    JSON.stringify(manifest.source) !== JSON.stringify(pin)
  )
    throw new Error('Public template generator or source pin changed; rebuild from the pinned archive.');
  const indexText = await readFile(path.join(directory, 'index.json'), 'utf8');
  if (manifest.indexSha256 !== sha256(indexText) || manifest.files['index.json'] !== sha256(indexText))
    throw new Error('Public template index checksum mismatch.');
  const index = JSON.parse(indexText);
  const expected = [...Object.keys(manifest.files), 'manifest.json'].sort();
  if (JSON.stringify((await strictFiles(directory)).sort()) !== JSON.stringify(expected))
    throw new Error('Unexpected or missing public template files.');
  for (const [file, digest] of Object.entries(manifest.files)) {
    safe(file);
    if (sha256(await readFile(path.join(directory, file))) !== digest)
      throw new Error(`Public template content checksum mismatch: ${file}`);
  }
  const ids = new Set(index.map((entry) => entry.id));
  if (ids.size !== index.length || index.length !== manifest.counts.records)
    throw new Error('Public template count or unique IDs mismatch.');
  const templates = index.filter((entry) => entry.kind === 'template');
  const appIds = new Set(lock.apps.map((app) => app.id));
  if (
    lock.apps.length !== 33 ||
    appIds.size !== 33 ||
    manifest.counts.applications !== 33 ||
    templates.length !== Object.keys(lock.pages).length ||
    templates.some((entry) => !Object.hasOwn(lock.pages, entry.id)) ||
    Object.keys(lock.pages).some((id) => !templates.some((entry) => entry.id === id))
  )
    throw new Error('Public template application or page source coverage mismatch.');
  for (const app of lock.apps) {
    const pages = Object.entries(lock.pages).filter(([, source]) => source.application === app.id);
    if (
      pages.length !== app.includedPages ||
      !ids.has(prefix + app.id + '/dependencies') ||
      pages.some(([id, source]) => !id.startsWith(prefix + app.id + '/') || !source.path.startsWith(app.path))
    )
      throw new Error('Public template application membership mismatch.');
  }
  for (const entry of index) {
    if (
      !entry.id.startsWith(prefix) ||
      entry.readiness !== 'reference' ||
      entry.sha256 !== manifest.files[entry.document] ||
      [...entry.requires, ...entry.related].some((id) => !ids.has(id))
    )
      throw new Error(`Invalid public template record: ${entry.id}`);
    const source = lock.pages[entry.id];
    if (!source) continue;
    if (!appIds.has(source.application)) throw new Error('Unknown public template application.');
    if (entry.source !== sourceUrl(source.path)) throw new Error(`Incorrect attribution: ${entry.id}`);
    const document = await readFile(path.join(directory, entry.document), 'utf8');
    const marker = '\n<!-- BEGIN ORIGINAL APEXLANG -->\n';
    const start = document.indexOf(marker);
    const block = document.slice(start + marker.length);
    const match = block.match(/^(`{4,})apexlang\n([\s\S]*)\n\1\n$/);
    if (start < 0 || !match || sha256(match[2]) !== source.sha256)
      throw new Error(`Original APEXlang source checksum mismatch: ${entry.id}`);
  }
  if (Object.keys(lock.pages).length !== manifest.counts.pageTemplates)
    throw new Error('Public template source coverage mismatch.');
  return { status: 'verified', ...manifest.counts };
}

export async function buildPublicTemplateCatalog(archive, directory = root) {
  const bytes = await readFile(archive);
  if (bytes.length > 160 * 1024 * 1024 || sha256(bytes) !== pin.archiveSha256)
    throw new Error('Public template archive does not match the reviewed Oracle revision.');
  const zipRoot = `apex-${pin.commit}/`;
  const appPattern = /^(sample-apps|starter-apps|utility-apps)\/([a-z0-9-]+)\/apexlang\/([a-z0-9-]+)\//;
  const archiveFiles = [];
  const content = unzipSync(bytes, {
    filter: ({ name, originalSize }) => {
      if (!name.startsWith(zipRoot)) return false;
      const file = name.slice(zipRoot.length);
      if (appPattern.test(file) && !name.endsWith('/')) archiveFiles.push(file);
      const selected =
        file === 'LICENSE.txt' ||
        (appPattern.test(file) &&
          (file.endsWith('/.apex/apexlang.json') || /\/p\d{5}(?:-[a-z0-9-]+)?\.apx$/.test(file)));
      if (selected && originalSize > 4 * 1024 * 1024) throw new Error('Oversized public template.');
      return selected;
    },
  });
  const read = (file) => {
    const value = content[zipRoot + safe(file)];
    if (!value) throw new Error(`Missing public source: ${file}`);
    return Buffer.from(value).toString('utf8');
  };
  const license = read('LICENSE.txt');
  if (!license.includes('Universal Permissive License (UPL), Version 1.0'))
    throw new Error('Unexpected source license.');
  const apps = archiveFiles
    .filter((file) => file.endsWith('/.apex/apexlang.json'))
    .map((metadata) => {
      const appRoot = metadata.slice(0, -'.apex/apexlang.json'.length);
      const match = appRoot.match(appPattern);
      const mmd = JSON.parse(read(metadata));
      if (mmd.mmdVersion !== pin.mmdVersion) throw new Error(`Unexpected MMD: ${metadata}`);
      return { id: match[2], path: appRoot, category: match[1], mmdVersion: mmd.mmdVersion };
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (apps.length !== 33 || new Set(apps.map((app) => app.id)).size !== apps.length)
    throw new Error('Reviewed application coverage changed.');
  const documents = new Map();
  const index = [];
  const lock = {
    schemaVersion: 1,
    source: pin,
    selection:
      'Every page with numeric ID 1 through 9998 from all 33 APEXlang applications. Page 0, page 9999, higher-numbered pages and shared objects are inventoried as dependencies. Lower-numbered login/admin examples can be included; the numeric selection is not a readiness or security classification.',
    apps: [],
    pages: {},
  };
  const compatibility = {
    apexVersion: pin.apexVersion,
    themeVersion: pin.themeVersion,
    mmdVersion: pin.mmdVersion,
  };
  const add = (record, text) => {
    const document = `documents/${record.id.slice(prefix.length)}.md`;
    documents.set(document, text);
    index.push({
      ...record,
      version: `26.2@${pin.commit.slice(0, 7)}`,
      document,
      sha256: sha256(text),
      length: text.length,
      readiness: 'reference',
      compatibility,
      requires: record.requires ?? [],
      related: record.related ?? [],
    });
  };
  for (const app of apps) {
    const ownFiles = archiveFiles.filter((file) => file.startsWith(app.path)).sort();
    const pageFiles = ownFiles.filter((file) => /\/p\d{5}(?:-[a-z0-9-]+)?\.apx$/.test(file));
    const selected = pageFiles.filter((file) => {
      const id = Number(path.basename(file).slice(1, 6));
      return id > 0 && id < 9999;
    });
    const guideId = prefix + app.id + '/dependencies';
    const pageIds = [];
    for (const file of selected) {
      const raw = read(file);
      const name = path.basename(file, '.apx');
      const id = prefix + app.id + '/' + name;
      const pageName = raw.match(/^\s*name: (.+)$/m)?.[1]?.replace(/^"|"$/g, '') ?? titleCase(name.slice(7));
      const types = [...new Set([...raw.matchAll(/^\s*(?:type|template): (.+)$/gm)].map((m) => m[1]))].slice(
        0,
        50,
      );
      const fence = '`'.repeat(Math.max(4, ...[...raw.matchAll(/`+/g)].map((m) => m[0].length + 1)));
      const text = `# ${pageName} — ${titleCase(app.id)}\n\n${scope}\n\nSource: ${sourceUrl(file)}\n\nCopyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.\n\nAPEX ${pin.apexVersion}; MMD ${pin.mmdVersion}. Original source SHA-256: ${sha256(raw)}.\n\nApplication dependency inventory: ${guideId}.\n\n<!-- BEGIN ORIGINAL APEXLANG -->\n${fence}apexlang\n${raw}\n${fence}\n`;
      lock.pages[id] = { path: file, sha256: sha256(raw), application: app.id };
      pageIds.push(id);
      add(
        {
          id,
          title: `${pageName} — ${titleCase(app.id)}`,
          source: sourceUrl(file),
          kind: 'template',
          family: `public-templates/${app.id}`,
          searchText: `${pageName} ${app.id.replaceAll('-', ' ')} ${aliases[app.id] ?? ''} ${types.join(' ')} APEXlang source example шаблон приклад`,
          requires: [guideId],
        },
        text,
      );
    }
    const appInfo = {
      ...app,
      sourceUrl: `${pin.repository}/tree/${pin.commit}/${app.path}`,
      totalPages: pageFiles.length,
      includedPages: selected.length,
      apexlangFiles: ownFiles.filter((file) => file.endsWith('.apx')).length,
      sourceFiles: ownFiles.map((file) => file.slice(app.path.length)),
    };
    lock.apps.push(appInfo);
    add(
      {
        id: guideId,
        title: `${titleCase(app.id)} source dependencies`,
        kind: 'guide',
        family: 'public-templates',
        source: appInfo.sourceUrl,
        searchText: `${app.id.replaceAll('-', ' ')} dependencies data contract shared components application`,
        related: pageIds,
      },
      `# ${titleCase(app.id)}: application dependency inventory\n\n${scope}\n\nPinned source: ${appInfo.sourceUrl}\n\nThe list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.\n\n${selected.length} included page templates of ${pageFiles.length} source pages; ${appInfo.apexlangFiles} source APEXlang files.\n\n## Source files\n\n${appInfo.sourceFiles.map((file) => '- ' + file).join('\n')}\n`,
    );
  }
  if (Object.keys(lock.pages).length !== 1350) throw new Error('Reviewed page coverage changed.');
  add(
    {
      id: prefix + 'catalog',
      title: 'Public Oracle APEXlang templates / Публічні шаблони',
      kind: 'guide',
      family: 'public-templates',
      source: pin.repository,
      searchText: 'public template catalog Oracle APEXlang шаблони каталог',
      related: apps.map((app) => prefix + app.id + '/dependencies'),
    },
    `# Public Oracle APEXlang templates\n\n${scope}\n\n1,350 page sources from 33 applications, pinned to Oracle APEX 26.2 / MMD ${pin.mmdVersion}, under UPL-1.0. These are source references; use the separately compiler-checked component recipes for dependency-closed examples.\n\n${lock.apps.map((app) => `- ${app.id}: ${app.includedPages} pages; ${prefix}${app.id}/dependencies`).join('\n')}\n`,
  );
  const output = new Map(documents);
  output.set('index.json', json(index.sort((a, b) => a.id.localeCompare(b.id, 'en'))));
  output.set('source-lock.json', json(lock));
  output.set('ORACLE-LICENSE.txt', license);
  const hashes = Object.fromEntries([...output].map(([file, text]) => [file, sha256(text)]));
  const counts = {
    applications: apps.length,
    pageTemplates: Object.keys(lock.pages).length,
    records: index.length,
  };
  output.set(
    'manifest.json',
    json({
      schemaVersion: 1,
      catalogVersion: `26.2@${pin.commit.slice(0, 7)}`,
      source: pin,
      generatorSha256: await generatorHash(),
      indexSha256: hashes['index.json'],
      files: hashes,
      counts,
    }),
  );
  await rm(path.join(directory, 'documents'), { recursive: true, force: true });
  for (const [file, text] of output) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), text);
  }
  return checkPublicTemplateCatalog(directory);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archive = process.argv.includes('--archive')
    ? process.argv[process.argv.indexOf('--archive') + 1]
    : undefined;
  console.log(
    JSON.stringify(archive ? await buildPublicTemplateCatalog(archive) : await checkPublicTemplateCatalog()),
  );
}
