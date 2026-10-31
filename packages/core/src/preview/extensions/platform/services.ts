import { get, isObject, ref, str, type ApxComponent } from '../../apexlang.ts';
import { processHandler, type ProcessResult } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import type { Runtime, Stub, StubArgs } from '../server/apex-api.ts';
import { PlsqlException } from '../server/plsql.ts';
import { getPreference, resetPreferences, setPreference } from './admin.ts';
import { ensureDictionary } from './dictionary.ts';
import { bySequence, findShared, insertRow, now, one, raw, refName, staticIdOf } from './store.ts';

/**
 * Execution chains, the User Preferences process, and a minimal record of workflows and human
 * tasks (APEX_WORKFLOWS / APEX_TASKS). Workflow activities and task actions are not executed.
 */

type Pressed = Parameters<NonNullable<ReturnType<typeof processHandler>>>[4];

// ------------------------------------------------------------------ execution chains

/** Children of a chain, in sequence order. */
const chainChildren = (renderer: ApexRenderer, ctx: RenderContext, chain: ApxComponent) =>
  bySequence(
    renderer
      .pageComponents(ctx, 'process')
      .filter((process) => ref(process.props, 'executionChain') === chain.id),
  );

/** Runs one process the way the page processing loop would. */
function runProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  point: 'beforeHeader' | 'submit',
  pressed: Pressed,
): ProcessResult {
  const type = str(process.props, 'type');
  const handler = processHandler(type);
  if (handler) return handler(renderer, ctx, process, point, pressed);
  if (type === 'executeCode') return { ran: renderer.runCode(ctx, process) };
  if (type === 'formAutoRowProcessing')
    return { ran: renderer.processForm(ctx, ref(process.props, 'formRegion'), pressed) };
  if (type === 'formInitialization') {
    renderer.initializeForm(ctx, ref(process.props, 'formRegion'));
    return { ran: true };
  }
  if (type === 'clearSessionState') {
    renderer.clearPage(ctx);
    return { ran: true };
  }
  if (type === 'closeDialog') return { ran: true, closeDialog: true };
  renderer.diagnose('info', `Process type ${type} (${process.id}) is not simulated`, ctx.pageId, process.id);
  return { ran: false };
}

export function executionChain(
  renderer: ApexRenderer,
  ctx: RenderContext,
  chain: ApxComponent,
  point: 'beforeHeader' | 'submit',
  pressed: Pressed,
): ProcessResult {
  const background = str(chain.props, 'backgroundExecution.runInBackground') === 'true';
  if (background) {
    renderer.diagnose(
      'info',
      `Execution chain ${chain.id} runs in the background in APEX; the local preview runs it inline, in this request`,
      ctx.pageId,
      chain.id,
    );
    const idItem = str(chain.props, 'backgroundExecution.returnIdIntoItem');
    if (idItem) ctx.session.items[idItem.toUpperCase()] = String(Date.now());
  }
  let closeDialog = false;
  for (const child of chainChildren(renderer, ctx, chain)) {
    if (!renderer.whenButton(ctx, child.props) || !renderer.condition(ctx, child.props)) continue;
    const result = runProcess(renderer, ctx, child, point, pressed);
    if (result.errors?.length) return background ? { ran: false } : result;
    if (result.redirectURL) return result;
    if (result.closeDialog) closeDialog = true;
  }
  return { ran: true, ...(closeDialog ? { closeDialog } : {}) };
}

// ------------------------------------------------------------------ user preferences

export function userPreferencesProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const type = str(process.props, 'action.type', 'setToItemValue');
  if (type === 'resetPreferences') {
    resetPreferences(renderer, ctx);
    return { ran: true };
  }
  const name = str(process.props, 'action.preferenceName');
  const item = str(process.props, 'action.item').toUpperCase();
  if (!name || !item) return { ran: false };
  const value = ctx.session.items[item] ?? '';
  if (type === 'setToItemValueIfNotNull' && value === '') return { ran: true };
  setPreference(renderer, ctx, name, value === '' ? null : value);
  return { ran: true };
}

export const preferenceCondition =
  (equal: boolean) => (renderer: ApexRenderer, ctx: RenderContext, condition: Record<string, unknown>) => {
    const props = condition as import('../../apexlang.ts').ApxObject;
    const value = getPreference(renderer, ctx, str(props, 'preference')) ?? '';
    return (value === str(props, 'value')) === equal;
  };

// ------------------------------------------------------------------ workflows and tasks

const appIdOf = (renderer: ApexRenderer) => Number(renderer.appId) || 0;
const nextId = (renderer: ApexRenderer, table: string, column: string) =>
  Number(one(raw(renderer), `select coalesce(max(${column}), 0) + 1 as id from ${table}`)?.id ?? 1);

function raise(message: string): never {
  throw new PlsqlException('ora-20987', -20987, message, 'app', `ORA-20987: ${message}`);
}

/** Process/API parameters as a JSON object for the task/workflow row. */
function processParameters(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const parameter of process.children.filter((child) => child.type === 'parameter')) {
    const name = refName(get(parameter.props, 'name')) || parameter.id;
    const value = isObject(parameter.props.value) ? parameter.props.value : {};
    const item = str(value, 'item');
    values[name] = item
      ? (ctx.session.items[item.toUpperCase()] ?? '')
      : renderer.substitute(ctx.session, str(value, 'staticValue'), ctx.page, 'RAW');
  }
  return values;
}

export function startWorkflow(
  renderer: ApexRenderer,
  ctx: RenderContext,
  staticId: string,
  detailPk: string | null,
  parameters: Record<string, string>,
  initiator?: string,
): number {
  ensureDictionary(renderer);
  const definition = findShared(renderer, 'workflow', staticId);
  if (!definition) raise(`Workflow ${staticId} is not defined in the APEXlang source`);
  const id = nextId(renderer, 'apex_local_workflows', 'workflow_id');
  const title = renderer.substitute(
    ctx.session,
    str(definition.props, 'title') || str(definition.props, 'name', definition.id),
    ctx.page,
    'RAW',
  );
  insertRow(raw(renderer), 'apex_local_workflows', {
    workflow_id: id,
    application_id: appIdOf(renderer),
    workflow_def_static_id: staticIdOf(definition),
    workflow_def_name: str(definition.props, 'name', definition.id),
    title,
    detail_pk: detailPk,
    initiator: (initiator ?? ctx.session.user).toUpperCase(),
    state_code: 'ACTIVE',
    parameters: JSON.stringify(parameters),
    session_id: ctx.session.id,
    created_on: now(),
    last_updated_on: now(),
  });
  renderer.diagnose(
    'info',
    `Workflow ${staticIdOf(definition)} instance ${id} recorded in APEX_WORKFLOWS; its activities are not executed locally`,
    ctx.pageId,
  );
  return id;
}

export function createTask(
  renderer: ApexRenderer,
  ctx: RenderContext,
  staticId: string,
  options: {
    subject?: string | null;
    detailPk?: string | null;
    priority?: number | null;
    parameters?: Record<string, string>;
    initiator?: string | null;
  },
): number {
  ensureDictionary(renderer);
  const definition = findShared(renderer, 'taskDefinition', staticId);
  if (!definition) raise(`Task definition ${staticId} is not defined in the APEXlang source`);
  const id = nextId(renderer, 'apex_local_tasks', 'task_id');
  const subject =
    options.subject ||
    renderer.substitute(
      ctx.session,
      str(definition.props, 'subject') ||
        str(definition.props, 'settings.subject') ||
        str(definition.props, 'name', definition.id),
      ctx.page,
      'RAW',
    );
  insertRow(raw(renderer), 'apex_local_tasks', {
    task_id: id,
    application_id: appIdOf(renderer),
    task_def_static_id: staticIdOf(definition),
    task_def_name: str(definition.props, 'name', definition.id),
    subject,
    detail_pk: options.detailPk ?? null,
    initiator: (options.initiator ?? ctx.session.user).toUpperCase(),
    actual_owner: null,
    potential_owners: ctx.session.user.toUpperCase(),
    priority: options.priority ?? (Number(str(definition.props, 'settings.priority', '3')) || 3),
    state_code: 'UNASSIGNED',
    parameters: JSON.stringify(options.parameters ?? {}),
    created_on: now(),
    last_updated_by: ctx.session.user,
    last_updated_on: now(),
  });
  renderer.diagnose(
    'info',
    `Task ${id} (${staticIdOf(definition)}) recorded in APEX_TASKS; participants, actions and deadlines are not simulated locally`,
    ctx.pageId,
  );
  return id;
}

/** Applies a task operation (claim, approve, reject, complete, cancel, ...). */
export function manageTask(
  renderer: ApexRenderer,
  ctx: RenderContext,
  taskId: number,
  operation: string,
  outcome?: string | null,
): void {
  ensureDictionary(renderer);
  const db = raw(renderer);
  const task = one(db, 'select state_code from apex_local_tasks where task_id = ?', taskId);
  if (!task) raise(`Task ${taskId} does not exist`);
  const op = operation.toLowerCase().replace(/[^a-z]/gu, '');
  const user = ctx.session.user.toUpperCase();
  const set = (state: string, extra: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      state_code: state,
      last_updated_by: ctx.session.user,
      last_updated_on: now(),
      ...extra,
    };
    db.prepare(
      `update apex_local_tasks set ${Object.keys(values)
        .map((key) => `${key} = ?`)
        .join(', ')} where task_id = ?`,
    ).run(
      ...Object.values(values).map((value) =>
        value === undefined ? null : (value as string | number | null),
      ),
      taskId,
    );
  };
  if (op.startsWith('claim')) set('ASSIGNED', { actual_owner: user });
  else if (op.startsWith('release')) set('UNASSIGNED', { actual_owner: null });
  else if (op.startsWith('approve')) set('COMPLETED', { outcome_code: 'APPROVED', actual_owner: user });
  else if (op.startsWith('reject')) set('COMPLETED', { outcome_code: 'REJECTED', actual_owner: user });
  else if (op.startsWith('complete')) set('COMPLETED', { outcome_code: outcome ?? null, actual_owner: user });
  else if (op.startsWith('cancel')) set('CANCELLED');
  else if (op.startsWith('delegate')) set('ASSIGNED');
  else if (op.startsWith('requestinfo')) set('INFO_REQUESTED');
  else if (op.startsWith('submitinfo')) set('ASSIGNED');
  else
    renderer.diagnose(
      'info',
      `Task operation ${operation} is recorded without a state change locally`,
      ctx.pageId,
    );
}

export function humanTaskCreateProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const definition = ref(process.props, 'humanTask.definition') ?? str(process.props, 'humanTask.definition');
  const pkItem = str(process.props, 'humanTask.detailsPkItem');
  try {
    const id = createTask(renderer, ctx, definition, {
      subject: str(process.props, 'settings.subject')
        ? renderer.substitute(ctx.session, str(process.props, 'settings.subject'), ctx.page, 'RAW')
        : null,
      detailPk: pkItem ? (ctx.session.items[pkItem.toUpperCase()] ?? null) : null,
      parameters: processParameters(renderer, ctx, process),
    });
    const returnItem =
      str(process.props, 'humanTask.taskIdItem') || str(process.props, 'settings.returnTaskIdItem');
    if (returnItem) ctx.session.items[returnItem.toUpperCase()] = String(id);
    return { ran: true };
  } catch (error) {
    return failed(renderer, ctx, process, error);
  }
}

export function humanTaskManageProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const item = str(process.props, 'humanTask.taskIdItem');
  const taskId = Number(ctx.session.items[item.toUpperCase()] ?? '');
  const operation =
    str(process.props, 'humanTask.type') ||
    str(process.props, 'action.type') ||
    str(process.props, 'settings.type');
  if (!taskId || !operation) {
    renderer.diagnose(
      'info',
      `process ${process.id}: no task ID or operation; nothing recorded`,
      ctx.pageId,
      process.id,
    );
    return { ran: false };
  }
  try {
    manageTask(renderer, ctx, taskId, operation);
    return { ran: true };
  } catch (error) {
    return failed(renderer, ctx, process, error);
  }
}

export function workflowProcess(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
): ProcessResult {
  const action = str(process.props, 'action.type', 'start');
  try {
    if (action === 'start') {
      const definition =
        ref(process.props, 'workflow.definition') ?? str(process.props, 'workflow.definition');
      const pkItem = str(process.props, 'workflow.detailsPkItem');
      const initiatorItem = str(process.props, 'workflow.initiatorItem');
      const id = startWorkflow(
        renderer,
        ctx,
        definition,
        pkItem ? (ctx.session.items[pkItem.toUpperCase()] ?? null) : null,
        processParameters(renderer, ctx, process),
        initiatorItem ? ctx.session.items[initiatorItem.toUpperCase()] : undefined,
      );
      const returnItem =
        str(process.props, 'workflowInstance.returnWorkflowIdItem') ||
        str(process.props, 'workflow.workflowIdItem');
      if (returnItem) ctx.session.items[returnItem.toUpperCase()] = String(id);
      return { ran: true };
    }
    const idItem =
      str(process.props, 'workflowInstance.workflowIdItem') || str(process.props, 'workflow.workflowIdItem');
    const id = Number(ctx.session.items[idItem.toUpperCase()] ?? '');
    if (!id) return { ran: false };
    const state = { terminate: 'TERMINATED', suspend: 'SUSPENDED', resume: 'ACTIVE', retry: 'ACTIVE' }[
      action as 'terminate'
    ];
    if (state)
      raw(renderer)
        .prepare('update apex_local_workflows set state_code = ?, last_updated_on = ? where workflow_id = ?')
        .run(state, now(), id);
    else
      renderer.diagnose('info', `Workflow action ${action} is not simulated locally`, ctx.pageId, process.id);
    return { ran: true };
  } catch (error) {
    return failed(renderer, ctx, process, error);
  }
}

function failed(
  renderer: ApexRenderer,
  ctx: RenderContext,
  process: ApxComponent,
  error: unknown,
): ProcessResult {
  const message = (error as Error).message;
  renderer.diagnose('warning', `process ${process.id}: ${message}`, ctx.pageId, process.id);
  return {
    ran: false,
    errors: [
      {
        type: 'error',
        location: ['page'],
        message: str(process.props, 'error.errorMessage').replaceAll('#SQLERRM_TEXT#', message) || message,
        unsafe: false,
      },
    ],
  };
}

// ------------------------------------------------------------------ PL/SQL APIs

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value);

function params(value: unknown): Record<string, string> {
  if (Array.isArray(value))
    return Object.fromEntries(value.map((entry, index) => [String(index + 1), String(entry ?? '')]));
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

const withRt = (fn: (rt: Runtime, args: StubArgs) => unknown) => (args: StubArgs, rt: Runtime | undefined) =>
  rt ? fn(rt, args) : null;

const taskCreate: Stub = {
  params: [
    'p_application_id',
    'p_task_def_static_id',
    'p_subject',
    'p_parameters',
    'p_priority',
    'p_initiator',
    'p_detail_pk',
  ],
  fn: withRt((rt, args) =>
    createTask(rt.renderer, rt.ctx, String(args.p_task_def_static_id ?? ''), {
      subject: text(args.p_subject),
      detailPk: text(args.p_detail_pk),
      priority: args.p_priority === undefined || args.p_priority === null ? null : Number(args.p_priority),
      parameters: params(args.p_parameters),
      initiator: text(args.p_initiator),
    }),
  ),
};

const taskOperation = (operation: string): Stub => ({
  params: ['p_task_id', 'p_outcome', 'p_autoclaim'],
  fn: withRt((rt, args) => {
    manageTask(rt.renderer, rt.ctx, Number(args.p_task_id), operation, text(args.p_outcome));
    return null;
  }),
});

export const SERVICE_STUBS: Record<string, Stub> = {
  'apex_approval.create_task': taskCreate,
  'apex_human_task.create_task': taskCreate,
  'apex_approval.claim_task': taskOperation('claim'),
  'apex_human_task.claim_task': taskOperation('claim'),
  'apex_approval.release_task': taskOperation('release'),
  'apex_approval.approve_task': taskOperation('approve'),
  'apex_human_task.approve_task': taskOperation('approve'),
  'apex_approval.reject_task': taskOperation('reject'),
  'apex_human_task.reject_task': taskOperation('reject'),
  'apex_approval.complete_task': taskOperation('complete'),
  'apex_human_task.complete_task': taskOperation('complete'),
  'apex_approval.cancel_task': taskOperation('cancel'),
  'apex_human_task.cancel_task': taskOperation('cancel'),
  'apex_approval.add_task_comment': {
    params: ['p_task_id', 'p_text'],
    fn: withRt((rt, args) => {
      ensureDictionary(rt.renderer);
      insertRow(raw(rt.renderer), 'apex_local_task_comments', {
        id: nextId(rt.renderer, 'apex_local_task_comments', 'id'),
        task_id: Number(args.p_task_id),
        text: text(args.p_text),
        created_by: rt.ctx.session.user,
        created_on: now(),
      });
      return null;
    }),
  },
  'apex_workflow.start': {
    params: ['p_application_id', 'p_static_id', 'p_detail_pk', 'p_initiator', 'p_parameters'],
    fn: withRt((rt, args) =>
      startWorkflow(
        rt.renderer,
        rt.ctx,
        String(args.p_static_id ?? ''),
        text(args.p_detail_pk),
        params(args.p_parameters),
        text(args.p_initiator) ?? undefined,
      ),
    ),
  },
  'apex_workflow.terminate': {
    params: ['p_instance_id'],
    fn: withRt((rt, args) => {
      ensureDictionary(rt.renderer);
      raw(rt.renderer)
        .prepare(
          "update apex_local_workflows set state_code = 'TERMINATED', last_updated_on = ? where workflow_id = ?",
        )
        .run(now(), Number(args.p_instance_id));
      return null;
    }),
  },
  // Background executions run inline; status updates are accepted and dropped.
  'apex_background_process.set_status': { params: ['p_message'], fn: () => null },
  'apex_background_process.set_progress': { params: ['p_totalwork', 'p_sofar'], fn: () => null },
};
