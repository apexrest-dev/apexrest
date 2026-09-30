import type { Blueprint, Instance, Allocation, Block } from './schemas.ts';
import { bind, expression } from './binding.ts';
import { Fault } from '../result.ts';

const indent = (value: string, depth = 4) =>
  value
    .split('\n')
    .map((line) => (line ? ' '.repeat(depth) + line : ''))
    .join('\n');
const group = (key: string, value: string) => `${key} {\n${indent(value)}\n}`;
const node = (kind: string, key: string, value: string) => `${kind} ${key} (\n${indent(value)}\n)\n`;
const scalar = (value: string) => {
  if (/[\r\n\x00-\x1f{}()`]/.test(value))
    throw new Fault('PARAMETER_UNSUPPORTED', 'Labels must be single-line literal values.', 2);
  return value;
};
const code = (language: string, source: string) =>
  `\n    \`\`\`${language}\n${indent(source, 4)}\n    \`\`\``;
const layout = (sequence: number, slot = 'body') => group('layout', `sequence: ${sequence}\nslot: ${slot}`);
const appearance = (template: string) =>
  group('appearance', `template: @/${template}\ntemplateOptions: #DEFAULT#`);
const page = (allocation: Allocation, title: string, body: string, dialog = false) =>
  node(
    'page',
    String(dialog ? allocation.dialog : allocation.page),
    [
      `name: ${scalar(title)}`,
      `alias: ${allocation.prefix.toUpperCase()}${dialog ? '_EDIT' : ''}`,
      `title: ${scalar(title)}`,
      group(
        'appearance',
        dialog
          ? 'pageMode: modalDialog\ndialogTemplate: @/modal-dialog\ntemplateOptions: #DEFAULT#'
          : 'pageTemplate: @/standard\ntemplateOptions: #DEFAULT#',
      ),
      group('security', 'pageAccessProtection: argumentsMustHaveChecksum'),
      body,
    ].join('\n'),
  );
const source = (sql: string, submit?: string) =>
  group(
    'source',
    `location: localDatabase\ntype: sqlQuery\n${submit ? `pageItemsToSubmit: ${submit}\n` : ''}sqlQuery:${code('sql', sql)}`,
  );
const button = (key: string, label: string, region: string, behavior: string) =>
  node(
    'button',
    key,
    [
      `buttonName: ${key.replaceAll('-', '_').toUpperCase()}`,
      `label: ${scalar(label)}`,
      group('layout', `sequence: 10\nregion: @${region}\nslot: NEXT`),
      group('appearance', 'buttonTemplate: @/text\ntemplateOptions: #DEFAULT#'),
      group('behavior', behavior),
    ].join('\n'),
  );
function dynamic(key: string, event: string, selection: string, actions: string) {
  return node(
    'dynamicAction',
    key,
    `name: ${key}\n${group('execution', 'sequence: 10')}\n${group('when', `event: ${event}\n${selection}`)}\n${actions}`,
  );
}
function refresh(key: string, region: string, sequence: number) {
  return node(
    'action',
    key,
    `action: refresh\n${group('affectedElements', `selectionType: region\nregion: @${region}`)}\n${group('execution', `sequence: ${sequence}\nfireOnInit: false`)}`,
  );
}
function jsAction(key: string, javascript: string) {
  return node(
    'action',
    key,
    `action: executeJsCode\n${group('settings', `jsCode:${code('javascript', javascript)}`)}\n${group('execution', 'sequence: 10\nfireOnInit: false')}`,
  );
}
function process(key: string, point: string, sql: string) {
  return node(
    'process',
    key,
    `name: ${key}\ntype: executeCode\n${group('source', `plsqlCode:${code('plsql', sql)}`)}\n${group('execution', `sequence: 10\npoint: ${point}`)}`,
  );
}
function item(name: string, field: string, sequence: number, hidden: boolean, required: boolean) {
  return node(
    'pageItem',
    name,
    [
      `type: ${hidden ? 'hidden' : 'textField'}`,
      hidden ? '' : group('label', `label: ${scalar(field)}\nalignment: left`),
      group('layout', `sequence: ${sequence}\nregion: @form\nslot: regionBody`),
      hidden
        ? group('security', 'sessionStateProtection: checksumRequiredSessionLevel')
        : group('appearance', 'template: @/optional-floating\ntemplateOptions: #DEFAULT#\nwidth: 32'),
      hidden ? '' : group('validation', `valueRequired: ${required}`),
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
export function summaryRegion(blueprint: Blueprint, instance: Instance, allocation: Allocation) {
  const { entity, predicate } = bind(blueprint, instance),
    field = entity.read.fields[instance.parameters.groupField ?? ''];
  if (!field) throw new Fault('GROUP_FIELD_REQUIRED', 'Summary blocks require a mapped grouping field.', 5);
  return node(
    'region',
    allocation.prefix + '-summary',
    [
      `name: ${scalar(instance.parameters.title)}`,
      'type: cards',
      source(
        `select ${field.column} ID, ${field.column} TITLE, to_char(count(*)) STATUS from ${entity.read.object} where ${predicate} group by ${field.column}`,
      ),
      layout(30),
      appearance('cards-container'),
      group('advanced', `htmlDomId: ${allocation.prefix}_summary`),
      group('card', 'primaryKeyColumn1: ID'),
      group('title', 'column: TITLE'),
      group('body', 'column: STATUS'),
    ].join('\n'),
  );
}
export function render(
  blueprint: Blueprint,
  id: string,
  instance: Instance,
  block: Block,
  allocation: Allocation,
  summaries: { instance: Instance; allocation: Allocation }[] = [],
) {
  const binding = bind(blueprint, instance),
    { entity, keys, predicate, command, writable } = binding;
  const fields = Object.entries(entity.read.fields).sort(([a], [b]) => (a < b ? -1 : 1));
  const file = (number: number) =>
    `pages/p${String(number).padStart(5, '0')}-${allocation.prefix}${number === allocation.dialog ? '_edit' : ''}.apx`;
  if (block.renderer === 'status-summary')
    return {
      [file(allocation.page)]: page(
        allocation,
        instance.parameters.title,
        summaryRegion(blueprint, instance, allocation),
      ),
    };
  if (block.renderer === 'read-only-detail') {
    if (keys.length !== 1)
      throw new Fault(
        'COMPOSITE_DETAIL_UNSUPPORTED',
        'This detail adapter requires one scalar route key.',
        5,
      );
    const keyItem = `P${allocation.page}_${keys[0]!.toUpperCase()}`;
    let body = node(
      'region',
      'form',
      `name: ${scalar(instance.parameters.title)}\ntype: staticContent\n${layout(10)}\n${appearance('standard')}`,
    );
    body += item(keyItem, keys[0]!, 0, true, false);
    for (const [field] of fields.filter(([f]) => !keys.includes(f)))
      body += node(
        'pageItem',
        `P${allocation.page}_${field.toUpperCase()}`,
        `type: displayOnly\n${group('label', `label: ${field}`)}\n${group('layout', `sequence: ${(fields.findIndex(([f]) => f === field) + 1) * 10}\nregion: @form\nslot: regionBody`)}\n${appearance('optional')}`,
      );
    body += process(
      allocation.prefix + '-detail',
      'beforeHeader',
      `begin\n if :${keyItem} is not null then\n select ${fields.map(([, f]) => f.column).join(', ')} into ${fields.map(([f]) => ':P' + allocation.page + '_' + f.toUpperCase()).join(', ')} from ${entity.read.object} where (${predicate}) and ${entity.read.fields[keys[0]!]!.column}=:${keyItem};\n end if;\nend;`,
    );
    return { [file(allocation.page)]: page(allocation, instance.parameters.title, body) };
  }
  if (block.renderer === 'history-timeline') {
    const time = entity.read.fields[instance.parameters.timeField ?? ''],
      title = entity.read.fields[instance.parameters.detailField ?? ''],
      status = entity.read.fields[instance.parameters.groupField ?? ''];
    if (!time || !['date', 'timestamp'].includes(time.type) || !title || !status)
      throw new Fault(
        'TIMELINE_BINDING_REQUIRED',
        'Timeline needs a temporal field, title and status mappings.',
        5,
      );
    const sql = `select 'EV' USER_AVATAR, apex_escape.html(${title.column}) USER_NAME, ${time.column} EVENT_DATE, apex_escape.html(${title.column}) EVENT_TITLE, apex_escape.html(${status.column}) EVENT_DESC, 'fa-history' EVENT_ICON, apex_escape.html(${status.column}) EVENT_STATUS, cast(null as varchar2(100)) EVENT_LINK, 'History' EVENT_TYPE from ${entity.read.object} where (${predicate}) order by ${time.column}, ${keys.map((k) => entity.read.fields[k]!.column).join(', ')}`;
    const names = [
      'USER_AVATAR',
      'USER_NAME',
      'EVENT_DATE',
      'EVENT_TITLE',
      'EVENT_DESC',
      'EVENT_ICON',
      'EVENT_STATUS',
      'EVENT_LINK',
      'EVENT_TYPE',
    ];
    const cols = names
      .map((name, i) =>
        node(
          'column',
          name,
          `reportColumnQueryId: ${i + 1}\nderivedColumn: N\n${group('heading', `heading: ${name}`)}\n${group('layout', `sequence: ${(i + 1) * 10}`)}`,
        ),
      )
      .join('');
    const timeline = node(
      'region',
      allocation.prefix + '-history',
      `name: ${scalar(instance.parameters.title)}\ntype: classicReport\n${source(sql)}\n${layout(10)}\n${appearance('standard')}\n${group('componentAppearance', 'template: @/timeline\ntemplateOptions: #DEFAULT#')}\n${cols}`,
    );
    return { [file(allocation.page)]: page(allocation, instance.parameters.title, timeline) };
  }
  if (block.renderer === 'master-detail') {
    if (keys.length !== 1 || !instance.parameters.parentField)
      throw new Fault(
        'MASTER_DETAIL_BINDING_REQUIRED',
        'A self-referencing parent field and scalar key are required.',
        5,
      );
    const key = entity.read.fields[keys[0]!]!,
      parent = entity.read.fields[instance.parameters.parentField]!;
    if (parent.type !== key.type)
      throw new Fault('MASTER_DETAIL_KEY_MISMATCH', 'Parent and key types differ.', 5);
    const selected = `P${allocation.page}_PARENT`,
      master = allocation.prefix + '-master',
      detail = allocation.prefix + '-detail';
    const cols = () =>
      fields
        .map(([name, field], i) =>
          node(
            'column',
            field.column,
            `type: plainText\n${group('heading', `heading: ${name}`)}\n${group('layout', `sequence: ${(i + 1) * 10}`)}\n${group('source', `dataType: ${['integer', 'decimal'].includes(field.type) ? 'NUMBER' : ['date', 'timestamp'].includes(field.type) ? 'DATE' : 'STRING'}`)}`,
          ),
        )
        .join('');
    const list = (region: string, predicateSQL: string, sequence: number, link = false) =>
      node(
        'region',
        region,
        `name: ${link ? 'Master records' : 'Related records'}\ntype: interactiveReport\n${source(`select ${fields.map(([, f]) => f.column).join(', ')} from ${entity.read.object} where (${predicate}) and ${predicateSQL}`)}\n${layout(sequence)}\n${appearance('interactive-report')}\n${link ? group('link', `linkColumn: customTarget\ntarget: {\n    page: ${allocation.page}\n    items: {\n        ${selected}: #${key.column}#\n    }\n}\nlinkIcon: View`) : ''}\n${cols()}`,
      );
    const hidden = node(
      'pageItem',
      selected,
      `type: hidden\n${group('layout', `sequence: 1\nregion: @${master}\nslot: regionBody`)}\n${group('security', 'sessionStateProtection: checksumRequiredSessionLevel')}`,
    );
    return {
      [file(allocation.page)]: page(
        allocation,
        instance.parameters.title,
        list(master, `${parent.column} is null`, 10, true) +
          hidden +
          list(detail, `${parent.column}=:${selected}`, 20),
      ),
    };
  }
  const region = allocation.prefix + '-records',
    filterItem = `P${allocation.page}_FILTER`;
  const where = instance.parameters.filterField
    ? `${predicate} and (${entity.read.fields[instance.parameters.filterField]!.column} = :${filterItem} or :${filterItem} is null)`
    : predicate;
  const columns = fields
    .map(([name, field], i) =>
      node(
        'column',
        field.column,
        `type: ${keys.includes(name) && writable ? 'hidden' : 'plainText'}\n${group('heading', `heading: ${scalar(name)}`)}\n${group('layout', `sequence: ${(i + 1) * 10}`)}\n${group('source', `dataType: ${['integer', 'decimal'].includes(field.type) ? 'NUMBER' : ['date', 'timestamp'].includes(field.type) ? 'DATE' : 'STRING'}`)}`,
      ),
    )
    .join('\n');
  const report = node(
    'region',
    region,
    [
      `name: ${scalar(instance.parameters.title)}`,
      'type: interactiveReport',
      source(
        `select ${fields.map(([, f]) => f.column).join(', ')} from ${entity.read.object} where ${where}`,
        instance.parameters.filterField ? filterItem : undefined,
      ),
      layout(10),
      appearance('interactive-report'),
      group('advanced', `htmlDomId: ${allocation.prefix}_records`),
      writable && instance.parameters.editEnabled
        ? group(
            'link',
            `linkColumn: customTarget\ntarget: {\n    page: ${allocation.dialog}\n    items: {\n        P${allocation.dialog}_${keys[0]!.toUpperCase()}: #${entity.read.fields[keys[0]!]!.column}#\n    }\n    clearCache: ${allocation.dialog}\n}\nlinkIcon: <span class="fa fa-edit" aria-label="Edit"></span>`,
          )
        : '',
      columns,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  let body = report;
  if (instance.parameters.filterField) {
    const filter = instance.parameters.filterField;
    body += node(
      'pageItem',
      filterItem,
      `type: textField\n${group('label', `label: ${filter}`)}\n${group('layout', `sequence: 5\nregion: @${region}\nslot: regionBody`)}\n${group('appearance', 'template: @/optional-floating\ntemplateOptions: #DEFAULT#')}`,
    );
    body += dynamic(
      allocation.prefix + '-filter',
      'change',
      `selectionType: items\nitems: ${filterItem}`,
      refresh('refresh', region, 10),
    );
  }
  if (writable && instance.parameters.createEnabled)
    body += button(
      allocation.prefix + '-create',
      'Create',
      region,
      `action: redirectThisApp\ntarget: {\n    page: ${allocation.dialog}\n    clearCache: ${allocation.dialog}\n}`,
    );
  for (const summary of summaries) body += summaryRegion(blueprint, summary.instance, summary.allocation);
  if (writable) {
    const targets = [
      allocation.prefix + '_records',
      ...summaries.map((s) => s.allocation.prefix + '_summary'),
    ];
    const refreshes = jsAction(
      'refresh-bound-regions',
      `var e=this.data; if(!e||e.originInstance!==${JSON.stringify(id)}||e.entityRef!==${JSON.stringify(binding.entityRef)}||!e.recordKey||!e.recordVersion||!e.correlationId||!['create','edit'].includes(e.operation)) return; var host=document.getElementById(${JSON.stringify(allocation.prefix + '_records')}); if(host.dataset.composerCorrelation===e.correlationId) return; host.dataset.composerCorrelation=e.correlationId; ${JSON.stringify(targets)}.forEach(function(id){var region=apex.region(id); if(region) region.refresh();});`,
    );
    body += dynamic(
      allocation.prefix + '-saved',
      'apexafterclosedialog',
      `selectionType: region\nregion: @${region}`,
      refreshes,
    );
  }
  const result: Record<string, string> = {
    [file(allocation.page)]: page(allocation, instance.parameters.title, body),
  };
  if (!writable || !command || !allocation.dialog) return result;
  const dialog = allocation.dialog,
    version = entity.capabilities.optimisticLock!.field;
  const itemName = (field: string) => `P${dialog}_${field.toUpperCase()}`;
  const numberFormat = '99999999999999999999999999999999999999D99999999999999999999999999999999999999';
  const inputExpression = (field: string) => {
    const spec = entity.read.fields[field]!,
      value = ':' + itemName(field);
    return ['integer', 'decimal'].includes(spec.type)
      ? `to_number(${value},'${numberFormat}','NLS_NUMERIC_CHARACTERS=''.,''')`
      : spec.type === 'date'
        ? `to_date(${value},'FXYYYY-MM-DD')`
        : spec.type === 'timestamp'
          ? `to_timestamp(${value},'FXYYYY-MM-DD"T"HH24:MI:SS.FF6')`
          : value;
  };
  const readExpression = (field: string) => {
    const spec = entity.read.fields[field]!;
    return ['integer', 'decimal'].includes(spec.type)
      ? `to_char(${spec.column},'TM9','NLS_NUMERIC_CHARACTERS=''.,''')`
      : spec.type === 'date'
        ? `to_char(${spec.column},'YYYY-MM-DD')`
        : spec.type === 'timestamp'
          ? `to_char(${spec.column},'YYYY-MM-DD"T"HH24:MI:SS.FF6')`
          : spec.column;
  };
  const validation = instance.parameters.editableFields
    .map((field) => {
      const spec = entity.read.fields[field]!,
        value = ':' + itemName(field),
        checks: string[] = [];
      if (!spec.nullable) checks.push(`${value} is null`);
      if (spec.maxLength) checks.push(`length(${value})>${spec.maxLength}`);
      if (spec.enum?.length)
        checks.push(
          `${value} not in (${spec.enum.map((v) => "'" + v.replaceAll("'", "''") + "'").join(', ')})`,
        );
      if (['integer', 'decimal'].includes(spec.type))
        checks.push(
          `${value} is not null and not regexp_like(${value},'${spec.type === 'integer' ? '^[+-]?[0-9]+$' : '^[+-]?[0-9]+([.][0-9]+)?$'}')`,
        );
      return checks.length
        ? `if ${checks.map((c) => '(' + c + ')').join(' or ')} then raise_application_error(-20002,'Invalid ${field}'); end if;`
        : '';
    })
    .join('\n  ');
  let form = node(
    'region',
    'form',
    `name: ${scalar(instance.parameters.title)}\ntype: staticContent\n${layout(10, 'contentBody')}\n${appearance('standard')}`,
  );
  form += node(
    'region',
    'buttons',
    `name: Actions\ntype: staticContent\n${layout(20, 'dialogFooter')}\n${appearance('buttons-container')}`,
  );
  for (const [field, spec] of fields)
    if (instance.parameters.editableFields.includes(field) || keys.includes(field) || field === version)
      form += item(
        itemName(field),
        field,
        fields.findIndex(([n]) => n === field) * 10 + 10,
        !instance.parameters.editableFields.includes(field),
        !spec.nullable,
      );
  form += button('save', 'Save', 'buttons', 'action: definedByDynamicAction');
  form += button('cancel', 'Cancel', 'buttons', 'action: definedByDynamicAction');
  form += dynamic(
    'cancel-dialog',
    'click',
    'selectionType: button\nbutton: @cancel',
    node(
      'action',
      'cancel',
      'action: cancelDialog\n' + group('execution', 'sequence: 10\nfireOnInit: false'),
    ),
  );
  const mappedFields = fields.filter(
    ([field]) =>
      instance.parameters.editableFields.includes(field) || keys.includes(field) || field === version,
  );
  form += process(
    allocation.prefix + '-read',
    'beforeHeader',
    `begin\n  if :${itemName(keys[0]!)} is not null then\n    select ${mappedFields.map(([f]) => readExpression(f)).join(', ')} into ${mappedFields.map(([f]) => ':' + itemName(f)).join(', ')} from ${entity.read.object} where ${entity.read.fields[keys[0]!]!.column} = :${itemName(keys[0]!)} and (${predicate});\n  end if;\nend;`,
  );
  const variables = new Map<string, string>();
  for (const [argument, mapping] of Object.entries(command.inputs).sort(([a], [b]) => (a < b ? -1 : 1)))
    variables.set(argument, mapping.mode === 'in-out' ? 'l_key' : inputExpression(mapping.from.slice(7)));
  variables.set(command.outputs.recordKey.from, 'l_key');
  variables.set(command.outputs.recordVersion.from, 'l_version');
  const saveName = allocation.prefix + '_SAVE';
  const server = `declare\n  l_key ${entity.read.object}.${entity.read.fields[keys[0]!]!.column}%type;\n  l_authorized boolean;\n  l_version ${entity.read.object}.${entity.read.fields[version]!.column}%type;\nbegin\n  savepoint composer_save;\n  l_authorized := (${binding.writeExpression!});\n  if l_authorized is null or not l_authorized or not apex_authentication.is_authenticated then raise_application_error(-20001, 'Authorization denied'); end if;\n  l_key := ${inputExpression(keys[0]!)};\n  if apex_application.g_x01 = 'create' then\n    if ${instance.parameters.createEnabled ? 'false' : 'true'} or l_key is not null or :${itemName(version)} is not null then raise_application_error(-20002, 'Invalid create draft'); end if;\n  elsif apex_application.g_x01 = 'edit' then\n    if ${instance.parameters.editEnabled ? 'false' : 'true'} or l_key is null or :${itemName(version)} is null then raise_application_error(-20002, 'Invalid edit draft'); end if;\n  else raise_application_error(-20002, 'Invalid operation'); end if;\n  ${validation}\n  ${instance.extensions.beforeSaveValidation ?? ''}\n  ${command.package}.${command.procedure}(${[...variables].map(([argument, value]) => `${argument} => ${value}`).join(', ')});\n  if l_key is null or l_version is null then raise_application_error(-20004, 'API output contract violated'); end if;\n  ${instance.extensions.afterSaveNotification ?? ''}\n  apex_json.open_object; apex_json.write('ok',true); apex_json.write('recordKey',${['integer', 'decimal'].includes(entity.read.fields[keys[0]!]!.type) ? "to_char(l_key,'TM9','NLS_NUMERIC_CHARACTERS=''.,''')" : 'l_key'}); apex_json.write('recordVersion',to_char(l_version,'TM9','NLS_NUMERIC_CHARACTERS=''.,''')); apex_json.close_object;\nexception when others then\n  rollback to composer_save;\n  apex_json.open_object; apex_json.write('ok',false); apex_json.write('code',case sqlcode when -20001 then 'authorization' when -20002 then 'validation' when -20003 then 'conflict' else 'server-error' end); apex_json.write('message','Save failed. Review fields and reload after a conflict.'); apex_json.close_object;\nend;`;
  form += process(saveName, 'ajaxCallback', server);
  const pageItems = mappedFields.map(([f]) => '#' + itemName(f)).join(',');
  const js = `var button = this.triggeringElement; if (button.disabled) return; button.disabled = true;\napex.server.process(${JSON.stringify(saveName)}, {x01: apex.item(${JSON.stringify(itemName(keys[0]!))}).getValue() ? 'edit' : 'create', pageItems: ${JSON.stringify(pageItems)}}, {dataType: 'json', success: function(data) { if (data.ok) { apex.navigation.dialog.close(true, {entityRef: ${JSON.stringify(binding.entityRef)}, recordKey: data.recordKey, recordVersion: data.recordVersion, operation: apex.item(${JSON.stringify(itemName(keys[0]!))}).getValue() ? 'edit' : 'create', originInstance: ${JSON.stringify(id)}, correlationId: crypto.randomUUID()}); } else { apex.message.showErrors([{type:'error',location:'page',message:data.message,unsafe:false}]); } }, error: function() {apex.message.showErrors([{type:'error',location:'page',message:'Save request failed.',unsafe:false}]);}, complete: function() {button.disabled = false;} });`;
  form += dynamic('save-dialog', 'click', 'selectionType: button\nbutton: @save', jsAction('save-api', js));
  result[file(dialog)] = page(allocation, instance.parameters.title, form, true);
  return result;
}
