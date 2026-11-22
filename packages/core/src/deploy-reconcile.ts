import path from 'node:path';
import { appendFile } from 'node:fs/promises';
import { environment, refuseProductionDeployment, targetDigest, type ProjectContext } from './config.ts';
import { LocalDeploymentControl } from './deployment-control.ts';
import { contained, exists, readJson, writeJson } from './fs.ts';
import { Fault } from './result.ts';

/**
 * Human-confirmed reconciliation of a held deployment run (`apexrest deploy reconcile`).
 *
 * A run interrupted while it ran migrations or package scripts ends in
 * `database-review-required`: recovery never replays SQL, so a person inspects the database and
 * states, for every script of that run, whether it is applied or not (cleaned up). This command
 * records exactly that statement in the local history, keeps the run's evidence, and releases the
 * run's ownership so that a fresh plan can follow. It never touches the database, never infers an
 * outcome, and is bound to the exact run, plan and target by a confirmation the person types.
 * Production targets are refused.
 */

export interface ReconcileInput {
  env: string;
  run: string;
  /** `[{file, outcome: 'applied' | 'not_applied'}]` for every migration and package of the run. */
  statements: { file: string; outcome: 'applied' | 'not_applied' }[];
  /** `<run id>:<first 12 characters of the plan digest>`, typed by the person. */
  confirm?: string | undefined;
  userRequest: string;
}

export async function reconcileRun(ctx: ProjectContext, input: ReconcileInput) {
  if (!input.userRequest.trim())
    throw new Fault(
      'USER_REQUEST_REQUIRED',
      'Pass the literal instruction of the person who inspected the database.',
      2,
    );
  const runDir = await contained(ctx.root, '.apexrest/deployments/' + input.run);
  if (!(await exists(path.join(runDir, 'plan.json'))))
    throw new Fault(
      'RUN_NOT_FOUND',
      `No deployment run ${input.run} exists in this project.`,
      2,
      'not_found',
    );
  const plan = (await readJson(path.join(runDir, 'plan.json'))) as {
    digest: string;
    environment: string;
    targetDigest: string;
    operations: { kind: string; file?: string; sha256?: string }[];
  };
  const state = (await readJson(path.join(runDir, 'state.json'))) as { state?: string };
  if (!['outcome_unknown', 'failed'].includes(String(state.state)))
    throw new Fault(
      'RUN_NOT_HELD',
      `Run ${input.run} is ${state.state}; only interrupted runs are reconciled.`,
      5,
    );
  if (plan.environment !== input.env)
    throw new Fault(
      'PLAN_TARGET_MISMATCH',
      `Run ${input.run} deployed to ${plan.environment}, not ${input.env}.`,
      5,
    );
  const env = environment(ctx, input.env);
  await refuseProductionDeployment(env, input.env, plan.targetDigest);
  if (targetDigest(env) !== plan.targetDigest)
    throw new Fault('PLAN_TARGET_MISMATCH', 'The environment configuration changed since this run.', 5);

  const scripts = plan.operations.filter((op) => op.kind === 'migration' || op.kind === 'package');
  const files = new Set(scripts.map((op) => op.file!));
  const stated = new Map(input.statements.map((entry) => [entry.file, entry.outcome]));
  const missing = [...files].filter((file) => !stated.has(file));
  const unknown = [...stated.keys()].filter((file) => !files.has(file));
  if (missing.length || unknown.length || stated.size !== input.statements.length)
    throw new Fault(
      'RECONCILIATION_INCOMPLETE',
      `State each script of the run exactly once as applied or not_applied.${missing.length ? ` Missing: ${missing.join(', ')}.` : ''}${unknown.length ? ` Not in the run: ${unknown.join(', ')}.` : ''}`,
      2,
      'blocked',
      { scripts: [...files] },
    );
  if ([...stated.values()].some((outcome) => outcome !== 'applied' && outcome !== 'not_applied'))
    throw new Fault('INVALID_INPUT', 'Each outcome is applied or not_applied.', 2);
  const expected = `${input.run}:${plan.digest.slice(0, 12)}`;
  if (input.confirm !== expected)
    throw new Fault(
      'RECONCILIATION_CONFIRMATION_REQUIRED',
      `Confirm the inspected run, plan and target by passing --confirm ${expected}. The statement is recorded as the person's and releases the run.`,
      4,
      'blocked',
      { expected, scripts: [...files] },
    );

  const statements = scripts.map((op) => ({
    kind: op.kind as 'migration' | 'package',
    file: op.file!,
    version: path.basename(op.file!),
    checksum: op.sha256!,
    applied: stated.get(op.file!) === 'applied',
  }));
  const owner = await new LocalDeploymentControl(env).reconcileRun(
    input.run,
    ctx.config.projectId,
    statements,
  );
  const at = new Date().toISOString();
  const record = {
    runId: input.run,
    planDigest: plan.digest,
    environment: input.env,
    at,
    userRequest: input.userRequest,
    statements: input.statements,
    releasedOwner: owner,
  };
  // Evidence stays with the run; state.json keeps the interrupted state the run ended in.
  await writeJson(path.join(runDir, 'reconciliation.json'), record);
  await appendFile(
    path.join(runDir, 'journal.jsonl'),
    JSON.stringify({ runId: input.run, state: 'reconciled', at }) + '\n',
  );
  return {
    run: input.run,
    released: true,
    recorded: statements.map((entry) => ({
      file: entry.file,
      outcome: entry.applied ? 'applied' : 'not_applied',
    })),
    nextAction: 'Create a fresh plan: scripts stated not_applied run again; applied ones are skipped.',
  };
}
