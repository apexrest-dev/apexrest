import { randomUUID } from 'node:crypto';
export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  type?: string;
  hint?: string;
  validValues?: string[];
}
/** Structured compiler/validator entry before it is normalized into a Diagnostic. */
export interface StructuredDiagnostic {
  code?: string;
  message: string;
  severity?: Diagnostic['severity'];
  file?: string;
  line?: number;
  column?: number;
  type?: string;
  hint?: string;
  validValues?: string[];
}
export interface FaultDetails {
  diagnostics?: StructuredDiagnostic[];
  nextActions?: string[];
  [key: string]: unknown;
}
/** Structured diagnostics travel untruncated up to this many entries. */
export const DIAGNOSTIC_LIMIT = 50;
export interface Result {
  schemaVersion: 1;
  ok: boolean;
  operation: string;
  status: string;
  runId: string;
  summary: string;
  diagnostics: Diagnostic[];
  artifacts: string[];
  nextActions: string[];
  data?: unknown;
  exitCode: ExitCode;
}
export class Fault extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode: ExitCode = 1,
    public status = 'failed',
    public details?: FaultDetails,
  ) {
    super(message);
  }
}
// Recovery guidance for domain faults the agent can act on without reading
// the skill again. Keyed by Fault code; the message stays the diagnostic.
export const faultNextActions: Record<string, string> = {
  VALIDATION_FAILED:
    'Fix the listed diagnostics in the named .apx files, then rerun apexrest_apex_validate until it reports no errors.',
  VALIDATION_UNCONFIRMED:
    'The compiler returned no success marker. Read the diagnostics, fix the source and rerun apexrest_apex_validate.',
  SOURCE_DRIFT: 'Sources changed after review. Rerun apexrest_ship with mode:plan, review it, then apply.',
  TARGET_DRIFT:
    'The target changed after review. Rerun apexrest_ship with mode:plan and review the new plan.',
  PLAN_EXPIRED: 'Rerun apexrest_ship with mode:plan; plans expire 30 minutes after creation.',
  DEPLOY_APPROVAL_REQUIRED:
    "Run apexrest_ship with mode:apply and userRequest set to the user's literal instruction; it records a plan-bound deploy grant for this attempt.",
  PRODUCTION_CI_REQUIRED:
    'Production targets need a signed external approval in a protected CI runner; apexrest_ship cannot apply them. Report this to the user.',
  RECOVERY_REVIEW_REQUIRED:
    'The plan carries destructive, privileged or security risks. Review them with the user and provide a recovery path before applying.',
  PROJECT_TRUST_REQUIRED:
    "Ask the user to add the project's canonical path to trustedProjects in APEXREST_HOME/policy.json (CLI: apexrest status --detail project shows the path), then retry.",
  PROJECT_NOT_CONFIGURED:
    'Pass the absolute directory containing apexrest.json, or create one with apexrest_project action:init.',
  CONNECTION_REQUIRED:
    'Configure the named connection reference with apexrest_project action:connection_add (never send passwords in chat).',
  ENVIRONMENT_REQUIRED:
    'Pass env with a configured environment name; apexrest_project action:inspect lists them.',
  UNKNOWN_ENVIRONMENT: 'Use an environment listed by apexrest_project action:inspect.',
  OUTCOME_UNKNOWN:
    'Do not retry. Read apexrest_job status for the same jobId and reconcile the target before any new deployment.',
  SYNC_BLOCKED: 'Reconcile the interrupted import before syncing or deploying again; do not clear ownership.',
  SYNC_DIRTY:
    'Local sources differ from the checkpoint. Review or commit them before refreshing the working copy.',
  UNSUPPORTED_CAPABILITY:
    'The installed SQLcl lacks this apex command. Run apexrest_status detail:doctor and install the pinned toolchain.',
  JOB_OUTCOME_UNKNOWN: 'Read apexrest_job status with this jobId; do not repeat the operation.',
};
function normalizeDiagnostic(entry: StructuredDiagnostic, code: string): Diagnostic {
  const d: Diagnostic = {
    severity: entry.severity ?? 'error',
    code: entry.code ?? code,
    message: redact(String(entry.message)),
  };
  if (typeof entry.file === 'string') d.file = redact(entry.file);
  if (Number.isInteger(entry.line)) d.line = entry.line as number;
  if (Number.isInteger(entry.column)) d.column = entry.column as number;
  if (typeof entry.type === 'string') d.type = entry.type;
  if (typeof entry.hint === 'string') d.hint = redact(entry.hint);
  if (Array.isArray(entry.validValues)) d.validValues = entry.validValues.map(String);
  return d;
}
const safeArtifactPages = new WeakSet<object>();

// Only pages produced here may bypass subsequent recursive redaction. The full
// document is sanitized first and the page is frozen; arbitrary tool objects
// cannot opt out. Re-redacting a partial JSON/secret marker corrupts pagination.
export function artifactPage<T extends Record<string, unknown> = Record<string, never>>(
  content: string,
  format: 'text' | 'json',
  id: string,
  offset: number,
  limit: number,
  metadata: T = {} as T,
) {
  const safe = format === 'json' ? JSON.stringify(sanitized(JSON.parse(content))) : redact(content);
  const safeMetadata = sanitized(metadata) as T;
  let count = Math.min(limit, Math.max(0, safe.length - offset));
  const create = () => {
    let end = offset + count;
    if (count > 0 && /[\uD800-\uDBFF]/.test(safe[end - 1]!) && /[\uDC00-\uDFFF]/.test(safe[end] ?? ''))
      end += count === 1 ? 1 : -1;
    return {
      ...safeMetadata,
      id: redact(id),
      offset,
      content: safe.slice(offset, end),
      nextOffset: end < safe.length ? end : null,
      dataClassification: 'untrusted_operation_output',
    };
  };
  let page = create();
  while (JSON.stringify(page).length > 24000 && count > 1) {
    count = Math.floor(count / 2);
    page = create();
  }
  Object.freeze(page);
  safeArtifactPages.add(page);
  return page;
}
export function redact(value: string): string {
  return value
    .replace(
      /("(?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(
      /((?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)\s*[:=]\s*)([^\r\n,}]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\bBearer\s+[\w.\-+/=]+/gi, 'Bearer [REDACTED]');
}
export function sanitized(value: unknown): unknown {
  if (value && typeof value === 'object' && safeArtifactPages.has(value)) return value;
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(?:password|passwd|pwd|token|secret|authorization|cookie|set-cookie|wallet_location)$/i.test(key)
          ? '[REDACTED]'
          : sanitized(item),
      ]),
    );
  return value;
}
export function success(operation: string, data: unknown, summary = 'Operation completed.'): Result {
  return {
    schemaVersion: 1,
    ok: true,
    operation,
    status: 'succeeded',
    runId: randomUUID(),
    summary,
    diagnostics: [],
    artifacts: [],
    nextActions: [],
    data: sanitized(data),
    exitCode: 0,
  };
}
export function failure(operation: string, error: unknown): Result {
  const e =
    error instanceof Fault
      ? error
      : new Fault('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown failure');
  const structured = Array.isArray(e.details?.diagnostics) ? e.details.diagnostics : [];
  const diagnostics: Diagnostic[] = structured.length
    ? structured.slice(0, DIAGNOSTIC_LIMIT).map((entry) => normalizeDiagnostic(entry, e.code))
    : [{ severity: 'error', code: e.code, message: redact(e.message) }];
  const nextActions = [
    ...(Array.isArray(e.details?.nextActions) ? e.details.nextActions.map(redact) : []),
    ...(faultNextActions[e.code] ? [faultNextActions[e.code]!] : []),
  ];
  return {
    schemaVersion: 1,
    ok: false,
    operation,
    status: e.status,
    runId: randomUUID(),
    summary: redact(e.message),
    diagnostics,
    artifacts: [],
    nextActions,
    ...(structured.length > DIAGNOSTIC_LIMIT
      ? { data: { diagnosticsOmitted: structured.length - DIAGNOSTIC_LIMIT } }
      : {}),
    exitCode: e.exitCode,
  };
}
