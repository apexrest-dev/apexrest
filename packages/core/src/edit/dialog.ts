import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import { group, indent, node, refreshAction } from '../apexlang-writer.ts';
import {
  ApexLangDocument,
  appendChild,
  readProperty,
  scalarText,
  setProperty,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import { reportRegion } from './columns.ts';
import type { PageSnapshot, PlannedEdit } from './transaction.ts';

/**
 * A create or edit dialog on an existing page (`edit` operation `addDialogAction`): a button, an
 * interactive-report row link or a classic-report column link that opens an explicitly identified
 * existing modal page, with item mappings and clear-cache pages, plus the dialog-closed refresh of
 * the region to update (an existing equivalent refresh is reused). The modal page is read in the
 * same locked transaction; its mode and the mapped items are checked against that read, and an
 * optional `expectedTargetDigest` binds the edit to the modal page the caller reviewed. Security is
 * never added or removed: a modal page that changes data without an authorization scheme is
 * reported as a warning. Creating the modal page itself is scaffold work.
 */

export interface DialogTarget {
  page: number;
  /** Modal page items to set: `#COLUMN#` from the clicked row, `&ITEM.` or a literal. */
  items?: Record<string, string> | undefined;
  clearCache?: number[] | undefined;
}
export interface AddDialogActionOperation {
  op: 'addDialogAction';
  target: DialogTarget;
  /** A new button opening the dialog. */
  button?: { id: string; label: string; region: string } | undefined;
  /** A row link: the interactive report itself, or one classic-report column. */
  link?: { region: string; column?: string | undefined; linkText?: string | undefined } | undefined;
  /** The region refreshed when the dialog closes (default: the linked region; required for a button). */
  refresh?: string | undefined;
  /** Digest of the modal page file the caller read; a changed modal page is a conflict. */
  expectedTargetDigest?: string | undefined;
}

const ID = /^[a-z][a-z0-9_-]{0,254}$/iu;
const ITEM = /^P\d{1,5}_[A-Z0-9_$#]{1,120}$/iu;
const DML =
  /formAutomaticRowProcessing|nativeFormDml|formDml|interactiveGridAutomaticRowProcessing|plsqlCode|executeCode/u;

/** A parsed `@id` reference (`{ref}`) or plain value, as an id. */
const refOf = (value: unknown) =>
  value && typeof value === 'object' && 'ref' in value
    ? String((value as { ref: unknown }).ref)
    : String(value ?? '').replace(/^@/u, '');

export const dialogDependencies = (operations: AddDialogActionOperation[]) =>
  operations.map((operation) => operation.target.page);

function targetText(target: DialogTarget) {
  const items = Object.entries(target.items ?? {});
  return group(
    'target:',
    [
      `page: ${target.page}`,
      items.length
        ? group(
            'items:',
            items.map(([key, value]) => `${key.toUpperCase()}: ${JSON.stringify(value)}`).join('\n'),
          )
        : '',
      target.clearCache?.length ? `clearCache: ${target.clearCache.join(',')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

/** Replaces a component's `name {` group (its lines) or inserts it before the first child component. */
function replaceGroup(doc: ApexLangDocument, owner: ComponentNode, name: string, text: string): TextEdit {
  const existing = owner.groups.get(name);
  const body =
    indent(text, owner.indent + 4)
      .split('\n')
      .join(doc.eol) + doc.eol;
  if (existing) {
    const open = doc.lines[existing.open]!;
    const close = doc.lines[existing.close]!;
    return { start: open.offset, end: close.offset + close.text.length + close.eol.length, content: body };
  }
  const before = doc.lines[owner.children[0]?.open ?? owner.close]!;
  return { start: before.offset, end: before.offset, content: body };
}

export function planDialogs(snapshot: PageSnapshot, operations: AddDialogActionOperation[]): PlannedEdit {
  const { doc, node: page, parsed, release, related } = snapshot;
  const edits: TextEdit[] = [];
  const warnings: string[] = [];
  const checks: ((after: ApxComponent) => void)[] = [];
  const targets: string[] = [];
  const buttons = new Set(page.children.filter((c) => c.kind === 'button').map((c) => c.key.toUpperCase()));
  const actions = new Set(
    page.children.filter((c) => c.kind === 'dynamicAction').map((c) => c.key.toUpperCase()),
  );
  let appended = '';
  for (const operation of operations) {
    if (Boolean(operation.button) === Boolean(operation.link))
      throw new Fault('INVALID_INPUT', 'addDialogAction needs either button or link.', 2);
    const modal = related.get(`page:${operation.target.page}`);
    if (!modal)
      throw new Fault('TARGET_NOT_FOUND', `No page file declares page ${operation.target.page}.`, 2);
    if (operation.expectedTargetDigest && operation.expectedTargetDigest !== modal.digest)
      throw new Fault(
        'TRANSFORM_CONFLICT',
        `${modal.file} changed since it was read; read it again and retry.`,
        5,
        'conflict',
        {
          file: modal.file,
          currentDigest: modal.digest,
        },
      );
    if (readProperty(modal.parsed, 'appearance.pageMode') !== 'modalDialog')
      throw new Fault('TARGET_NOT_MODAL', `Page ${operation.target.page} is not a modal dialog page.`, 2);
    const modalItems = new Set(
      modal.parsed.children.filter((c) => c.type === 'pageItem').map((c) => c.id.toUpperCase()),
    );
    for (const name of Object.keys(operation.target.items ?? {})) {
      if (!ITEM.test(name)) throw new Fault('INVALID_INPUT', `${name} is not a page item name.`, 2);
      if (!modalItems.has(name.toUpperCase()))
        throw new Fault('TARGET_NOT_FOUND', `Page ${operation.target.page} has no item ${name}.`, 2);
    }
    if (
      !readProperty(modal.parsed, 'security.authorizationScheme') &&
      modal.parsed.children.some(
        (c) => c.type === 'process' && DML.test(String(readProperty(c, 'type') ?? '')),
      )
    )
      warnings.push(
        `Page ${operation.target.page} runs processes without a page authorization scheme; review its authorization (none was added).`,
      );
    const target = targetText(operation.target);
    let refreshRegion = operation.refresh;
    let when: string;
    if (operation.button) {
      const button = operation.button;
      if (!ID.test(button.id)) throw new Fault('INVALID_INPUT', `${button.id} is not a valid button id.`, 2);
      if (buttons.has(button.id.toUpperCase()))
        throw new Fault('TARGET_EXISTS', `Button ${button.id} already exists.`, 5);
      buttons.add(button.id.toUpperCase());
      ApexLangDocument.one(page.children, 'region', button.region, `Page ${page.key}`);
      if (!refreshRegion)
        throw new Fault('INVALID_INPUT', 'A dialog button needs refresh: the region to update.', 2);
      const sequence =
        Math.max(
          0,
          ...parsed.children
            .filter((c) => c.type === 'button' && refOf(readProperty(c, 'layout.region')) === button.region)
            .map((c) => Number(readProperty(c, 'layout.sequence')) || 0),
        ) + 10;
      appended += node('button', button.id, [
        `buttonName: ${button.id.replaceAll('-', '_').toUpperCase()}`,
        `label: ${scalarText(button.label)}`,
        group(
          'layout',
          `sequence: ${sequence}\nregion: @${button.region}\nslot: ${release === '26.1' ? 'next' : 'NEXT'}`,
        ),
        group('appearance', 'buttonTemplate: @/text\ntemplateOptions: #DEFAULT#'),
        group('behavior', `action: redirectThisApp\n${target}`),
      ]);
      when = `event: apexafterclosedialog\nselectionType: button\nbutton: @${button.id}`;
      targets.push(`button:${button.id}`);
      checks.push((after) => {
        if (!after.children.some((c) => c.type === 'button' && c.id === button.id))
          throw new Fault('TRANSFORM_INVALID', `Button ${button.id} did not read back.`, 5);
      });
    } else {
      const link = operation.link!;
      const region = ApexLangDocument.one(page.children, 'region', link.region, `Page ${page.key}`);
      const type = reportRegion(region, 'A row link');
      const rowColumns = new Set(
        region.children.filter((c) => c.kind === 'column').map((c) => c.key.toUpperCase()),
      );
      for (const value of Object.values(operation.target.items ?? {}))
        for (const [, column] of value.matchAll(/#([A-Z0-9_$]+)#/giu))
          if (!rowColumns.has(column!.toUpperCase()))
            throw new Fault('TARGET_NOT_FOUND', `${region.key} has no column ${column} for #${column}#.`, 2);
      if (type === 'interactiveReport') {
        if (link.column)
          throw new Fault('INVALID_INPUT', 'Interactive reports link the whole row; omit column.', 2);
        edits.push(replaceGroup(doc, region, 'link', group('link', `linkColumn: customTarget\n${target}`)));
      } else {
        if (!link.column)
          throw new Fault('INVALID_INPUT', 'Classic report links need the column to link.', 2);
        const column = ApexLangDocument.one(region.children, 'column', link.column, `Region ${region.key}`);
        edits.push(setProperty(doc, column, 'type', 'link'));
        edits.push(
          replaceGroup(
            doc,
            column,
            'link',
            group(
              'link',
              `linkText: ${scalarText(link.linkText ?? `#${column.key.toUpperCase()}#`)}\n${target}`,
            ),
          ),
        );
      }
      refreshRegion ??= region.key;
      when = `event: apexafterclosedialog\nselectionType: region\nregion: @${region.key}`;
      targets.push(`region:${region.key}`);
      checks.push((after) => {
        const parsedRegion = after.children.find((c) => c.type === 'region' && c.id === region.key);
        const owner =
          type === 'interactiveReport'
            ? parsedRegion
            : parsedRegion?.children.find(
                (c) => c.type === 'column' && c.id.toUpperCase() === link.column!.toUpperCase(),
              );
        const page = owner && (readProperty(owner, 'link.target') as { page?: string } | undefined)?.page;
        if (String(page) !== String(operation.target.page))
          throw new Fault('TRANSFORM_INVALID', `${link.region} link did not read back.`, 5);
      });
    }
    ApexLangDocument.one(page.children, 'region', refreshRegion, `Page ${page.key}`);
    // An existing dialog-closed refresh of the same region on the same trigger is reused.
    const reused = parsed.children.some(
      (c) =>
        c.type === 'dynamicAction' &&
        readProperty(c, 'when.event') === 'apexafterclosedialog' &&
        (operation.button
          ? refOf(readProperty(c, 'when.button')) === operation.button.id
          : refOf(readProperty(c, 'when.region')) === operation.link!.region) &&
        c.children.some(
          (action) =>
            readProperty(action, 'action') === 'refresh' &&
            (readProperty(action, 'affectedElements.region') as { ref?: string } | undefined)?.ref ===
              refreshRegion,
        ),
    );
    if (!reused) {
      let name = `dialog-closed-${refreshRegion}`;
      for (let n = 2; actions.has(name.toUpperCase()); n++) name = `dialog-closed-${refreshRegion}-${n}`;
      actions.add(name.toUpperCase());
      appended += node('dynamicAction', name, [
        `name: ${JSON.stringify(`Refresh ${refreshRegion} after dialog`)}`,
        group('execution', 'sequence: 10'),
        group('when', when),
        refreshAction('refresh', refreshRegion, 10),
      ]);
      targets.push(`dynamicAction:${name}`);
    }
  }
  if (appended)
    edits.push(appendChild(doc, page, indent(appended.trimEnd()).split('\n').join(doc.eol) + doc.eol));
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets,
    warnings: [...new Set(warnings)],
  };
}
