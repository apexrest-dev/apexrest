import { hash } from '../fs.ts';
import { Fault } from '../result.ts';
import { semanticDigest } from './formats.ts';
import { declarations } from './reader.ts';
import { COMPOSER_262_PROFILE } from './profiles.ts';
import { parseApexLang } from '../preview/apexlang.ts';
import type { Entity, SharedResource, CompositionPlan } from './schemas.ts';

export interface EnumLovRequest {
  instanceId: string;
  field: string;
  type: Entity['read']['fields'][string]['type'];
  values: string[];
}
export type EnumLovReferences = Record<string, Record<string, string>>;
const limit = 512;
function semantics(profile: string, values: string[]) {
  return {
    kind: 'static-enum-lov' as const,
    formatVersion: 1 as const,
    profile,
    type: 'string' as const,
    values,
  };
}
function identities(key: string, profile: string) {
  const identity = 'cmp-enum-' + key.slice(0, 48),
    name = 'CMP_ENUM_' + key.slice(0, 48).toUpperCase();
  if (!['profile:apex261-ut261-mmd3102', COMPOSER_262_PROFILE].includes(profile))
    throw new Fault(
      'SHARED_RESOURCE_PROFILE_UNSUPPORTED',
      'Static enum LOVs require a pinned 26.1 or 26.2 Composer profile.',
      5,
    );
  return {
    identity,
    name,
    file:
      profile === COMPOSER_262_PROFILE
        ? `shared-components/lovs/${identity}.apx`
        : 'shared-components/lovs.apx',
  };
}
export function sharedEnumValuesSupported(values: string[]) {
  return (
    values.length > 0 &&
    values.length <= 100 &&
    new Set(values).size === values.length &&
    !values.some(
      (value) =>
        !value ||
        value.length > 128 ||
        /[\x00-\x1f\x7f`<>]|&[A-Za-z0-9_$#]+(?:![A-Za-z0-9_]+)?\.|#[A-Za-z0-9_$]+(?:![A-Za-z0-9_]+)?#|^\s*@/.test(
          value,
        ),
    )
  );
}
function admitted(values: string[]) {
  if (!sharedEnumValuesSupported(values))
    throw new Fault(
      'ENUM_LOV_LITERAL_UNSUPPORTED',
      'Shared enum LOVs require distinct nonempty single-line literal text without markup or APEX substitutions.',
      5,
    );
}
/** Native entry nodes preserve delimiters and quoted literal text; no STATIC: serialization. */
export function enumLovSource(resource: Pick<SharedResource, 'identity' | 'name' | 'values'>) {
  return (
    `lov ${resource.identity} (\n    name: ${resource.name}\n    source {\n        location: staticValues\n    }\n` +
    resource.values
      .map(
        (value, i) =>
          `    entry value-${i + 1} (\n        sequence: ${(i + 1) * 10}\n        display: ${JSON.stringify(value)}\n        return: ${JSON.stringify(value)}\n    )\n`,
      )
      .join('') +
    ')\n'
  );
}
function lovs(sources: Record<string, string>) {
  return Object.entries(sources).flatMap(([file, source]) =>
    declarations(source)
      .filter((node) => node.kind === 'lov')
      .map((node) => {
        const text = source.slice(node.start, node.end);
        try {
          const parsed = parseApexLang(text, file),
            definition = parsed[0],
            name = definition?.props.name;
          if (
            parsed.length !== 1 ||
            definition?.type !== 'lov' ||
            !['string', 'number', 'boolean'].includes(typeof name)
          )
            throw new Error('LOV identity or direct name is unavailable.');
          return { file, node, identity: definition.id, name: String(name), text };
        } catch {
          throw new Fault(
            'SHARED_RESOURCE_SOURCE_UNSUPPORTED',
            'A shared LOV identity/name cannot be safely read. Its source was preserved; resolve unsupported syntax before composing.',
            5,
          );
        }
      }),
  );
}
/** Verify immutable declaration ownership without adopting an edited shared object. */
function verifySharedLov(
  key: string,
  resource: SharedResource,
  declared: ReturnType<typeof lovs>,
  bases?: Record<string, string>,
) {
  admitted(resource.values);
  const expected = identities(key, resource.profile),
    source = enumLovSource(resource),
    matches = declared.filter(({ identity }) => identity.toUpperCase() === resource.identity.toUpperCase()),
    names = declared.filter(({ name }) => name.toUpperCase() === resource.name);
  if (
    semanticDigest(semantics(resource.profile, resource.values)) !== key ||
    resource.identity !== expected.identity ||
    resource.name !== expected.name ||
    resource.file !== expected.file ||
    resource.kind !== 'static-enum-lov' ||
    resource.type !== 'string' ||
    resource.formatVersion !== 1 ||
    hash(source) !== resource.base ||
    resource.digest !== resource.base ||
    (bases && bases[resource.base] !== source)
  )
    throw new Fault(
      'SHARED_RESOURCE_STATE_INVALID',
      'Shared LOV identity, semantic key or generated base is inconsistent. Preserve state and reconcile the resource.',
      5,
    );
  if (
    matches.length !== 1 ||
    names.length !== 1 ||
    names[0] !== matches[0] ||
    matches[0]!.file !== resource.file ||
    matches[0]!.node.depth !== 0 ||
    hash(matches[0]!.text) !== resource.digest
  )
    throw new Fault(
      'SHARED_RESOURCE_EDITED',
      'An owned shared LOV is missing, duplicated or manually edited. Its source was preserved; restore its reviewed definition before composing.',
      5,
    );
}
export function verifySharedLovs(
  resources: Record<string, SharedResource>,
  sources: Record<string, string>,
  bases?: Record<string, string>,
) {
  if (!Object.keys(resources).length) return;
  const declared = lovs(sources);
  for (const [key, resource] of Object.entries(resources)) verifySharedLov(key, resource, declared, bases);
}

export function planEnumLovs(input: {
  profile: string;
  requests: EnumLovRequest[];
  sources: Record<string, string>;
  bases: Record<string, string>;
  previous?: Record<string, SharedResource>;
  detachedConsumers: Set<string>;
}) {
  const resources: Record<string, SharedResource> = {},
    references: EnumLovReferences = Object.create(null),
    files: Record<string, string> = {},
    bases: Record<string, string> = {},
    diagnostics: CompositionPlan['diagnostics'] = [];
  if (!input.requests.length && !Object.keys(input.previous ?? {}).length)
    return { resources, references, files, bases, diagnostics };
  const declared = lovs(input.sources),
    active = new Map<string, Set<string>>();
  for (const [key, previous] of Object.entries(input.previous ?? {})) {
    verifySharedLov(key, previous, declared, input.bases);
    resources[key] = {
      ...previous,
      consumers: previous.consumers.filter((id) => input.detachedConsumers.has(id)),
      retained: true,
    };
  }
  for (const request of input.requests) {
    if (request.type !== 'string')
      throw new Fault(
        'ENUM_LOV_TYPE_UNSUPPORTED',
        'Shared enum LOVs currently support string fields. Numeric, temporal and boolean enum contracts require a separate verified adapter.',
        5,
      );
    admitted(request.values);
    const semantic = semantics(input.profile, request.values),
      key = semanticDigest(semantic),
      allocated = identities(key, input.profile);
    let resource = resources[key];
    if (!resource) {
      if (
        declared.some(
          ({ identity, name }) =>
            identity.toUpperCase() === allocated.identity.toUpperCase() ||
            name.toUpperCase() === allocated.name,
        ) ||
        Object.values(resources).some(
          (other) => other.identity === allocated.identity || other.name === allocated.name,
        ) ||
        (input.profile === COMPOSER_262_PROFILE && Object.hasOwn(input.sources, allocated.file))
      )
        throw new Fault(
          'SHARED_RESOURCE_COLLISION',
          'A shared LOV identity or path already belongs to unmanaged source. Composer will not adopt or replace it.',
          5,
        );
      const generated = enumLovSource({ ...allocated, values: request.values }),
        digest = hash(generated);
      resource = resources[key] = {
        ...semantic,
        ...allocated,
        base: digest,
        digest,
        consumers: [],
        retained: false,
      };
      bases[digest] = generated;
      const current = files[resource.file] ?? input.sources[resource.file] ?? '';
      files[resource.file] = current + (current && !current.endsWith('\n') ? '\n' : '') + generated;
    }
    resource.retained = false;
    const consumers = active.get(key) ?? new Set<string>();
    consumers.add(request.instanceId);
    active.set(key, consumers);
    references[request.instanceId] ??= Object.create(null);
    references[request.instanceId]![request.field] = resource.identity;
  }
  if (Object.keys(resources).length > limit)
    throw new Fault(
      'SHARED_RESOURCE_LIMIT',
      `At most ${limit} shared enum LOVs may be tracked. Retired resources require separate reviewed cleanup.`,
      5,
    );
  for (const [key, resource] of Object.entries(resources)) {
    resource.consumers = [...new Set([...resource.consumers, ...(active.get(key) ?? [])])].sort();
    if (resource.retained)
      diagnostics.push({
        code: 'SHARED_RESOURCE_RETAINED',
        severity: 'info',
        message: `Retained ${resource.identity} unchanged for detached or unknown consumers. Automatic shared-resource cleanup is unsupported.`,
      });
  }
  return { resources, references, files, bases, diagnostics };
}
