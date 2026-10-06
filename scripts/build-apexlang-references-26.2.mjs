// Offline import of a pinned, reviewed data-only subset. Never runs Oracle skills or scripts.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { buildReferencePostings } from '../packages/core/src/reference-index.ts';

const commit = '03ee10d02273bc4002fd527089e7fbb5884f94c4';
const archiveSha256 = '5e65f9734c3e4c00054ed91e2e14c795be09d17aaa96ddb43f25f4e6d4d3a343';
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
// Exact files, with selected property groups for large generated inventories. This is deliberately
// not a recursive vendor import: no SKILL.md, orchestration policy, SQL, shell, or deployment script.
const inventory = {
  'app/app.md': ['identification (direct group)', 'databaseSession', 'security', 'genAI'],
  'app/page/page.md': ['identification (direct group)', 'appearance', 'advanced'],
  'app/ai-agent/ai-agent.md': null,
  'app/ai-agent/tool/tool.md': null,
  'app/ai-agent/tool/parameter/parameter.md': null,
  'gen-aiservice/gen-aiservice.md': null,
  'web-credential/web-credential.md': null,
  'app/lov/lov.md': null,
  'app/lov/entry/entry.md': null,
  'app/list/list.md': null,
  'app/list/entry/entry.md': null,
  'app/breadcrumb/breadcrumb.md': null,
  'app/page/dynamic-action/plugin-variants/show-ai-assistant/show-ai-assistant.md': [
    'identification (direct group)',
    'initialPrompt',
    'appearance',
    'genAI',
  ],
  'app/page/region/plugin-variants/interactive-report/interactive-report.md': [
    'identification (direct group)',
    'genAI',
    'searchBar',
    'actionsMenu',
    'performance',
  ],
  'app/page/region/plugin-variants/chart/chart.md': [
    'identification (direct group)',
    'chart',
    'animation',
    'autoRefresh',
    'performance',
    'accessibility',
  ],
  'app/page/region/saved-report-c2/computation/computation.md': null,
  'app/page/region/saved-report-c2/filter/filter.md': null,
  'app/task-definition/task-definition.md': null,
  'app/task-definition/action/action.md': null,
  'app/workflow/workflow.md': null,
  'app/workflow/parameter/parameter.md': null,
  'app/workflow/version/version.md': null,
  'app/workflow/version/activity/activity.md': [
    'identification (direct group)',
    'advanced',
    'layout',
    'comments',
  ],
  'app/workflow/version/activity/connection-c1/connection-c1.md': null,
  'app/workflow/version/activity/connection-c2/connection-c2.md': null,
  'app/workflow/version/activity/plugin-variants/workflow-start/workflow-start.md': null,
  'app/workflow/version/activity/plugin-variants/workflow-end/workflow-end.md': null,
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
  ...Object.keys(inventory).map((file) => `apexlang-inventory/assets/${file}`),
  ...exampleFiles.map((file) => `apexlang-example-applications/assets/${file}`),
]);
const unpacked = unzipSync(bytes, {
  filter: ({ name, originalSize }) => {
    if (originalSize > 4 * 1024 * 1024) throw new Error('Oversized upstream file.');
    return (
      name === root + 'LICENSE.txt' || (name.startsWith(prefix) && selected.has(name.slice(prefix.length)))
    );
  },
});
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
    const groups = inventory[relative];
    const sections = raw.split(/(?=^### )/m);
    if (groups && groups.some((group) => !sections.some((section) => section.startsWith(`### ${group}\n`))))
      throw new Error(`Reviewed property group missing: ${relative}`);
    const text = groups
      ? sections[0] +
        sections
          .slice(1)
          .filter((section) => groups.some((group) => section.startsWith(`### ${group}\n`)))
          .join('')
      : raw;
    const parent = path.posix.dirname(path.posix.dirname(relative));
    const parentFile = `${parent}/${path.posix.basename(parent)}.md`;
    records.push({
      id: inventoryId(relative),
      version: `${release}@${commit.slice(0, 7)}`,
      source: `https://github.com/oracle/skills/blob/${commit}/apex/apexlang/26.2/${file}`,
      title: `${raw.match(/^# (.+)/)?.[1] ?? relative} — 26.2 property inventory`,
      kind: 'contract',
      family: `inventory/${path.posix.dirname(relative)}`,
      requires:
        inventory[parentFile] !== undefined && parentFile !== relative ? [inventoryId(parentFile)] : [],
      related: [],
      verification: 'reviewed-oracle-inventory; not runtime-verified',
      ...(groups ? { selectedPropertyGroups: groups } : {}),
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
  const text = `# APEX 26.2 recipe: ${recipe.file}\n\nTarget source path: \`${recipe.target}\`.\n\n${compiled ? 'Verified by the real Oracle 26.2.0+3479 offline compiler, together with the other recipe files and a generated application scaffold.' : 'Compiler verification is absent or stale for these source bytes.'} This file is a fragment, not a standalone application. Source queries, credentials, provider availability, workflow execution, database installation and browser behavior are not verified. Workspace components are excluded from selected-file import.\n\n\`\`\`apexlang\n${source.trimEnd()}\n\`\`\`\n`;
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
if (Buffer.byteLength(output) > 1024 * 1024)
  throw new Error('Reviewed 26.2 reference corpus exceeds 1 MiB budget.');
const license = Buffer.from(unpacked[root + 'LICENSE.txt']).toString('utf8');
const files = {
  'index.json': output,
  'search.json':
    JSON.stringify({
      schemaVersion: 1,
      indexSha256: sha256(output),
      postings: buildReferencePostings(records),
    }) + '\n',
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
        mmdVersion: '26.2.0+3479',
        indexSha256: sha256(output),
        records: records.length,
        scope:
          'Exact reviewed 26.2 inventory properties and selected application source examples; no executable scripts, upstream skills or orchestration policies. Full source hashes are retained for section excerpts.',
        selectedPropertyGroups: inventory,
        sourceFiles,
        recipeFiles,
      },
      null,
      2,
    ) + '\n',
};
for (const [name, text] of Object.entries(files)) {
  if (check) {
    if ((await readFile(path.join(outputRoot, name), 'utf8')) !== text)
      throw new Error(`Stale ${outputRoot}/${name}`);
  } else {
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, name), text);
  }
}
const lockPath = 'toolchains/sources.lock.json';
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const releaseLock = {
  repository: 'https://github.com/oracle/skills',
  commit,
  license: 'UPL-1.0',
  mode: 'reviewed versioned inventory and examples; no upstream executable or global skill sync',
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
  `${check ? 'Verified' : 'Imported'} ${records.length} reviewed 26.2 references (${Buffer.byteLength(output)} bytes); 26.1 preserved.`,
);
