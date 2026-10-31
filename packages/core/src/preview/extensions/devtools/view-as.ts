import { str, type ApxComponent } from '../../apexlang.ts';
import type { ApexRenderer, Session } from '../../render.ts';

/**
 * "View as" from the developer toolbar. Unset (the default) keeps the preview permissive: every
 * authorization scheme and ACL role check allows access. When set, ACL role checks answer for the
 * chosen roles, `isInRoleOrGroup` schemes are decided by them, the listed schemes always deny,
 * and denials are enforced (pages show an access error, components are hidden).
 */
export type ViewAs = NonNullable<Session['viewAs']>;

/** Application components live in shared-components/ files or inside application.apx. */
const shared = (renderer: ApexRenderer, type: string): ApxComponent[] =>
  [...renderer.app.shared, ...renderer.app.app.children].filter((component) => component.type === type);

export const roles = (renderer: ApexRenderer) => shared(renderer, 'role');
export const authorizationSchemes = (renderer: ApexRenderer) => shared(renderer, 'authorization');

export const enforcing = (session: Session | undefined): session is Session & { viewAs: ViewAs } =>
  Boolean(session?.viewAs);

/** Role static ID or name (as `isInRoleOrGroup` lists them) matched against the chosen roles. */
export function hasRole(renderer: ApexRenderer, viewAs: ViewAs, wanted: string): boolean {
  const lower = wanted.trim().toLowerCase();
  if (!lower) return false;
  const chosen = new Set(viewAs.roles.map((role) => role.toLowerCase()));
  if (chosen.has(lower)) return true;
  return roles(renderer).some(
    (role) =>
      chosen.has(role.id.toLowerCase()) &&
      (role.id.toLowerCase() === lower || str(role.props, 'name').toLowerCase() === lower),
  );
}

/** `apex_acl.has_user_role` / `has_user_any_roles`: 1 when permissive. */
export function aclCheck(
  renderer: ApexRenderer | undefined,
  session: Session | undefined,
  role?: string,
): number {
  if (!renderer || !enforcing(session)) return 1;
  if (role === undefined) return session.viewAs.roles.length ? 1 : 0;
  return hasRole(renderer, session.viewAs, role) ? 1 : 0;
}

/** Short label for the toolbar ("Administrator, Reader" or "no roles"). */
export function viewAsLabel(renderer: ApexRenderer, viewAs: ViewAs | undefined): string {
  if (!viewAs) return 'Everything allowed';
  const names = viewAs.roles.map(
    (id) =>
      str(roles(renderer).find((role) => role.id.toLowerCase() === id.toLowerCase())?.props ?? {}, 'name') ||
      id,
  );
  return names.length ? names.join(', ') : 'no roles';
}
