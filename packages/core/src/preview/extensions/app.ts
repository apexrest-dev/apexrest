import { list, str, type ApxObject, type ApxValue } from '../apexlang.ts';
import { registerExtension, type ConditionHandler } from '../extensions.ts';

const strings = (values: ApxValue[]) =>
  values.map((value) => (typeof value === 'string' ? value : String(value)));

/** Server-side condition types the renderer does not evaluate itself. */
const item = (ctx: Parameters<ConditionHandler>[1], condition: ApxObject) =>
  ctx.session.items[str(condition, 'item').toUpperCase()] ?? '';
const pages = (condition: ApxObject) =>
  [...strings(list(condition, 'pages')), ...str(condition, 'value').split(','), str(condition, 'page')]
    .map((page) => page.trim())
    .filter(Boolean);
const colonList = (condition: ApxObject) => {
  const values = strings(list(condition, 'list'));
  return values.length ? values : str(condition, 'value').split(':');
};

const conditions: Record<string, ConditionHandler> = {
  'request=Value': (_renderer, ctx, condition) => ctx.request === str(condition, 'value'),
  'request!=Value': (_renderer, ctx, condition) => ctx.request !== str(condition, 'value'),
  'currentPage!=page': (_renderer, ctx, condition) => !pages(condition).includes(ctx.pageId),
  currentPageInList: (_renderer, ctx, condition) => pages(condition).includes(ctx.pageId),
  currentPageNotInList: (_renderer, ctx, condition) => !pages(condition).includes(ctx.pageId),
  itemIsInColonDelimitedList: (_renderer, ctx, condition) =>
    colonList(condition).includes(item(ctx, condition)),
  itemIsNotInColonDelimitedList: (_renderer, ctx, condition) =>
    !colonList(condition).includes(item(ctx, condition)),
  textIsContainedInItem: (_renderer, ctx, condition) => item(ctx, condition).includes(str(condition, 'text')),
  textIsContainedInValue: (_renderer, _ctx, condition) =>
    str(condition, 'value').split(',').includes(str(condition, 'text')),
  textIsNotContainedInValue: (_renderer, _ctx, condition) =>
    !str(condition, 'value').split(',').includes(str(condition, 'text')),
  'text=value': (_renderer, _ctx, condition) => str(condition, 'text') === str(condition, 'value'),
  'text!=value': (_renderer, _ctx, condition) => str(condition, 'text') !== str(condition, 'value'),
  'userPreference=value': () => false,
  'userPreference!=value': () => true,
  isReadOnly: () => false,
  isNotReadOnly: () => true,
  userIsNotThePublicUser: () => true,
  pageIsInPrinterFriendlyMode: () => false,
  pageIsNotInPrinterFriendlyMode: () => true,
};

registerExtension({ name: 'app', conditions });
