import { z } from 'zod';
import type { ProjectContext } from './config.ts';
import { Fault } from './result.ts';
import { scaffoldSchema, type ScaffoldSpec } from './scaffold-spec.ts';
import { scaffoldSpec } from './scaffold.ts';
import { loadEntity, type EntityContract } from './entities.ts';

/**
 * Compact page requests (`project action:recipe`): a recipe, an entity contract and bounded
 * overrides expand deterministically into an ordinary scaffold specification, which the existing
 * scaffold emitter, ownership checks and shipping workflow then handle. Recipes: `report-form` (an
 * interactive report with a modal create/edit form, or a read-only form) and `filtered-dashboard`
 * (a filter item driving cards and a count chart). The same recipe, contract, pages and overrides
 * always give the same specification and component ids. Contracts with diagnostics, a changed
 * contract digest and unknown overrides are refused before any source changes. The expanded
 * specification is returned; the full-specification scaffold path is unchanged.
 */

const page = z.number().int().min(1).max(99999);
const field = z.string().regex(/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/u);
const label = z.string().trim().min(1).max(240);

export const recipeRequestSchema = z.discriminatedUnion('recipe', [
  z.strictObject({
    recipe: z.literal('report-form'),
    entity: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/u),
    entityDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    pages: z.strictObject({ report: page, form: page }),
    overrides: z
      .strictObject({
        reportTitle: label.optional(),
        formTitle: label.optional(),
        /** Report columns in display order (default: every field). */
        columns: z.array(field).min(1).max(100).optional(),
        emptyMessage: label.optional(),
        createLabel: label.optional(),
      })
      .default({}),
  }),
  z.strictObject({
    recipe: z.literal('filtered-dashboard'),
    entity: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/u),
    entityDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    pages: z.strictObject({ dashboard: page }),
    overrides: z
      .strictObject({
        title: label.optional(),
        /** The field to filter by; it needs static LOV values (default: the first such field). */
        filter: field.optional(),
        cardTitle: field.optional(),
        cardBody: field.optional(),
      })
      .default({}),
  }),
]);
export type RecipeRequest = z.infer<typeof recipeRequestSchema>;

const upper = (name: string) => name.toUpperCase();
function fieldOf(contract: EntityContract, name: string) {
  const key = Object.keys(contract.fields).find((candidate) => upper(candidate) === upper(name));
  if (!key) throw new Fault('RECIPE_FIELD_UNKNOWN', `${contract.id} has no field ${name}.`, 2);
  return { name: upper(key), definition: contract.fields[key]! };
}
/** Rows of the entity: its table, or its reviewed SQL as an inline view. */
function source(contract: EntityContract, columns: string[]) {
  const list = columns.join(', ');
  if ('table' in contract.read)
    return `select ${list} from ${contract.read.owner ? `${contract.read.owner}.` : ''}${contract.read.table}`;
  return `select ${list} from (\n${contract.read.sql}\n)`;
}
const itemType = (definition: EntityContract['fields'][string], key: boolean) =>
  key
    ? 'hidden'
    : definition.readOnly
      ? 'displayOnly'
      : definition.lov && 'values' in definition.lov
        ? 'selectList'
        : definition.type === 'number'
          ? 'numberField'
          : definition.type === 'date' || definition.type === 'timestamp'
            ? 'datePicker'
            : 'textField';

/** Expands a request against a loaded contract; pure and deterministic. */
export function expandRecipe(
  request: RecipeRequest,
  contract: EntityContract,
): { spec: ScaffoldSpec; warnings: string[] } {
  const warnings: string[] = [];
  const readScheme = 'scheme' in contract.authorization.read ? contract.authorization.read.scheme : undefined;
  const keys = contract.key.map(upper);
  const all = Object.keys(contract.fields).map(upper);
  let pages: unknown[];
  if (request.recipe === 'report-form') {
    const { report, form } = request.pages;
    if (report === form) throw new Fault('INVALID_INPUT', 'The report and form need two different pages.', 2);
    if (keys.length !== 1)
      throw new Fault(
        'RECIPE_UNSUPPORTED',
        'report-form links rows by a single key column; this contract has a composite key.',
        2,
      );
    const key = keys[0]!;
    const shown = (request.overrides.columns ?? all).map((name) => fieldOf(contract, name).name);
    if (new Set(shown).size !== shown.length) throw new Fault('INVALID_INPUT', 'Report columns repeat.', 2);
    const columns = shown.includes(key) ? shown : [key, ...shown];
    const writable = contract.write;
    const reportId = `${contract.id}-report`;
    const formId = `${contract.id}-form`;
    const items = all.map((name) => {
      const { definition } = fieldOf(contract, name);
      const isKey = keys.includes(name);
      const type = writable ? itemType(definition, isKey) : isKey ? 'hidden' : 'displayOnly';
      if (definition.lov && 'shared' in definition.lov && !isKey)
        warnings.push(
          `P${form}_${name} is a text field; bind it to shared LOV ${definition.lov.shared} with a bindLov edit after generation.`,
        );
      return {
        name: `P${form}_${name}`,
        region: formId,
        type,
        ...(isKey ? {} : { label: definition.label }),
        ...(definition.required && !isKey && type !== 'displayOnly' ? { required: true } : {}),
        ...(definition.formatMask && (type === 'numberField' || type === 'datePicker')
          ? { formatMask: definition.formatMask }
          : {}),
        ...(type === 'selectList' && definition.lov && 'values' in definition.lov
          ? { lov: definition.lov.values }
          : {}),
        sourceColumn: name,
        dataType: definition.type,
        ...(isKey ? { primaryKey: true } : {}),
      };
    });
    const operations =
      writable?.operations.map((operation) => (operation === 'insert' ? 'add' : operation)) ?? [];
    pages = [
      {
        id: report,
        name: request.overrides.reportTitle ?? contract.pluralLabel,
        ...(readScheme ? { authorizationScheme: readScheme } : {}),
        regions: [
          {
            id: reportId,
            type: 'interactiveReport',
            name: request.overrides.reportTitle ?? contract.pluralLabel,
            sql: source(contract, columns),
            refreshOnDialogClose: true,
            ...(request.overrides.emptyMessage ? { emptyMessage: request.overrides.emptyMessage } : {}),
            columns: columns.map((name) => {
              const { definition } = fieldOf(contract, name);
              return {
                name,
                heading: definition.label,
                dataType: definition.type,
                ...(definition.formatMask ? { formatMask: definition.formatMask } : {}),
                ...(name === key
                  ? { link: { page: form, items: { [`P${form}_${key}`]: `#${key}#` }, clearCache: [form] } }
                  : {}),
              };
            }),
          },
        ],
        ...(writable?.operations.includes('insert')
          ? {
              buttons: [
                {
                  id: `create-${contract.id}`,
                  label: request.overrides.createLabel ?? `Create ${contract.label}`,
                  region: reportId,
                  target: { page: form, clearCache: [form] },
                },
              ],
            }
          : {}),
      },
      {
        id: form,
        name: request.overrides.formTitle ?? contract.label,
        mode: 'modalDialog',
        // Editable forms need the write scheme; read-only forms the read scheme.
        ...((writable ? contract.authorization.write?.scheme : readScheme)
          ? { authorizationScheme: writable ? contract.authorization.write!.scheme : readScheme }
          : {}),
        regions: [
          writable
            ? {
                id: formId,
                type: 'form',
                name: request.overrides.formTitle ?? contract.label,
                table: writable.table,
                edit: {
                  operations,
                  ...(typeof writable.lostUpdate === 'object'
                    ? { rowVersionColumn: upper(writable.lostUpdate.rowVersion) }
                    : {}),
                },
              }
            : {
                id: formId,
                type: 'form',
                name: request.overrides.formTitle ?? contract.label,
                sql: `${source(contract, all)} where ${key} = :P${form}_${key}`,
              },
        ],
        items,
      },
    ];
  } else {
    const { dashboard } = request.pages;
    const filter = request.overrides.filter
      ? fieldOf(contract, request.overrides.filter)
      : Object.keys(contract.fields)
          .map((name) => fieldOf(contract, name))
          .find(({ definition }) => definition.lov && 'values' in definition.lov);
    if (!filter || !filter.definition.lov || !('values' in filter.definition.lov))
      throw new Fault(
        'RECIPE_UNSUPPORTED',
        'filtered-dashboard needs a filter field with static LOV values in the contract.',
        2,
      );
    const others = all.filter((name) => !keys.includes(name) && name !== filter.name);
    const title = request.overrides.cardTitle
      ? fieldOf(contract, request.overrides.cardTitle).name
      : others[0];
    const body = request.overrides.cardBody
      ? fieldOf(contract, request.overrides.cardBody).name
      : filter.name;
    if (!title)
      throw new Fault('RECIPE_UNSUPPORTED', 'filtered-dashboard needs a field for the card title.', 2);
    const item = `P${dashboard}_${filter.name}`;
    const predicate = `(:${item} is null or ${filter.name} = :${item})`;
    const cards = `${contract.id}-cards`;
    const chart = `${contract.id}-chart`;
    const columns = [...new Set([...keys, title, body])];
    pages = [
      {
        id: dashboard,
        name: request.overrides.title ?? contract.pluralLabel,
        ...(readScheme ? { authorizationScheme: readScheme } : {}),
        regions: [
          { id: `${contract.id}-filters`, type: 'staticContent', name: 'Filters' },
          {
            id: cards,
            type: 'cards',
            name: contract.pluralLabel,
            sql: `select ${columns.join(', ')} from (\n${source(contract, columns)}\n) where ${predicate}`,
            itemsToSubmit: [item],
            titleColumn: title,
            bodyColumn: body,
          },
          {
            id: chart,
            type: 'chart',
            name: `${contract.pluralLabel} by ${filter.definition.label}`,
            chartType: 'bar',
            series: [
              {
                id: 'count',
                name: contract.pluralLabel,
                sql: `select ${filter.name} label, count(*) value from (\n${source(contract, [filter.name])}\n) where ${predicate} group by ${filter.name} order by 1`,
                itemsToSubmit: [item],
                labelColumn: 'LABEL',
                valueColumn: 'VALUE',
              },
            ],
          },
        ],
        items: [
          {
            name: item,
            region: `${contract.id}-filters`,
            type: 'selectList',
            label: filter.definition.label,
            lov: filter.definition.lov.values,
          },
        ],
        refreshes: [{ items: [item], regions: [cards, chart] }],
      },
    ];
  }
  const spec = scaffoldSchema.safeParse({ pages });
  if (!spec.success) {
    const issue = spec.error.issues[0];
    throw new Fault(
      'RECIPE_INVALID',
      `The expanded specification is invalid at ${issue?.path.join('.')}: ${issue?.message}`,
      5,
    );
  }
  return { spec: spec.data, warnings };
}

export async function runRecipe(
  ctx: ProjectContext,
  input: { request: unknown; env?: string | undefined; dryRun?: boolean | undefined },
) {
  const parsed = recipeRequestSchema.safeParse(input.request);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Fault('INVALID_INPUT', `Recipe request ${issue?.path.join('.')}: ${issue?.message}`, 2);
  }
  const request = parsed.data;
  const entity = await loadEntity(ctx, request.entity);
  if (request.entityDigest && request.entityDigest !== entity.digest)
    throw new Fault(
      'TRANSFORM_CONFLICT',
      `${entity.file} changed since it was reviewed; read it again.`,
      5,
      'conflict',
      {
        file: entity.file,
        currentDigest: entity.digest,
      },
    );
  if (entity.diagnostics.length)
    throw new Fault(
      'ENTITY_INVALID',
      `${entity.file} has diagnostics: ${entity.diagnostics.map((d) => d.code).join(', ')}. Fix the contract first.`,
      2,
    );
  const { spec, warnings } = expandRecipe(request, entity.contract);
  const raw = JSON.stringify(spec, null, 2) + '\n';
  const base = {
    recipe: request.recipe,
    entity: entity.id,
    entityDigest: entity.digest,
    spec,
    ...(warnings.length ? { warnings } : {}),
  };
  if (input.dryRun)
    return { ...base, written: false, next: 'Review the expanded specification, then run without dryRun.' };
  const result = await scaffoldSpec(ctx, spec, raw, input.env, async () => {
    if ((await loadEntity(ctx, request.entity)).digest !== entity.digest)
      throw new Fault(
        'SOURCE_DRIFT',
        `${entity.file} changed before writing; the staged exact input is retained.`,
        5,
      );
  });
  return { ...base, written: true, scaffold: result };
}
