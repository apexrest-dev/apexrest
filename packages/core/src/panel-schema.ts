import { z } from 'zod';
import { browserPreferencesSchema } from './browser-preferences.ts';
import { sqlclConfigSchema } from './sqlcl-config.ts';
import { composePlanInput, composeMaterializeInput } from './composer/service.ts';
import { digest, instanceSchema } from './composer/schemas.ts';
import { refName, relativePath } from './config.ts';
import { savedConnectionName, ordsUrl, ordsUsername } from './connections.ts';

export const panelPreferencesSchema = z.strictObject({
  browserMode: browserPreferencesSchema.shape.browserMode.removeDefault().optional(),
});
export const panelReadSchema = z.strictObject({
  project: z.string().min(1).max(4096).optional(),
});
const connectionActionSchema = z.strictObject({
  kind: z.literal('connection'),
  name: refName,
  sqlclName: savedConnectionName.optional(),
  ordsUrl: ordsUrl.optional(),
  ordsUsername: ordsUsername.optional(),
  password: z.string().min(1).max(4096).optional(),
});
export const panelActionSchema = z.strictObject({
  project: z.string().min(1).max(4096).optional(),
  action: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('preferences'), settings: panelPreferencesSchema }),
    z.strictObject({ kind: z.literal('sqlcl'), settings: sqlclConfigSchema }),
    z.strictObject({ kind: z.literal('saved-connections') }),
    connectionActionSchema,
    z.strictObject({
      kind: z.literal('catalog-search'),
      query: z.string().min(1).max(256),
      profile: z.string().max(200).optional(),
    }),
    z.strictObject({
      kind: z.literal('catalog-read'),
      id: z.string().min(1).max(200),
      offset: z.number().int().min(0).default(0),
    }),
    z.strictObject({ kind: z.literal('blueprint-read'), blueprint: relativePath }),
    z.strictObject({
      kind: z.literal('blueprint-add'),
      blueprint: relativePath,
      instanceId: z.string().min(1).max(64),
      instance: instanceSchema,
      expectedDigest: digest,
      apply: z.boolean().default(false),
    }),
    composePlanInput.omit({ project: true }).extend({ kind: z.literal('compose-plan') }),
    composeMaterializeInput.omit({ project: true }).extend({ kind: z.literal('compose-materialize') }),
    z.strictObject({ kind: z.literal('compose-status'), id: z.uuid() }),
    z.strictObject({ kind: z.literal('cancel-job'), id: z.uuid() }),
    z.strictObject({ kind: z.literal('validate') }),
    z.strictObject({ kind: z.literal('browser'), env: z.string().min(1).max(100) }),
    z.strictObject({
      kind: z.literal('test'),
      suite: z.enum(['unit', 'sql', 'api', 'e2e', 'all']),
      env: z.string().min(1).max(100).optional(),
    }),
    z.strictObject({ kind: z.literal('plan'), env: z.string().min(1).max(100) }),
  ]),
});
// Only the local browser form accepts a password or changes the global SQLcl
// execution mode and restriction level. MCP and CLI advertise and validate a
// public schema without credential entry or SQLcl restriction changes.
const [preferencesAction, ...otherActions] = panelActionSchema.shape.action.options;
export const publicPanelActionSchema = panelActionSchema.extend({
  action: z.discriminatedUnion('kind', [
    preferencesAction,
    ...otherActions
      .filter((option) => option.shape.kind.value !== 'sqlcl')
      .map((option) =>
        option.shape.kind.value === 'connection' ? connectionActionSchema.omit({ password: true }) : option,
      ),
  ]),
});
export type PanelAction = z.input<typeof panelActionSchema>['action'];
export type PanelPreferences = z.infer<typeof browserPreferencesSchema>;
