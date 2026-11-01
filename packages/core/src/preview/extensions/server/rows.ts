import { ref, str, type ApxComponent } from '../../apexlang.ts';
import type { ApexError, ApexRenderer, RenderContext } from '../../render.ts';
import { Cells, peekState, stateKey, type GridChange } from '../reports/shared.ts';

/**
 * Validations of editable regions (interactive grids). APEX runs them once per inserted or
 * updated row with the row's columns as bind variables (and :APEX$ROW_STATUS), collects every
 * failure and associates it with the row and column, for both the grid's own Save (Ajax) and a
 * page submit that carries grid changes.
 */

export interface RowError {
  /** Record identity of the change (as sent by the grid client). */
  id?: string;
  column?: string;
  message: string;
}

const ROW_STATUS = { insert: 'C', update: 'U', delete: 'D' } as const;

export function regionValidations(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
): ApxComponent[] {
  return renderer
    .pageComponents(ctx, 'validation')
    .filter((validation) => ref(validation.props, 'validation.editableRegion') === region.id)
    .sort(
      (a, b) =>
        Number(str(a.props, 'execution.sequence', '0')) - Number(str(b.props, 'execution.sequence', '0')),
    );
}

/** Column validations (columnIsNotNull, ...) are the item validations of the row's column binds. */
function asItemValidation(validation: ApxComponent): ApxComponent {
  const type = str(validation.props, 'validation.type');
  if (!/^column/u.test(type)) return validation;
  const settings = validation.props.validation as Record<string, unknown>;
  return {
    ...validation,
    props: {
      ...validation.props,
      validation: {
        ...settings,
        type: type.replace(/^column/u, 'item'),
        item: str(validation.props, 'validation.column'),
      },
    } as ApxComponent['props'],
  };
}

/** Runs the region's validations for every inserted or updated row; all failures are returned. */
export function validateRows(
  renderer: ApexRenderer,
  ctx: RenderContext,
  region: ApxComponent,
  changes: GridChange[],
): RowError[] {
  const validations = regionValidations(renderer, ctx, region);
  if (!validations.length || !changes.length) return [];
  const cells = new Cells(renderer, ctx, region);
  const columns = region.children.filter((child) => child.type === 'column');
  const heading = (name: string) => {
    const column = columns.find((candidate) => candidate.id.toUpperCase() === name);
    return column ? cells.label(column) : name;
  };
  const errors: RowError[] = [];
  const items = ctx.session.items;
  for (const change of changes) {
    if (change.op === 'delete') continue;
    const saved: Record<string, string | undefined> = {};
    const overlay = { ...change.values, APEX$ROW_STATUS: ROW_STATUS[change.op] };
    for (const [name, value] of Object.entries(overlay)) {
      saved[name] = Object.hasOwn(items, name) ? items[name] : undefined;
      items[name] = value ?? '';
    }
    try {
      for (const validation of validations) {
        if (!renderer.whenButton(ctx, validation.props) || !renderer.condition(ctx, validation.props))
          continue;
        const column = (
          str(validation.props, 'error.associatedColumn') || str(validation.props, 'validation.column')
        ).toUpperCase();
        const message = renderer.validationFailure(ctx, asItemValidation(validation), {
          columnHeader: column ? heading(column) : '',
        });
        if (message === null) continue;
        errors.push({
          ...(change.id ? { id: change.id } : {}),
          ...(column ? { column } : {}),
          message,
        });
      }
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete items[name];
        else items[name] = value;
      }
    }
  }
  return errors;
}

/** Row errors in the `apex.message.showErrors` shape, associated with the grid row and column. */
export function rowErrorsForPage(
  renderer: ApexRenderer,
  region: ApxComponent,
  errors: RowError[],
): ApexError[] {
  const regionDomId = renderer.regionDomId(region);
  return errors.map((error) => ({
    type: 'error',
    location: ['page'],
    regionDomId,
    ...(error.id ? { recordId: error.id } : {}),
    ...(error.column ? { columnName: error.column } : {}),
    message: error.message,
    unsafe: false,
  }));
}

/** Page submit: validates the grid changes staged by the browser (see the ig-stage route). */
export function pageRowValidation(renderer: ApexRenderer, ctx: RenderContext): ApexError[] {
  const regions = new Map<string, ApxComponent>();
  for (const validation of renderer.pageComponents(ctx, 'validation')) {
    const id = ref(validation.props, 'validation.editableRegion');
    if (!id || regions.has(id)) continue;
    const region = renderer.pageComponents(ctx, 'region').find((candidate) => candidate.id === id);
    if (region) regions.set(id, region);
  }
  const errors: ApexError[] = [];
  for (const region of regions.values()) {
    const state = peekState(ctx.session, stateKey(ctx.pageId, region.id));
    const changes = state?.pending?.changes ?? [];
    const failures = validateRows(renderer, ctx, region, changes);
    if (!failures.length) continue;
    // The browser stages the grid changes again with the next submit.
    if (state) state.pending = undefined;
    errors.push(...rowErrorsForPage(renderer, region, failures));
  }
  return errors;
}
