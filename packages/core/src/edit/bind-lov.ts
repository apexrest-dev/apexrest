import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import { group, indent } from '../apexlang-writer.ts';
import {
  ApexLangDocument,
  readProperty,
  scalarText,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import type { PageSnapshot, PlannedEdit } from './transaction.ts';

/**
 * Binds an existing list item to an existing shared LOV (`edit` operation `bindLov`). The item's
 * `lov` group becomes `type: sharedComponent` + `lov: @id`; only the superseded LOV source
 * properties (static values, queries, function bodies, the previous reference) are removed, and the
 * group's display settings are kept unless the operation sets them. Cascading parents and submitted
 * items are checked against the page. The LOV is read in the same transaction and may be bound to
 * the digest the caller reviewed. The item, its ids, security and session-state settings and every
 * other property keep their bytes. Qualified for 26.2 sources, whose exports use this reference.
 */

export interface BindLovOperation {
  op: 'bindLov';
  item: string;
  /** Shared LOV id or name. */
  lov: string;
  /** Digest of the LOV file the caller read; a changed LOV is a conflict. */
  expectedLovDigest?: string | undefined;
  /** Null entry: shown with this display text (and return value) when given; `false` removes it. */
  nullValue?: { display: string; return?: string | undefined } | false | undefined;
  displayExtraValues?: boolean | undefined;
  /** Cascading parents; `null` removes an existing cascade. */
  cascade?:
    | {
        parentItems: string[];
        itemsToSubmit?: string[] | undefined;
        parentRequired?: boolean | undefined;
      }
    | null
    | undefined;
}

const LIST_ITEMS = new Set([
  'selectList',
  'radioGroup',
  'popupLov',
  'checkboxGroup',
  'shuttle',
  'selectOne',
  'selectMany',
  'combobox',
  'listManager',
]);
/** `lov` group properties that describe the LOV source; everything else is a display setting. */
const SOURCE = new Set([
  'type',
  'lov',
  'staticValues',
  'sqlQuery',
  'plsqlFunctionBody',
  'javaScriptFunctionBody',
  'language',
  'location',
  'tableName',
  'tableOwner',
  'whereClause',
  'orderByClause',
  'displayColumn',
  'returnColumn',
  'remoteServer',
  'restSource',
]);
const SETTINGS = new Set(['displayNullValue', 'nullDisplayValue', 'nullReturnValue', 'displayExtraValues']);

export const bindLovDependencies = (operations: BindLovOperation[]) =>
  operations.map((operation) => `lov:${operation.lov}`);

const refOf = (value: unknown) =>
  value && typeof value === 'object' && 'ref' in value
    ? String((value as { ref: unknown }).ref)
    : String(value ?? '').replace(/^@/u, '');

/** Lines of one group (without its braces), as `key: value` texts, refusing multi-line values. */
function groupLines(doc: ApexLangDocument, owner: ComponentNode, name: string) {
  const range = owner.groups.get(name);
  if (!range) return [];
  const lines: { key: string; text: string }[] = [];
  for (const [path, property] of owner.properties) {
    if (!path.startsWith(name + '.')) continue;
    const key = path.slice(name.length + 1);
    if (key.includes('.'))
      throw new Fault(
        'TRANSFORM_UNSUPPORTED',
        `${owner.key} ${name}.${key} is nested; edit it in source.`,
        5,
      );
    if (property.opaque && !SOURCE.has(key))
      throw new Fault(
        'TRANSFORM_UNSUPPORTED',
        `${owner.key} ${path} holds a multi-line value; edit it in source.`,
        5,
      );
    lines.push({ key, text: doc.lines[property.line]!.text.trim() });
  }
  return lines;
}
/** Replaces a group's lines (or inserts the group before the first child) with `text`; empty text removes it. */
function replaceGroup(
  doc: ApexLangDocument,
  owner: ComponentNode,
  name: string,
  text: string,
): TextEdit | undefined {
  const existing = owner.groups.get(name);
  const body = text
    ? indent(text, owner.indent + 4)
        .split('\n')
        .join(doc.eol) + doc.eol
    : '';
  if (existing) {
    const open = doc.lines[existing.open]!;
    const close = doc.lines[existing.close]!;
    return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: body };
  }
  if (!body) return undefined;
  const before = doc.lines[owner.children[0]?.open ?? owner.close]!;
  return { start: before.offset, end: before.offset, content: body };
}

export function planBindLov(snapshot: PageSnapshot, operations: BindLovOperation[]): PlannedEdit {
  const { doc, node: page, parsed, release, related } = snapshot;
  if (release !== '26.2')
    throw new Fault(
      'OPERATION_UNSUPPORTED',
      'bindLov is qualified for 26.2 sources; edit 26.1 items in source.',
      2,
    );
  const edits: TextEdit[] = [];
  const checks: ((after: ApxComponent) => void)[] = [];
  const items = new Set(parsed.children.filter((c) => c.type === 'pageItem').map((c) => c.id.toUpperCase()));
  const seen = new Set<string>();
  for (const operation of operations) {
    const item = ApexLangDocument.one(page.children, 'pageItem', operation.item, `Page ${page.key}`);
    if (seen.has(item.key.toUpperCase()))
      throw new Fault('TRANSFORM_CONFLICT', `${item.key} is bound twice.`, 5);
    seen.add(item.key.toUpperCase());
    const type = String(item.properties.get('type')?.value ?? '');
    if (!LIST_ITEMS.has(type))
      throw new Fault(
        'OPERATION_UNSUPPORTED',
        `${item.key} is a ${type || 'item without a type'}, not a list item.`,
        2,
      );
    const lov = related.get(`lov:${operation.lov}`);
    if (!lov) throw new Fault('TARGET_NOT_FOUND', `No shared LOV ${operation.lov}.`, 2);
    if (operation.expectedLovDigest && operation.expectedLovDigest !== lov.digest)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${lov.file} changed since it was read; read it again and retry.`,
        5,
        'conflict',
        {
          file: lov.file,
          currentDigest: lov.digest,
        },
      );
    const id = lov.parsed.id;
    // Display settings are kept unless set here; source properties are superseded by the reference.
    const kept = groupLines(doc, item, 'lov').filter((line) => !SOURCE.has(line.key));
    const settings = new Map(kept.map((line) => [line.key, line.text]));
    if (operation.nullValue === false) {
      for (const key of ['displayNullValue', 'nullDisplayValue', 'nullReturnValue']) settings.delete(key);
      settings.set('displayNullValue', 'displayNullValue: false');
    } else if (operation.nullValue) {
      settings.set('displayNullValue', 'displayNullValue: true');
      settings.set('nullDisplayValue', `nullDisplayValue: ${scalarText(operation.nullValue.display)}`);
      if (operation.nullValue.return !== undefined)
        settings.set('nullReturnValue', `nullReturnValue: ${scalarText(operation.nullValue.return)}`);
      else settings.delete('nullReturnValue');
    }
    if (operation.displayExtraValues !== undefined)
      settings.set('displayExtraValues', `displayExtraValues: ${operation.displayExtraValues}`);
    const ordered = [
      ...[...SETTINGS].filter((key) => settings.has(key)).map((key) => settings.get(key)!),
      ...[...settings].filter(([key]) => !SETTINGS.has(key)).map(([, text]) => text),
    ];
    edits.push(
      replaceGroup(
        doc,
        item,
        'lov',
        group('lov', ['type: sharedComponent', `lov: @${id}`, ...ordered].join('\n')),
      )!,
    );
    if (operation.cascade !== undefined) {
      if (operation.cascade === null) {
        const removal = replaceGroup(doc, item, 'cascadingLov', '');
        if (removal) edits.push(removal);
      } else {
        const parents = operation.cascade.parentItems.map((name) => name.toUpperCase());
        const submitted = (operation.cascade.itemsToSubmit ?? []).map((name) => name.toUpperCase());
        if (!parents.length) throw new Fault('INVALID_INPUT', 'cascade needs parentItems.', 2);
        for (const name of [...parents, ...submitted]) {
          if (name === item.key.toUpperCase())
            throw new Fault('INVALID_INPUT', `${item.key} cannot cascade from itself.`, 2);
          if (!items.has(name))
            throw new Fault('TARGET_NOT_FOUND', `Page ${page.key} has no item ${name}.`, 2);
        }
        edits.push(
          replaceGroup(
            doc,
            item,
            'cascadingLov',
            group(
              'cascadingLov',
              [
                `parentItems: ${parents.join(',')}`,
                submitted.length ? `itemsToSubmit: ${submitted.join(',')}` : '',
                operation.cascade.parentRequired !== undefined
                  ? `parentRequired: ${operation.cascade.parentRequired}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n'),
            ),
          )!,
        );
      }
    }
    checks.push((after) => {
      const component = after.children.find(
        (c) => c.type === 'pageItem' && c.id.toUpperCase() === item.key.toUpperCase(),
      );
      if (
        !component ||
        readProperty(component, 'lov.type') !== 'sharedComponent' ||
        refOf(readProperty(component, 'lov.lov')) !== id
      )
        throw new Fault('TRANSFORM_INVALID', `${item.key} LOV binding did not read back.`, 5);
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => `item:${operation.item.toUpperCase()}`),
  };
}
