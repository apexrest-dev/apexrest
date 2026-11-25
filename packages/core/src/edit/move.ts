import { Fault } from '../result.ts';
import type { ApxComponent } from '../preview/apexlang.ts';
import {
  ApexLangDocument,
  readProperty,
  referenceText,
  removeProperty,
  setPropertyText,
  type ComponentNode,
  type TextEdit,
} from './apexlang-edit.ts';
import type { PageSnapshot, PlannedEdit } from './transaction.ts';

/**
 * Same-page moves (`edit` operation `moveComponent`): an item or button into another region, or a
 * region under another parent region or back to page level, into an explicit slot and optionally
 * at a sequence. Only the `layout` reference, slot and sequence lines change; the component keeps
 * its place in the file, its id and every other byte, so references to it keep resolving. Slots
 * are limited to the positions Oracle's own 26.2 applications use for that kind and page mode; a
 * region template's own extra slots are checked by the preview lint (`SLOT-001`), which knows the
 * installed theme. Cross-page moves are not supported.
 */

export interface MoveComponentOperation {
  op: 'moveComponent';
  /** `item:NAME`, `button:ID` or `region:ID`. */
  component: string;
  to: {
    /** Destination region; for a region, omit it to move it to page level. */
    region?: string | undefined;
    slot: string;
    sequence?: number | undefined;
  };
}

export const ITEM_SLOTS = ['regionBody', 'body', 'contentBody'];
export const BUTTON_SLOTS = [
  'next',
  'previous',
  'edit',
  'create',
  'close',
  'change',
  'delete',
  'copy',
  'up',
  'regionBody',
  'belowBox',
  'top',
  'bottom',
];
export const SUB_REGION_SLOTS = ['subRegions', 'regionBody', 'body'];
export const PAGE_SLOTS = {
  normal: ['body', 'breadcrumbBar', 'leftColumn', 'rightSideColumn'],
  modal: ['contentBody', 'dialogFooter'],
};
const KINDS: Record<string, string> = { item: 'pageItem', button: 'button', region: 'region' };

const refOf = (value: unknown) =>
  value && typeof value === 'object' && 'ref' in value
    ? String((value as { ref: unknown }).ref)
    : value === undefined
      ? undefined
      : String(value).replace(/^@/u, '');

export function planMoves(snapshot: PageSnapshot, operations: MoveComponentOperation[]): PlannedEdit {
  const { doc, node: page, parsed } = snapshot;
  const modal = readProperty(parsed, 'appearance.pageMode') === 'modalDialog';
  const edits: TextEdit[] = [];
  const checks: ((after: ApxComponent) => void)[] = [];
  const seen = new Set<string>();
  const regions = page.children.filter((child) => child.kind === 'region');
  for (const operation of operations) {
    const at = operation.component.indexOf(':');
    const kind = KINDS[operation.component.slice(0, at)];
    const id = operation.component.slice(at + 1);
    if (at < 1 || !kind || !id)
      throw new Fault('INVALID_INPUT', 'component is item:NAME, button:ID or region:ID.', 2);
    const node = ApexLangDocument.one(page.children, kind, id, `Page ${page.key}`);
    if (seen.has(`${kind}:${node.key.toUpperCase()}`))
      throw new Fault('TRANSFORM_CONFLICT', `${operation.component} is moved twice.`, 5);
    seen.add(`${kind}:${node.key.toUpperCase()}`);
    const { region: destination, slot, sequence } = operation.to;
    const parentPath = kind === 'region' ? 'layout.parentRegion' : 'layout.region';
    let target: ComponentNode | undefined;
    if (destination !== undefined) {
      target = ApexLangDocument.one(regions, 'region', destination, `Page ${page.key}`);
      if (kind === 'region') {
        // A region cannot move into itself or one of its own sub-regions.
        for (let current: ComponentNode | undefined = target; current;) {
          if (current === node)
            throw new Fault('INVALID_INPUT', `${node.key} cannot move into itself or a sub-region.`, 2);
          const parent = refOf(current.properties.get('layout.parentRegion')?.value);
          current = parent
            ? regions.find((region) => region.key.toUpperCase() === parent.toUpperCase())
            : undefined;
        }
      }
    } else if (kind !== 'region')
      throw new Fault('INVALID_INPUT', `${operation.component} needs a destination region.`, 2);
    const targetType = target ? String(target.properties.get('type')?.value ?? '') : '';
    const allowed =
      kind === 'pageItem'
        ? ITEM_SLOTS
        : kind === 'button'
          ? [
              ...BUTTON_SLOTS,
              ...(targetType === 'interactiveReport' ? ['rightOfInteractiveReportSearchBar'] : []),
            ]
          : target
            ? SUB_REGION_SLOTS
            : PAGE_SLOTS[modal ? 'modal' : 'normal'];
    if (!allowed.includes(slot))
      throw new Fault(
        'OPERATION_UNSUPPORTED',
        `Slot ${slot} is not supported for this move; use one of ${allowed.join(', ')} or edit the source.`,
        2,
      );
    if (sequence !== undefined && !(Number.isInteger(sequence) && sequence > 0 && sequence < 1e9))
      throw new Fault('INVALID_INPUT', 'sequence must be a positive integer.', 2);
    const currentParent = refOf(node.properties.get(parentPath)?.value);
    if (!node.groups.has('layout')) {
      // One new group with every line: separate insertions would each create a layout group.
      const lines = [
        target ? `${parentPath.slice('layout.'.length)}: ${referenceText(target.key)}` : '',
        `slot: ${slot}`,
        sequence !== undefined ? `sequence: ${sequence}` : '',
      ].filter(Boolean);
      const indent = ' '.repeat(node.indent + 4);
      const before = doc.lines[node.children[0]?.open ?? node.close]!;
      edits.push({
        start: before.offset,
        end: before.offset,
        content:
          [`${indent}layout {`, ...lines.map((line) => `${indent}    ${line}`), `${indent}}`].join(doc.eol) +
          doc.eol,
      });
    } else {
      if (target) {
        if (currentParent?.toUpperCase() !== target.key.toUpperCase())
          edits.push(setPropertyText(doc, node, parentPath, referenceText(target.key)));
      } else if (currentParent !== undefined) {
        const removal = removeProperty(doc, node, parentPath);
        if (removal) edits.push(removal);
      }
      if (String(node.properties.get('layout.slot')?.value ?? '') !== slot)
        edits.push(setPropertyText(doc, node, 'layout.slot', slot));
      if (sequence !== undefined && Number(node.properties.get('layout.sequence')?.value) !== sequence)
        edits.push(setPropertyText(doc, node, 'layout.sequence', String(sequence)));
    }
    checks.push((after) => {
      const type = kind;
      const moved = after.children.find(
        (c) => c.type === type && c.id.toUpperCase() === node.key.toUpperCase(),
      );
      const parent = moved && refOf(readProperty(moved, parentPath));
      if (
        !moved ||
        readProperty(moved, 'layout.slot') !== slot ||
        (target ? parent?.toUpperCase() !== target.key.toUpperCase() : parent !== undefined) ||
        after.children.filter((c) => c.type === type && c.id.toUpperCase() === node.key.toUpperCase())
          .length !== 1
      )
        throw new Fault(
          'TRANSFORM_INVALID',
          `${operation.component} did not read back at its destination.`,
          5,
        );
    });
  }
  return {
    edits,
    verify: (after) => checks.forEach((check) => check(after)),
    targets: operations.map((operation) => operation.component),
  };
}
