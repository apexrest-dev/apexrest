import path from 'node:path';
import { readFile, stat, opendir } from 'node:fs/promises';

export interface AdvisoryFinding {
  code: string;
  file: string;
  line: number;
  column?: number;
  message: string;
  severity: 'warning';
}

/** CodeScan findings are advice, never compiler, SQL or runtime verification. */
export function parseCodeScan(output: string, source: string): AdvisoryFinding[] {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const from = clean.indexOf('['),
    to = clean.lastIndexOf(']');
  if (from < 0 || to < from) throw new Error('CodeScan did not return its JSON report.');
  const report: unknown = JSON.parse(clean.slice(from, to + 1));
  if (!Array.isArray(report)) throw new Error('CodeScan report is not a list.');
  const findings: AdvisoryFinding[] = [];
  for (const entry of report) {
    if (!entry || typeof entry.file !== 'string' || !Array.isArray(entry.issues))
      throw new Error('CodeScan report entry is incomplete.');
    const file = path.relative(source, path.resolve(source, entry.file)).replaceAll(path.sep, '/');
    if (!file || file.startsWith('../') || path.isAbsolute(file))
      throw new Error('CodeScan returned a file outside the inspected source.');
    for (const issue of entry.issues) {
      if (
        typeof issue?.ruleNo !== 'string' ||
        typeof issue.msg !== 'string' ||
        !Number.isInteger(issue.line) ||
        issue.line < 0 ||
        !Number.isInteger(issue.col) ||
        issue.col < 0
      )
        throw new Error('CodeScan issue is incomplete.');
      findings.push({
        code: issue.ruleNo,
        file,
        line: issue.line,
        column: issue.col,
        message: issue.msg,
        severity: 'warning',
      });
    }
  }
  return findings;
}

const upgradeRules = [
  {
    code: 'APEX262_AI_TOOL_CALLS',
    pattern: /\btool_calls\b/i,
    message: 'Review legacy AI tool_calls handling against the APEX 26.2 response contract.',
  },
  {
    code: 'APEX262_AI_MESSAGE',
    pattern: /\bt_chat_response\b/i,
    message: 'Review APEX_AI t_chat_response and response.message usage against the 26.2 response contract.',
  },
  {
    code: 'APEX262_ASSSO',
    pattern: /\bASSSO\b/i,
    message: 'Review legacy ASSSO authentication against the APEX 26.2 desupport guidance.',
  },
  {
    code: 'APEX262_REST_RESOURCE',
    pattern: /\bAPEX_REST_RESOURCE\b/i,
    message: 'Review legacy APEX_REST_RESOURCE references against APEX 26.2 migration guidance.',
  },
  {
    code: 'APEX262_ADVISOR',
    pattern: /\b(?:apex_advisor|advisor)\b/i,
    message:
      'Review Advisor references against the APEX 26.2 Advisor changes; this text match may be unrelated.',
  },
] as const;

/** Bounded source heuristics. A clean report does not establish upgrade readiness. */
export async function auditUpgradeSource(source: string) {
  const files: string[] = [],
    directories = [''];
  const findings: AdvisoryFinding[] = [],
    skipped: string[] = [];
  let inspected = 0,
    traversalTruncated = false;
  discovery: while (directories.length) {
    const relative = directories.pop()!;
    for await (const entry of await opendir(path.join(source, relative))) {
      if (++inspected > 10000) {
        traversalTruncated = true;
        break discovery;
      }
      const file = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) skipped.push(file);
      else if (entry.isDirectory()) directories.push(file);
      else if (entry.isFile() && /\.(?:apx|sql|js)$/i.test(file)) files.push(file);
    }
  }
  files.sort();
  let bytes = 0,
    scannedFiles = 0;
  for (const file of files) {
    const absolute = path.join(source, file),
      size = (await stat(absolute)).size;
    if (size > 1024 * 1024 || bytes + size > 16 * 1024 * 1024 || scannedFiles >= 2000) {
      skipped.push(file);
      continue;
    }
    bytes += size;
    scannedFiles++;
    const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/);
    for (const rule of upgradeRules) {
      const at = lines.findIndex((line) => rule.pattern.test(line));
      if (at >= 0)
        findings.push({ code: rule.code, file, line: at + 1, message: rule.message, severity: 'warning' });
    }
  }
  return {
    status: 'advisory' as const,
    targetRelease: '26.2',
    scannedFiles,
    findings,
    skipped,
    traversalTruncated,
    limitation: 'Source text review hints only; not a complete dependency, SQL, security or runtime audit.',
  };
}
