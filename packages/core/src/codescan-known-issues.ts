import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { readStructure, type ApexlangNode } from './apexlang-equivalence.ts';
import { APEX_262_PROFILE } from './compatibility.ts';
import type { AdvisoryFinding } from './upgrade-audit.ts';

/** Bump when a rule, its evidence or the qualified tuple changes. */
export const CODESCAN_KNOWN_FALSE_POSITIVE_POLICY = 'apex262-sqlcl263-codescan-v1';

/** Source facts a rule needs; each is read from application.apx and fails closed. */
export type KnownFalsePositiveEvidence =
  | 'app.authentication.scheme+app.authorization.scheme'
  | 'app.sessionStateProtection.enabled:not-false'
  | 'app.advanced.exactSubstitutions:absent';

export interface KnownFalsePositiveRule {
  code: string;
  file: 'application.apx';
  evidence: KnownFalsePositiveEvidence;
  reason: string;
}

export interface KnownFalsePositive {
  policy: typeof CODESCAN_KNOWN_FALSE_POSITIVE_POLICY;
  profile: typeof APEX_262_PROFILE.id;
  reason: string;
  evidence: KnownFalsePositiveEvidence;
}

export type ClassifiedFinding = AdvisoryFinding & { knownFalsePositive?: KnownFalsePositive };

/**
 * Oracle owns these rules. Each entry was reproduced with SQLcl 26.3.0.260.1620
 * `codescan -extensions apx -format json` against MMD 26.2.0+3479 sources, and no
 * valid 26.2 source form cleared the finding. Classification only applies when
 * the source itself proves the setting; otherwise the finding stays actionable.
 */
export const KNOWN_FALSE_POSITIVES: readonly KnownFalsePositiveRule[] = [
  {
    code: 'APEX-002',
    file: 'application.apx',
    evidence: 'app.authentication.scheme+app.authorization.scheme',
    reason:
      'SQLcl 26.3 CodeScan does not recognize the APEX 26.2 application authentication { scheme } and authorization { scheme } groups (component references or mustNotBePublicUser); application.apx sets both.',
  },
  {
    code: 'APEX-009',
    file: 'application.apx',
    evidence: 'app.sessionStateProtection.enabled:not-false',
    reason:
      'SQLcl 26.3 CodeScan does not recognize the APEX 26.2 sessionStateProtection { enabled } property; application.apx leaves it enabled (explicit true or the default Y).',
  },
  {
    code: 'APEX-031',
    file: 'application.apx',
    evidence: 'app.advanced.exactSubstitutions:absent',
    reason:
      'APEX 26.2 defaults advanced.exactSubstitutions to Y and the SQLcl 26.3 compiler rejects exactSubstitutions: true as deprecated, so 26.2 source cannot clear this finding. application.apx does not set the property.',
  },
];

type Container = Extract<ApexlangNode, { children: ApexlangNode[] }>;

function only<T extends ApexlangNode>(nodes: ApexlangNode[], test: (node: ApexlangNode) => node is T) {
  const found = nodes.filter(test);
  return found.length > 1 ? 'ambiguous' : found[0];
}
const group = (nodes: ApexlangNode[], name: string) =>
  only(nodes, (node): node is Container => node.kind === 'group' && node.name === name);
const property = (nodes: ApexlangNode[], name: string) =>
  only(
    nodes,
    (node): node is Extract<ApexlangNode, { kind: 'property' }> =>
      node.kind === 'property' && node.name === name && node.literal === undefined,
  );

/** True only when application.apx proves the rule's setting. Unknown forms prove nothing. */
export function applicationProves(application: string, evidence: KnownFalsePositiveEvidence): boolean {
  let roots: ApexlangNode[];
  try {
    roots = readStructure(application);
  } catch {
    return false;
  }
  const apps = roots.filter((node) => node.kind === 'component' && node.name === 'app');
  if (apps.length !== 1 || roots.length !== 1) return false;
  const app = (apps[0] as Container).children;
  if (evidence === 'app.authentication.scheme+app.authorization.scheme')
    return ['authentication', 'authorization'].every((name) => {
      const block = group(app, name);
      if (!block || block === 'ambiguous') return false;
      const scheme = property(block.children, 'scheme');
      return !!scheme && scheme !== 'ambiguous' && scheme.value.trim() !== '';
    });
  if (evidence === 'app.sessionStateProtection.enabled:not-false') {
    const block = group(app, 'sessionStateProtection');
    if (block === undefined) return true; // MMD default Y
    if (block === 'ambiguous') return false;
    const enabled = property(block.children, 'enabled');
    if (enabled === undefined) return true; // MMD default Y
    return enabled !== 'ambiguous' && enabled.value.trim() === 'true';
  }
  const block = group(app, 'advanced');
  if (block === undefined) return true;
  if (block === 'ambiguous') return false;
  return !block.children.some((node) => 'name' in node && node.name === 'exactSubstitutions');
}

/** The rules are qualified only for the APEX 26.2 profile tuple. */
export function knownFalsePositiveProfileApplies(compilerVersion: string, mmdVersion: string | null) {
  return /Release 26\.3\./.test(compilerVersion) && !!mmdVersion && /^26\.2\.\d+\+\d+$/.test(mmdVersion);
}

/** Marks, never removes, CodeScan findings that match a known false positive with proof in source. */
export function classifyCodeScanFindings(
  findings: readonly AdvisoryFinding[],
  context: { compilerVersion: string; mmdVersion: string | null; application: string | null },
): ClassifiedFinding[] {
  if (
    !knownFalsePositiveProfileApplies(context.compilerVersion, context.mmdVersion) ||
    context.application === null
  )
    return [...findings];
  const proven = new Map<KnownFalsePositiveEvidence, boolean>();
  return findings.map((finding) => {
    const rule = KNOWN_FALSE_POSITIVES.find((r) => r.code === finding.code && r.file === finding.file);
    if (!rule) return finding;
    if (!proven.has(rule.evidence))
      proven.set(rule.evidence, applicationProves(context.application!, rule.evidence));
    if (!proven.get(rule.evidence)) return finding;
    return {
      ...finding,
      knownFalsePositive: {
        policy: CODESCAN_KNOWN_FALSE_POSITIVE_POLICY,
        profile: APEX_262_PROFILE.id,
        reason: rule.reason,
        evidence: rule.evidence,
      },
    };
  });
}

export async function readApplicationSource(source: string): Promise<string | null> {
  try {
    return await readFile(path.join(source, 'application.apx'), 'utf8');
  } catch {
    return null;
  }
}
