import type { SqlValue, ThemeCall } from '../../theme-sql.ts';
import type { EscapeMode, NamedTemplate } from './directives.ts';

/**
 * Universal Theme template components (`create_plugin` with `p_plugin_type=>'TEMPLATE COMPONENT'`)
 * and their attributes, attribute groups, LOV values, action positions/templates and slots.
 */

export interface PluginAttribute {
  id: string;
  staticId: string;
  apexlangName: string;
  scope: 'COMPONENT' | 'REPORT' | 'REPORT_GROUP' | string;
  type: string;
  group?: string | undefined;
  defaultValue?: string | undefined;
  escape: EscapeMode;
  /** APEXlang value name -> stored return value (SELECT LIST). */
  values: Map<string, string>;
  dependsOn?: string | undefined;
  dependsCondition?: string | undefined;
  dependsExpression?: string | undefined;
  columnTypes?: string | undefined;
}

export interface PluginActionPosition {
  staticId: string;
  apexlangName: string;
  type: 'LINK' | 'TEMPLATE' | string;
  templateId?: string | undefined;
}

export interface PluginActionTemplate {
  id: string;
  apexlangName: string;
  type: 'BUTTON' | 'MENU' | string;
  template: string;
}

export interface TemplateComponent {
  id: string;
  name: string;
  /** `THEME$BADGE` for `THEME_42$BADGE`, the name `{apply/}` uses. */
  applyName: string;
  apexlangName: string;
  displayName: string;
  supports: Set<string>;
  standardAttributes: Set<string>;
  partial: string;
  reportBody: string;
  reportRow: string;
  reportGroup: string;
  defaultEscape: EscapeMode;
  attributes: PluginAttribute[];
  positions: PluginActionPosition[];
  actionTemplates: PluginActionTemplate[];
  slots: { placeholder: string; apexlangName: string }[];
}

export interface ComponentIndex {
  byApexlang: Map<string, TemplateComponent>;
  named: Map<string, NamedTemplate>;
}

const text = (value: SqlValue) =>
  typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

const escapeMode = (value: SqlValue, fallback: EscapeMode): EscapeMode => {
  const mode = text(value).toUpperCase();
  return (
    (['HTML', 'ATTR', 'RAW', 'STRIPHTML', 'JS', 'URL'] as const).find((entry) => entry === mode) ?? fallback
  );
};

const cache = new WeakMap<ThemeCall[], ComponentIndex>();

export function componentIndex(calls: ThemeCall[]): ComponentIndex {
  const cached = cache.get(calls);
  if (cached) return cached;
  const index: ComponentIndex = { byApexlang: new Map(), named: new Map() };
  const plugins = new Map<string, TemplateComponent>();
  const groups = new Map<string, string>();
  const attributes = new Map<string, PluginAttribute>();
  for (const { kind, params } of calls) {
    if (kind === 'plugin' && text(params.plugin_type) === 'TEMPLATE COMPONENT') {
      const name = text(params.name);
      const component: TemplateComponent = {
        id: text(params.id),
        name,
        applyName: name.replace(/^THEME_\d+\$/u, 'THEME$'),
        apexlangName: text(params.apexlang_name) || name.replace(/^THEME_\d+\$/u, '').toLowerCase(),
        displayName: text(params.display_name) || name,
        supports: new Set(text(params.supported_component_types).split(':').filter(Boolean)),
        standardAttributes: new Set(text(params.standard_attributes).split(':').filter(Boolean)),
        partial: text(params.partial_template),
        reportBody: text(params.report_body_template),
        reportRow: text(params.report_row_template),
        reportGroup: text(params.report_group_template),
        defaultEscape: escapeMode(params.default_escape_mode, 'HTML'),
        attributes: [],
        positions: [],
        actionTemplates: [],
        slots: [],
      };
      plugins.set(component.id, component);
    } else if (kind === 'plugin_attr_group') groups.set(text(params.id), text(params.apexlang_name));
  }
  for (const { kind, params } of calls) {
    const plugin = plugins.get(text(params.plugin_id));
    if (kind === 'plugin_attribute' && plugin) {
      const attribute: PluginAttribute = {
        id: text(params.id),
        staticId: text(params.static_id).toUpperCase(),
        apexlangName: text(params.apexlang_name),
        scope: text(params.attribute_scope) || 'COMPONENT',
        type: text(params.attribute_type),
        group: groups.get(text(params.attribute_group_id)) || undefined,
        defaultValue: params.default_value === undefined ? undefined : text(params.default_value),
        escape: escapeMode(params.escape_mode, plugin.defaultEscape),
        values: new Map(),
        dependsOn: text(params.depending_on_attribute_id) || undefined,
        dependsCondition: text(params.depending_on_condition_type) || undefined,
        dependsExpression:
          params.depending_on_expression === undefined ? undefined : text(params.depending_on_expression),
        columnTypes: text(params.column_data_types) || undefined,
      };
      plugin.attributes.push(attribute);
      attributes.set(attribute.id, attribute);
    } else if (kind === 'plugin_act_position' && plugin)
      plugin.positions.push({
        staticId: text(params.static_id).toUpperCase(),
        apexlangName: text(params.apexlang_name),
        type: text(params.type),
        templateId: text(params.template_id) || undefined,
      });
    else if (kind === 'plugin_act_template' && plugin)
      plugin.actionTemplates.push({
        id: text(params.id),
        apexlangName: text(params.apexlang_name),
        type: text(params.type),
        template: text(params.template),
      });
    else if (kind === 'plugin_slot' && plugin)
      plugin.slots.push({ placeholder: text(params.placeholder), apexlangName: text(params.apexlang_name) });
  }
  for (const { kind, params } of calls) {
    const attribute =
      kind === 'plugin_attr_value' ? attributes.get(text(params.plugin_attribute_id)) : undefined;
    if (attribute)
      attribute.values.set(
        text(params.apexlang_name) || text(params.return_value),
        text(params.return_value),
      );
  }
  for (const component of plugins.values()) {
    component.attributes.sort((a, b) => a.staticId.localeCompare(b.staticId));
    index.byApexlang.set(component.apexlangName.toLowerCase(), component);
    if (component.partial)
      index.named.set(component.applyName, {
        template: component.partial,
        defaultEscape: component.defaultEscape,
        args: component.attributes
          .filter((attribute) => attribute.scope === 'COMPONENT')
          .map((attribute) => ({
            name: attribute.staticId,
            escape: attribute.escape,
            // Named-template calls only get defaults that do not depend on other attributes.
            default: attribute.dependsOn ? undefined : attribute.defaultValue,
          })),
      });
  }
  cache.set(calls, index);
  return index;
}
