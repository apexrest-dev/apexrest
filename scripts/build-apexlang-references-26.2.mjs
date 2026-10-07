// Offline, complete Oracle inventory synchronization. Never runs upstream skills or scripts.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { buildReferencePostings } from '../packages/core/src/reference-index.ts';

const option = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const lockPath = 'toolchains/sources.lock.json';
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const commit = option('--commit') ?? lock.oracleSkills26_2.commit;
const archiveSha256 = option('--archive-sha256') ?? lock.oracleSkills26_2.archiveSha256;
if (!/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{64}$/.test(archiveSha256))
  throw new Error('Exact commit and archive SHA-256 are required.');
const release = '26.2';
const archive = process.argv.find((arg) => arg.endsWith('.zip'));
const check = process.argv.includes('--check');
if (!archive)
  throw new Error('Usage: node scripts/build-apexlang-references-26.2.mjs ORACLE_SKILLS.zip [--check]');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const bytes = await readFile(archive);
if (bytes.length > 12 * 1024 * 1024 || sha256(bytes) !== archiveSha256)
  throw new Error('Archive does not match the reviewed Oracle 26.2 snapshot.');
const root = `skills-${commit}/`;
const prefix = `${root}apex/apexlang/26.2/`;
// Every official inventory document is kept byte-exact; metadata summaries are not contracts.
const all = unzipSync(bytes, {
  filter: ({ name, originalSize }) => {
    if (name.startsWith(prefix) && originalSize > 4 * 1024 * 1024)
      throw new Error('Oversized upstream file.');
    return name === root + 'LICENSE.txt' || name.startsWith(prefix);
  },
});
const inventoryPrefix = 'apexlang-inventory/assets/';
const inventory = Object.keys(all)
  .filter((name) => name.startsWith(prefix + inventoryPrefix) && name.endsWith('.md'))
  .map((name) => name.slice((prefix + inventoryPrefix).length))
  .sort();
if (
  !inventory.length ||
  inventory.some((file) => !/^[a-z0-9/.-]+\.md$/.test(file) || file.split('/').includes('..'))
)
  throw new Error('Missing or unsafe official inventory.');
const documents = {};
const inventoryDefinitions = {};
const inventoryProperties = (text) => {
  let group = '';
  const properties = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('### ')) group = line.slice(4);
    const property = line.match(/^- `([^`]+)` — `([^`]+)`;/);
    if (property) properties.push({ group, name: property[1], type: property[2] });
  }
  return properties;
};
const exampleFiles = [
  'example-0/.apex/apexlang.json',
  'example-0/application.apx',
  'example-0/deployments/default.json',
  'example-0/pages/p00001-home.apx',
  'example-1/pages/p00002-dashboard.apx',
  'example-1/pages/p00003-customers.apx',
  'example-1/pages/p00004-customer.apx',
  'example-1/pages/p00010-regions.apx',
  'example-1/shared-components/lovs/oehr-customers-cust-first-name.apx',
];
const selected = new Set([
  ...inventory.map((file) => `apexlang-inventory/assets/${file}`),
  ...exampleFiles.map((file) => `apexlang-example-applications/assets/${file}`),
]);
const unpacked = all;
const sourceFiles = {};
const inventoryId = (file) => `oracle:26.2:inventory/${file.replace(/\.md$/, '')}`;
const exampleId = (file) => `oracle:26.2:example/${file}`;
const records = [];
for (const file of [...selected].sort()) {
  const value = unpacked[prefix + file];
  if (!value) throw new Error(`Reviewed file missing: ${file}`);
  const raw = Buffer.from(value).toString('utf8');
  sourceFiles[file] = sha256(raw);
  if (file.startsWith('apexlang-inventory/')) {
    const relative = file.slice('apexlang-inventory/assets/'.length);
    const props = inventoryProperties(raw);
    const componentType = raw.match(/^- componentType: `([^`]+)`/m)?.[1];
    if (!componentType) throw new Error(`Missing component type: ${relative}`);
    const document = `documents/${relative}`;
    documents[document] = raw;
    inventoryDefinitions[relative] = { componentType, properties: props };
    const text =
      raw.split('## Properties')[0] +
      '\nProperty addresses (read the document for complete types, enums, requirements and conditions):\n' +
      props.map(({ group, name }) => `- ${group}.${name}`).join('\n') +
      '\n';
    const parent = path.posix.dirname(path.posix.dirname(relative));
    const parentFile = `${parent}/${path.posix.basename(parent)}.md`;
    const selectorRoot = relative.includes('/plugin-variants/')
      ? relative.split('/plugin-variants/')[0]
      : relative.includes('/template-component/')
        ? relative.split('/template-component/')[0]
        : undefined;
    const selectorFile = selectorRoot ? `${selectorRoot}/${path.posix.basename(selectorRoot)}.md` : undefined;
    records.push({
      id: inventoryId(relative),
      version: `${release}@${commit.slice(0, 7)}`,
      source: `https://github.com/oracle/skills/blob/${commit}/apex/apexlang/26.2/${file}`,
      title: `${raw.match(/^# (.+)/)?.[1] ?? relative} — 26.2 property inventory`,
      kind: 'contract',
      family: `inventory/${path.posix.dirname(relative)}`,
      requires: [
        ...new Set(
          [parentFile, selectorFile]
            .filter((file) => file && inventory.includes(file) && file !== relative)
            .map(inventoryId),
        ),
      ],
      related: [],
      verification: 'reviewed-oracle-inventory; not runtime-verified',
      document,
      contentSha256: sha256(raw),
      contentLength: raw.length,
      sha256: sha256(text),
      text,
    });
  } else {
    const relative = file.slice('apexlang-example-applications/assets/'.length);
    const language = file.endsWith('.apx') ? 'apexlang' : 'json';
    const text = `# Oracle APEX 26.2 source example: ${relative}\n\nThis is source reference data, not a standalone recipe or a runtime verification result. Preserve the complete application's dependencies before compiling or importing.\n\n\`\`\`${language}\n${raw.trimEnd()}\n\`\`\`\n`;
    records.push({
      id: exampleId(relative),
      version: `${release}@${commit.slice(0, 7)}`,
      source: `https://github.com/oracle/skills/blob/${commit}/apex/apexlang/26.2/${file}`,
      title: `${relative} — Oracle 26.2 example`,
      kind: 'template',
      family: 'examples',
      requires: [],
      related: [],
      verification: 'reviewed-oracle-example; not runtime-verified',
      sha256: sha256(text),
      text,
    });
  }
}
const catalogSource = 'apexlang-inventory/SKILL.md';
const catalogRaw = Buffer.from(unpacked[prefix + catalogSource] ?? []).toString('utf8');
if (!catalogRaw.includes('APEX Version: 26.2')) throw new Error('Missing 26.2 inventory authoring catalog.');
sourceFiles[catalogSource] = sha256(catalogRaw);
documents['documents/catalog.md'] = catalogRaw;
const catalogText =
  'Official Oracle 26.2 inventory authoring catalog, application layout, syntax and component hierarchy. Read this entry before composing a new component family.';
records.push({
  id: 'oracle:26.2:inventory-catalog',
  version: `${release}@${commit.slice(0, 7)}`,
  source: `https://github.com/oracle/skills/blob/${commit}/apex/apexlang/26.2/${catalogSource}`,
  title: 'Oracle 26.2 inventory authoring catalog',
  kind: 'guide',
  family: 'inventory',
  requires: [],
  related: [],
  verification: 'complete-official-source; not runtime-verified',
  text: catalogText,
  sha256: sha256(catalogText),
  document: 'documents/catalog.md',
  contentSha256: sha256(catalogRaw),
  contentLength: catalogRaw.length,
});
const exampleMetadata = JSON.parse(
  Buffer.from(
    unpacked[prefix + 'apexlang-example-applications/assets/example-0/.apex/apexlang.json'],
  ).toString('utf8'),
);
const mmdVersion = exampleMetadata.mmdVersion;
if (!/^26\.2\./.test(mmdVersion ?? '')) throw new Error('Oracle example MMD does not match 26.2.');
const outputRoot = 'resources/references/26.2';
const guides = JSON.parse(await readFile(`${outputRoot}/guides.json`, 'utf8'));
for (const guide of guides) {
  if (!/^[a-z0-9-]+$/.test(guide.name)) throw new Error('Unsafe guide name.');
  const text = await readFile(`${outputRoot}/guides/${guide.name}.md`, 'utf8');
  records.push({
    id: `oracle:26.2:guide/${guide.name}`,
    version: '26.2',
    source: guide.source,
    title: guide.title,
    kind: 'guide',
    family: guide.family,
    requires: guide.requires ?? [],
    related: guide.related ?? [],
    verification: 'source-reviewed guidance; native runtime verification required',
    sha256: sha256(text),
    text,
  });
}
const recipeManifest = JSON.parse(await readFile(`${outputRoot}/recipes/manifest.json`, 'utf8'));
const recipeEvidence = JSON.parse(await readFile(`${outputRoot}/recipes/verification.json`, 'utf8'));
const recipeFiles = {};
for (const recipe of recipeManifest.files) {
  if (!/^[a-z0-9-]+\.apx$/.test(recipe.file)) throw new Error('Unsafe recipe name.');
  const source = await readFile(`${outputRoot}/recipes/${recipe.file}`, 'utf8');
  recipeFiles[recipe.file] = sha256(source);
  const compiled =
    recipeEvidence.status === 'passed' &&
    recipeEvidence.evidenceKind === 'oracle-offline-compiler' &&
    recipeEvidence.mmdVersion === recipeManifest.mmdVersion &&
    recipeEvidence.files[recipe.file] === sha256(source);
  const text = `# APEX 26.2 recipe: ${recipe.file}\n\nTarget source path: \`${recipe.target}\`.\n\n${compiled ? `Verified by the real Oracle ${recipeEvidence.mmdVersion} offline compiler, together with the other recipe files and a generated application scaffold.` : 'Compiler verification is absent or stale for these source bytes.'} This file is a fragment, not a standalone application. Source queries, credentials, provider availability, workflow execution, database installation and browser behavior are not verified. Workspace components are excluded from selected-file import.\n\n\`\`\`apexlang\n${source.trimEnd()}\n\`\`\`\n`;
  records.push({
    id: `oracle:26.2:recipe/${recipe.file.replace(/\.apx$/, '')}`,
    version: '26.2',
    source: `${outputRoot}/recipes/${recipe.file}`,
    title: `${recipe.file.replace(/\.apx$/, '')} — 26.2 compiler recipe`,
    kind: 'template',
    family: 'recipes',
    requires:
      recipe.file === 'ai-agent.apx'
        ? ['oracle:26.2:recipe/ai-service']
        : recipe.file === 'ai-service.apx'
          ? ['oracle:26.2:recipe/provider-key']
          : [],
    related: [],
    verification: compiled
      ? 'oracle-offline-compiler; not runtime-verified'
      : 'compiler-unverified; not runtime-verified',
    sha256: sha256(text),
    text,
  });
}
const ids = new Set(records.map(({ id }) => id));
const recipeNavigation = {
  'inventory/app/ai-agent/ai-agent': ['ai-agent', 'ai-provider-effort'],
  'inventory/gen-aiservice/gen-aiservice': ['ai-service', 'ai-provider-effort'],
  'inventory/web-credential/web-credential': ['oci-credential', 'security-credentials'],
  'inventory/app/workflow/version/activity/activity': ['draft-workflow', 'workflow-tasks'],
  'inventory/app/page/region/plugin-variants/interactive-report/interactive-report': [
    'report-chart',
    'reports-charts',
  ],
  'inventory/app/page/region/plugin-variants/chart/chart': ['report-chart', 'reports-charts'],
};
for (const [inventory, [recipe, guide]] of Object.entries(recipeNavigation)) {
  records
    .find(({ id }) => id === `oracle:26.2:${inventory}`)
    .related.push(`oracle:26.2:recipe/${recipe}`, `oracle:26.2:guide/${guide}`);
  const guideRecord = records.find(({ id }) => id === `oracle:26.2:guide/${guide}`);
  if (!guideRecord.related.includes(`oracle:26.2:recipe/${recipe}`))
    guideRecord.related.push(`oracle:26.2:recipe/${recipe}`);
}
if (
  ids.size !== records.length ||
  records.some(
    ({ requires, related, text }) =>
      text.length > 600_000 || [...requires, ...related].some((id) => !ids.has(id)),
  )
)
  throw new Error('Duplicate ID, dangling link or oversized reference.');
const output = JSON.stringify(records, null, 2) + '\n';
if (Buffer.byteLength(output) > 4 * 1024 * 1024)
  throw new Error('Compact 26.2 metadata index exceeds 4 MiB budget.');
const license = Buffer.from(unpacked[root + 'LICENSE.txt']).toString('utf8');
const search =
  JSON.stringify({
    schemaVersion: 1,
    indexSha256: sha256(output),
    postings: buildReferencePostings(
      records.map((entry) => (entry.document ? { ...entry, text: documents[entry.document] } : entry)),
    ),
  }) + '\n';
const files = {
  'index.json': output,
  'search.json': search,
  'ORACLE-LICENSE.txt': license,
  'oracle-snapshot.json':
    JSON.stringify(
      {
        schemaVersion: 1,
        release,
        commit,
        archiveSha256,
        license: 'UPL-1.0',
        licenseSha256: sha256(license),
        mmdVersion,
        indexSha256: sha256(output),
        searchSha256: sha256(search),
        records: records.length,
        scope:
          'Complete, byte-exact official 26.2 component inventory with paginated retrieval; selected application examples and separately labeled local guides/recipes. No upstream executable or orchestration policy.',
        inventoryCoverage: {
          documents: inventory.length,
          declarationKeywords: new Set(
            Object.values(inventoryDefinitions).map((entry) => entry.componentType),
          ).size,
          propertyAddresses: Object.values(inventoryDefinitions).reduce(
            (sum, entry) => sum + entry.properties.length,
            0,
          ),
          complete: true,
          denominator:
            'Every Markdown definition under apex/apexlang/26.2/apexlang-inventory/assets at the pinned commit. Property addresses are document/group/name occurrences, including variant contexts; not unique platform features or compiler MMD property IDs.',
        },
        inventoryDefinitions,
        sourceFiles,
        recipeFiles,
      },
      null,
      2,
    ) + '\n',
};
Object.assign(files, documents);
async function listFiles(directory, relative = '') {
  try {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) =>
          entry.isDirectory()
            ? listFiles(directory, path.posix.join(relative, entry.name))
            : [path.posix.join(relative, entry.name)],
        ),
      )
    ).flat();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
const oldDocuments = (await listFiles(outputRoot, 'documents')).filter(
  (name) => !Object.hasOwn(documents, name),
);
if (check && oldDocuments.length)
  throw new Error(`Obsolete official inventory files: ${oldDocuments.join(', ')}`);
for (const name of oldDocuments) await rm(path.join(outputRoot, name));
for (const [name, text] of Object.entries(files)) {
  if (check) {
    if ((await readFile(path.join(outputRoot, name), 'utf8')) !== text)
      throw new Error(`Stale ${outputRoot}/${name}`);
  } else {
    await mkdir(path.dirname(path.join(outputRoot, name)), { recursive: true });
    await writeFile(path.join(outputRoot, name), text);
  }
}
const releaseLock = {
  repository: 'https://github.com/oracle/skills',
  commit,
  license: 'UPL-1.0',
  mode: 'complete official versioned inventory and selected examples; no upstream executable or global skill sync',
  archiveSha256,
  indexSha256: sha256(output),
  snapshot: 'references/26.2/oracle-snapshot.json',
};
if (check) {
  if (JSON.stringify(lock.oracleSkills26_2) !== JSON.stringify(releaseLock))
    throw new Error('Stale 26.2 source lock.');
} else {
  lock.oracleSkills26_2 = releaseLock;
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
console.log(
  `${check ? 'Verified' : 'Imported'} ${inventory.length} complete Oracle inventory documents, ${records.length} references (${Buffer.byteLength(output)} metadata bytes); 26.1 preserved.`,
);
