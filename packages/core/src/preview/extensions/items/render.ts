import { bool, get, num, str, type ApxComponent } from '../../apexlang.ts';
import { formatOracle } from '../../database.ts';
import type { ItemRenderer, ItemTemplateHook } from '../../extensions.ts';
import type { ApexRenderer, RenderContext } from '../../render.ts';
import { escapeHtml, templateOptions, text } from '../../theme.ts';
import {
  ajaxIdentifier,
  apexScript,
  attrs,
  cascading,
  displayFor,
  elementExtras,
  flag,
  isReadOnly,
  itemState,
  libraryVersion,
  lovEntries,
  lovRows,
  placeholder,
  required,
  separator,
  setting,
  splitValues,
  state,
  strings,
  type LovEntry,
} from './common.ts';
import { qrSvg } from './qrcode.ts';

const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');
const iconClasses = (value: string) =>
  /(^|\s)fa-/u.test(value) && !/(^|\s)fa(\s|$)/u.test(value) ? `fa ${value}` : value;

/** Items whose value comes from an LOV report extra values; the others show the raw value. */
function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

const DATE_DEFAULT = 'DD-MON-YYYY';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/u;

function dateMask(renderer: ApexRenderer, item: ApxComponent): string {
  return (
    str(item.props, 'appearance.formatMask') ||
    str(renderer.app.app.props, 'globalization.dateFormat') ||
    DATE_DEFAULT
  ).replace(/^FX/iu, '');
}

/** Session state from the database (ISO) shown in the item's mask; typed values stay as they are. */
function dateValue(value: string, mask: string): string {
  return ISO_DATE.test(value) ? (formatOracle(value.replace(' ', 'T'), mask) ?? value) : value;
}

function numberValue(value: string, mask: string): string {
  if (!mask || value === '') return value;
  const plain = Number(value);
  return Number.isFinite(plain) ? (formatOracle(plain, mask) ?? value) : value;
}

/** Classic read-only markup: display span plus the value in a hidden input that still submits. */
function readOnlyMarkup(item: ApxComponent, name: string, value: string, display: string, html = false) {
  state(item).container = ['is-readonly'];
  state(item).wrapper = ['display-only'];
  return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"${html ? '' : ' data-escape="true"'}>${html ? display : escapeHtml(display)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
}

function onload(ctx: RenderContext, code: string, ...scripts: string[]): void {
  for (const script of scripts) ctx.jsFiles.add(script);
  ctx.onload.push(code);
}

// ---------------------------------------------------------------- text family

const TRIM: Record<string, string> = {
  none: 'NONE',
  leading: 'LEADING',
  trailing: 'TRAILING',
  leadingAndTrailing: 'BOTH',
};
const SUBTYPE: Record<string, string> = { email: 'email', phone: 'tel', url: 'url', search: 'search' };

function icon(item: ApxComponent): string {
  const value = str(item.props, 'appearance.icon');
  if (!value) return '';
  const entry = state(item);
  entry.wrapper = [...(entry.wrapper ?? []), 'has-icon'];
  return `<span class="apex-item-icon ${escapeHtml(iconClasses(value))}" aria-hidden="true"></span>`;
}

function quickPicks(renderer: ApexRenderer, ctx: RenderContext, item: ApxComponent, name: string): string {
  const type = str(item.props, 'quickPicks.type');
  if (!type) return '';
  let picks: LovEntry[] = [];
  if (type === 'static')
    for (let index = 1; index <= 10; index += 1) {
      const label = str(item.props, `quickPicks.label${index}`);
      if (label) picks.push({ d: label, r: str(item.props, `quickPicks.value${index}`, label) });
    }
  else if (type === 'sqlQuery')
    picks = renderer.queryLov(ctx, str(item.props, 'quickPicks.sqlQuery'), undefined, undefined, name);
  else picks = lovEntries(renderer, ctx, item);
  const max = num(item.props, 'quickPicks.maxDisplayedEntries', 10);
  if (!picks.length) return '';
  return `<span class="apex-quick-picks">${picks
    .slice(0, max)
    .map(
      (pick) =>
        `<a href="javascript:void(0)" onclick="apex.item('${name}').setValue(${escapeHtml(JSON.stringify(pick.r))});return false;">${escapeHtml(pick.d)}</a>`,
    )
    .join(', ')}</span>`;
}

const textField: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, value);
  const extras = elementExtras(renderer, ctx, item);
  const subtype = SUBTYPE[setting(renderer, item, 'subtype')] ?? 'text';
  const textCase = setting(renderer, item, 'textCase').toUpperCase();
  const iconHtml = icon(item);
  const submit = flag(renderer, item, 'submitWhenEnterPressed', false)
    ? `return apex.submit({request:'${name}',submitIfEnter:event})`
    : undefined;
  return `<input${attrs({
    type: subtype,
    id: name,
    name,
    class: classes('text_field apex-item-text', iconHtml && 'apex-item-has-icon', ...extras.classes),
    value,
    size: num(item.props, 'appearance.width', 30),
    maxlength: num(item.props, 'validation.maxLength', 0) || undefined,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'data-trim-spaces': TRIM[setting(renderer, item, 'trimSpaces', 'leadingAndTrailing')] ?? 'BOTH',
    'data-text-case': textCase === 'UPPER' || textCase === 'LOWER' ? textCase : undefined,
    autocomplete: subtype === 'email' ? 'email' : subtype === 'tel' ? 'tel' : undefined,
    onkeypress: submit,
  })}${extras.attributes}>${iconHtml}${quickPicks(renderer, ctx, item, name)}`;
};

const numberField: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const mask = str(item.props, 'appearance.formatMask');
  const shown = numberValue(value, mask);
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, shown);
  const extras = elementExtras(renderer, ctx, item);
  const alignment = setting(renderer, item, 'numberAlignment', 'end');
  const min = setting(renderer, item, 'minValue');
  const max = setting(renderer, item, 'maxValue');
  const iconHtml = icon(item);
  return `<input${attrs({
    type: 'text',
    id: name,
    name,
    class: classes(
      'number_field apex-item-text apex-item-number',
      iconHtml && 'apex-item-has-icon',
      alignment === 'start' ? 'u-textStart' : alignment === 'center' ? 'u-textCenter' : 'u-textEnd',
      ...extras.classes,
    ),
    value: shown,
    size: num(item.props, 'appearance.width', 30),
    maxlength: num(item.props, 'validation.maxLength', 0) || undefined,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'data-min': min || undefined,
    'data-max': max || undefined,
    'data-format': mask || undefined,
    inputmode: setting(renderer, item, 'virtualKeyboard', 'decimal'),
  })}${extras.attributes}>${iconHtml}`;
};

/** The password mask widget (theme42) wraps the input in `apex-item-group--password` itself. */
const password: ItemRenderer = (renderer, ctx, item, name) => {
  itemState.set(item, {});
  const extras = elementExtras(renderer, ctx, item);
  const readOnly = isReadOnly(renderer, ctx, item);
  if (readOnly) state(item).container = ['is-readonly'];
  const iconHtml = icon(item);
  return `<input${attrs({
    type: 'password',
    name,
    id: name,
    class: classes(
      'password apex-item-text apex-item-password',
      iconHtml && 'apex-item-has-icon',
      readOnly && 'apex-item-password-readonly',
      ...extras.classes,
    ),
    value: '',
    size: num(item.props, 'appearance.width', 30),
    maxlength: num(item.props, 'validation.maxLength', 0) || undefined,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    autocomplete: 'current-password',
    required: required(item),
    readonly: readOnly,
    onkeypress: flag(renderer, item, 'submitWhenEnterPressed', true)
      ? `return apex.submit({request:'${name}',submitIfEnter:event})`
      : undefined,
  })}${extras.attributes}>${iconHtml}`;
};

const textarea: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  if (isReadOnly(renderer, ctx, item)) {
    Object.assign(state(item), { container: ['is-readonly'], wrapper: ['display-only'] });
    return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only" style="white-space:pre-wrap">${escapeHtml(value)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  const extras = elementExtras(renderer, ctx, item);
  const max = num(item.props, 'validation.maxLength', 0);
  const counter = flag(renderer, item, 'charCounter', false);
  const autoHeight = flag(renderer, item, 'autoHeight', false);
  const resizable = flag(renderer, item, 'resizable', true);
  return `<div class="apex-item-group apex-item-group--textarea"><textarea${attrs({
    name,
    rows: num(item.props, 'appearance.height', 5),
    cols: num(item.props, 'appearance.width', 30),
    maxlength: max || undefined,
    id: name,
    class: classes(
      'textarea apex-item-textarea',
      autoHeight && 'apex-item-textarea--autoHeight',
      ...extras.classes,
    ),
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'data-trim-spaces': TRIM[setting(renderer, item, 'trimSpaces', 'none')] ?? 'NONE',
    'data-resizable': resizable ? 'true' : undefined,
    'data-counter': counter ? 'true' : undefined,
    'data-max-char': counter && max ? max : undefined,
    'data-auto-height': autoHeight ? 'true' : undefined,
    style: resizable ? 'resize:both' : undefined,
  })}${extras.attributes}>${escapeHtml(value)}</textarea>${
    counter
      ? `<div id="${name}_CHAR_COUNT" style="display:none;" class="apex-item-textarea-counter"><span id="${name}_CHAR_COUNTER" class="apex-item-textarea-counter--length">${value.length}</span> of <span class="apex-item-textarea-counter--size">${max || 4000}</span></div>`
      : ''
  }</div>`;
};

/** Protected hidden items get the APEX checksum companion input (`data-for`), as in a real page. */
const hidden: ItemRenderer = (renderer, ctx, item, name, value) => {
  const input = `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}"${elementExtras(renderer, ctx, item).attributes}>`;
  return bool(item.props, 'settings.valueProtected', true)
    ? `${input}<input type="hidden" data-for="${name}" value="local-checksum">`
    : input;
};

const displayOnly: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const format = setting(renderer, item, 'format', 'plainText');
  const basedOn = setting(renderer, item, 'basedOn', get(item.props, 'lov') ? 'lov' : 'value');
  let display = value;
  if (basedOn === 'lov' || get(item.props, 'lov'))
    display = displayFor(lovEntries(renderer, ctx, item), splitValues(item, value)).join(', ');
  const mask = str(item.props, 'appearance.formatMask');
  if (mask) display = ISO_DATE.test(value) ? dateValue(value, mask) : numberValue(display, mask);
  const escape = bool(item.props, 'security.escapeSpecialChars', true) && format !== 'html';
  let html = escape ? escapeHtml(display) : display;
  if (format === 'markdown') {
    ctx.jsFiles.add(`#APEX_FILES#libraries/markedjs/${libraryVersion(renderer, 'markedjs')}/marked.umd.js`);
    html = escapeHtml(display);
    ctx.onload.push(
      `(function(e){if(window.marked&&e){e.innerHTML=apex.util.sanitizeHtml?apex.util.sanitizeHtml(marked.parse(e.textContent)):marked.parse(e.textContent);}})(document.getElementById(${json(`${name}_DISPLAY`)}));`,
    );
  } else if (flag(renderer, item, 'showLineBreaks', true) && escape) html = html.replaceAll('\n', '<br>');
  return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"${escape ? ' data-escape="true"' : ''}>${html}</span>${
    flag(renderer, item, 'sendOnPageSubmit', true)
      ? `<input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`
      : ''
  }`;
};

// ---------------------------------------------------------------- dates

const APPEARANCE: Record<string, string> = {
  showTodayButton: 'today-button',
  monthPicker: 'change-month',
  yearPicker: 'change-year',
};

const DATE_DISPLAY: Record<string, string> = { inline: 'inline', nativeHtml: 'native', popup: 'popup' };

const datePicker: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const mask = dateMask(renderer, item);
  const shown = dateValue(value, mask);
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, shown);
  // APEXlang settings.displayAs: inline / nativeHtml / popup; the web component takes inline / native / popup.
  const displayAs = DATE_DISPLAY[setting(renderer, item, 'displayAs', 'popup')] ?? 'popup';
  const behavior = new Set(
    setting(renderer, item, 'appearanceBehavior', 'monthPicker:yearPicker:showTodayButton')
      .split(':')
      .filter(Boolean),
  );
  const limit = (kind: 'min' | 'max') => {
    const type = setting(renderer, item, `${kind}Date`, 'none');
    if (type === 'static') {
      const raw = renderer.substitute(ctx.session, setting(renderer, item, `${kind}Static`), ctx.page, 'RAW');
      return dateValue(raw, mask) || undefined;
    }
    if (type === 'item') {
      const source = setting(renderer, item, `${kind}Item`).toUpperCase();
      return dateValue(ctx.session.items[source] ?? '', mask) || undefined;
    }
    return undefined;
  };
  const navigation = setting(renderer, item, 'navigationListFor');
  const showTime = flag(renderer, item, 'showTime', /HH|MI/iu.test(mask));
  const showOn = setting(renderer, item, 'showOn');
  const extras = elementExtras(renderer, ctx, item);
  const entry = state(item);
  entry.wrapper = [
    'date-picker-apex',
    ...(displayAs === 'inline' ? ['date-picker-apex-inline'] : []),
    ...(displayAs === 'native' ? ['date-picker-apex-native'] : []),
  ];
  const example = formatOracle(new Date().toISOString(), mask) ?? '';
  // The web component creates its own input (`<id>_input`), the calendar button and the popup.
  return `<a-date-picker${attrs({
    id: name,
    class: classes(`apex-item-datepicker--${displayAs}`, ...extras.classes),
    'display-as': displayAs,
    format: mask,
    'valid-example': example,
    value: shown,
    min: limit('min'),
    max: limit('max'),
    name,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'show-time': showTime ? 'true' : undefined,
    'today-button': behavior.has('showTodayButton') ? 'true' : undefined,
    'change-month':
      behavior.has('monthPicker') || navigation === 'month' || navigation === 'monthAndYear'
        ? 'true'
        : undefined,
    'change-year':
      behavior.has('yearPicker') || navigation === 'year' || navigation === 'monthAndYear'
        ? 'true'
        : undefined,
    'display-weeks': behavior.has('showWeek') ? 'number' : undefined,
    'previous-next-distance': behavior.has('paginateByMultipleMonths') ? 'number-of-month' : undefined,
    'number-of-months': /^[2-5]$/u.test(setting(renderer, item, 'multipleMonths'))
      ? setting(renderer, item, 'multipleMonths')
      : undefined,
    'show-days-outside-month': setting(renderer, item, 'daysOutsideMonth') || undefined,
    'show-on': showOn === 'iconClick' ? 'image' : showOn === 'itemFocus' ? 'focus' : undefined,
    'time-increment-minute': setting(renderer, item, 'timeIncrement') || undefined,
    'year-selection-range': setting(renderer, item, 'yearRange') || undefined,
    size: displayAs === 'inline' ? undefined : num(item.props, 'appearance.width', 20),
    'aria-labelledby': `${name}_LABEL`,
  })}${extras.attributes}></a-date-picker>`;
};

// ---------------------------------------------------------------- lists

function options(entries: LovEntry[], selected: string[]): string {
  return entries
    .map(
      (entry) =>
        `<option value="${escapeHtml(entry.r)}"${selected.includes(entry.r) ? ' selected="selected"' : ''}>${escapeHtml(entry.d)}</option>`,
    )
    .join('');
}

function cascadeInit(ctx: RenderContext, item: ApxComponent, name: string): Record<string, unknown> {
  const parents = cascading(item);
  if (!parents.parents) return {};
  return {
    ajaxIdentifier: ajaxIdentifier(ctx, name),
    dependingOnSelector: parents.parents,
    optimizeRefresh: parents.required,
    ...(parents.submit ? { pageItemsToSubmit: parents.submit } : {}),
  };
}

const selectList: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const multiple =
    flag(renderer, item, 'selectMultiple', false) || flag(renderer, item, 'multiSelection', false);
  const values = multiple ? splitValues(item, value) : [value];
  const nullShown = bool(item.props, 'lov.displayNullValue', !multiple);
  const entries = lovEntries(renderer, ctx, item, { values, nullDefault: !multiple });
  if (isReadOnly(renderer, ctx, item))
    return readOnlyMarkup(item, name, value, displayFor(entries, values.filter(Boolean)).join(', '));
  const extras = elementExtras(renderer, ctx, item);
  const cascade = cascadeInit(ctx, item, name);
  const action = setting(renderer, item, 'pageActionOnSelection', 'none');
  // APEX always registers the select list widget: its hasDisplayValue (selected option text) drives the
  // Universal Theme floating label, so a "- Select -" null display text keeps the label raised.
  ctx.onload.push(
    `apex.widget.selectList(${json(`#${name}`)},${json({
      ...cascade,
      ...(nullShown ? { nullValue: str(item.props, 'lov.nullReturnValue') } : {}),
      ...(multiple ? { storageType: 'SEPARATED', separator: separator(item) } : {}),
    })});`,
  );
  return `<select${attrs({
    id: name,
    name,
    class: classes('selectlist apex-item-select', ...extras.classes),
    'data-native-menu': 'false',
    size: multiple ? num(item.props, 'appearance.height', 5) : 1,
    multiple,
    required: required(item),
    onchange:
      action === 'submitPage'
        ? `apex.submit('${name}');`
        : action === 'redirectSetValue'
          ? `apex.navigation.redirect(apex.util.makeApplicationUrl({itemNames:['${name}'],itemValues:[this.value]}));`
          : undefined,
  })}${extras.attributes}>${options(entries, values)}</select>`;
};

/** Radio and checkbox options, in a column grid when `noOfCols` is set. Reused by the cascade route. */
export function choices(
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  name: string,
  value: string,
  input: 'radio' | 'checkbox',
): string {
  const selected = input === 'checkbox' ? splitValues(item, value) : [value];
  const entries = lovEntries(renderer, ctx, item, { values: selected });
  const columns = Math.max(0, num(item.props, 'settings.noOfCols', 0));
  const isRequired = required(item);
  const option = (entry: LovEntry, index: number) =>
    `<div class="apex-item-option"><input${attrs({
      type: input,
      id: `${name}_${index}`,
      name,
      'data-display': entry.d,
      value: entry.r,
      checked: selected.includes(entry.r),
      required: isRequired && input === 'radio',
      'aria-label': entry.d,
    })}><label for="${name}_${index}" aria-hidden="true">${escapeHtml(entry.d)}</label></div>`;
  const rendered = entries.map(option);
  if (!columns) return rendered.join('');
  const rows: string[] = [];
  for (let index = 0; index < rendered.length; index += columns)
    rows.push(`<div class="apex-item-grid-row">${rendered.slice(index, index + columns).join('')}</div>`);
  return `<div class="apex-item-grid ${input === 'radio' ? 'radio_group' : 'checkbox_group'}">${rows.join('')}</div>`;
}

function group(input: 'radio' | 'checkbox'): ItemRenderer {
  return (renderer, ctx, item, name, value) => {
    itemState.set(item, {});
    if (isReadOnly(renderer, ctx, item)) {
      const selected = input === 'checkbox' ? splitValues(item, value) : [value];
      return readOnlyMarkup(
        item,
        name,
        value,
        displayFor(lovEntries(renderer, ctx, item), selected.filter(Boolean)).join(', '),
      );
    }
    const extras = elementExtras(renderer, ctx, item);
    const cascade = cascadeInit(ctx, item, name);
    ctx.onload.push(
      `apex.widget.checkboxAndRadio(${json(`#${name}`)},${json(input)},${json({
        ...cascade,
        inputName: name,
        ...(input === 'checkbox' ? { storageType: 'SEPARATED', separator: separator(item) } : {}),
        ...(setting(renderer, item, 'pageActionOnSelection') === 'submitPage' ? { action: 'SUBMIT' } : {}),
      })});`,
    );
    return `<div${attrs({
      tabindex: '-1',
      id: name,
      'aria-labelledby': `${name}_LABEL`,
      class: classes(
        input === 'radio' ? 'radio_group' : 'checkbox_group',
        'apex-item-group apex-item-group--rc',
        input === 'radio' ? 'apex-item-radio' : 'apex-item-checkbox',
        ...extras.classes,
      ),
      role: input === 'radio' ? 'radiogroup' : 'group',
      'aria-required': required(item) ? 'true' : undefined,
    })}${extras.attributes}>${choices(renderer, ctx, item, name, value, input)}</div>`;
  };
}

const checkbox: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const on = setting(renderer, item, 'checkedValue', 'Y');
  const off = setting(renderer, item, 'uncheckedValue', 'N');
  const current = value === '' ? off : value;
  const readOnly = isReadOnly(renderer, ctx, item);
  if (readOnly) state(item).container = ['is-readonly'];
  const label = escapeHtml(renderer.substitute(ctx.session, renderer.label(item), ctx.page, 'RAW'));
  const extras = elementExtras(renderer, ctx, item);
  return `<div class="apex-item-single-checkbox"><input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${escapeHtml(current)}"><input${attrs(
    {
      type: 'checkbox',
      id: name,
      class: extras.classes.join(' ') || undefined,
      value: on,
      checked: current === on,
      disabled: readOnly,
      required: required(item),
      'data-unchecked-value': off,
      'aria-describedby': str(item.props, 'help.inlineHelpText') ? `${name}_inline_help` : undefined,
    },
  )}${extras.attributes}><label for="${name}" id="${name}_LABEL" class="u-checkbox">${label}</label></div>`;
};

function switchSettings(renderer: ApexRenderer, item: ApxComponent) {
  return {
    on: setting(renderer, item, 'onValue', 'Y'),
    off: setting(renderer, item, 'offValue', 'N'),
    onLabel: setting(renderer, item, 'onLabel', 'On'),
    offLabel: setting(renderer, item, 'offLabel', 'Off'),
  };
}

const switchItem: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const { on, off, onLabel, offLabel } = switchSettings(renderer, item);
  if (isReadOnly(renderer, ctx, item))
    return readOnlyMarkup(item, name, value, value === on ? onLabel : offLabel);
  const extras = elementExtras(renderer, ctx, item);
  const component = renderer.app.shared.find(
    (entry) =>
      entry.type === 'componentSetting' &&
      str(entry.props, 'name') === 'switch' &&
      str(entry.props, 'type') === 'item',
  );
  const style =
    setting(renderer, item, 'displayStyle') ||
    (component ? str(component.props, 'settings.displayStyle') : '') ||
    (strings(get(item.props, 'appearance.templateOptions')).includes(
      't-Form-fieldContainer--radioButtonGroup',
    )
      ? 'pillButton'
      : 'switch');
  if (style === 'pillButton') {
    onload(ctx, `apex.widget.yesNo(${json(name)},"SWITCH");`);
    state(item).wrapper = ['yes-no'];
    const radio = (key: string, val: string, label: string) =>
      `<input${attrs({ type: 'radio', id: `${name}_${key}`, name, value: val, checked: (value || off) === val })}><label for="${name}_${key}" class="a-Button">${escapeHtml(label)}</label>`;
    return `<div tabindex="-1" id="${name}" class="apex-button-group apex-item-group apex-item-group--switch" role="group" aria-labelledby="${name}_LABEL">${radio('Y', on, onLabel)}${radio('N', off, offLabel)}</div>`;
  }
  if (style === 'selectList')
    return `<select id="${name}" name="${name}" class="selectlist apex-item-select" size="1">${options(
      [
        { d: onLabel, r: on },
        { d: offLabel, r: off },
      ],
      [value || off],
    )}</select>`;
  onload(ctx, `apex.widget.yesNo(${json(name)},"SWITCH_CB");`);
  return `<span class="a-Switch"><input${attrs({
    type: 'checkbox',
    id: name,
    name,
    class: extras.classes.join(' ') || undefined,
    value: on,
    'data-on-label': onLabel,
    'data-off-value': off,
    'data-off-label': offLabel,
    checked: value === on,
    required: required(item),
  })}${extras.attributes}><span class="a-Switch-toggle"></span></span>`;
};

const SHUTTLE_BUTTONS: Record<string, [string, string][]> = {
  move: [
    ['RESET', 'Reset'],
    ['MOVE_ALL', 'Move All'],
    ['MOVE', 'Move'],
    ['REMOVE', 'Remove'],
    ['REMOVE_ALL', 'Remove All'],
  ],
  sort: [
    ['TOP', 'Top'],
    ['UP', 'Up'],
    ['DOWN', 'Down'],
    ['BOTTOM', 'Bottom'],
  ],
};

const shuttle: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const selected = splitValues(item, value);
  const entries = lovEntries(renderer, ctx, item).filter((entry) => entry.r !== '' || entry.d !== '');
  if (isReadOnly(renderer, ctx, item))
    return readOnlyMarkup(item, name, value, displayFor(entries, selected).join(', '));
  const controls = setting(renderer, item, 'showControls', 'all');
  const height = num(item.props, 'appearance.height', 5);
  const left = entries.filter((entry) => !selected.includes(entry.r));
  const right = selected
    .map((selectedValue) => entries.find((entry) => entry.r === selectedValue))
    .filter((entry): entry is LovEntry => Boolean(entry));
  const button = ([suffix, title]: [string, string]) =>
    `<button id="${name}_${suffix}" class="a-Button a-Button--noLabel a-Button--withIcon a-Button--small" type="button" title="${title}" aria-label="${title}"><span class="a-Icon icon-shuttle-${suffix.toLowerCase().replaceAll('_', '-')}" aria-hidden="true"></span></button>`;
  const moving = controls === 'all' || controls === 'movingOnly';
  const ordering = controls === 'all' || controls === 'orderingOnly';
  onload(
    ctx,
    `apex.widget.shuttle(${json(`#${name}`)},${json({
      ...cascadeInit(ctx, item, name),
      storageType: 'SEPARATED',
      separator: separator(item),
    })});`,
    apexScript('widget.shuttle'),
  );
  const extras = elementExtras(renderer, ctx, item);
  return `<div${attrs({
    class: classes('shuttle apex-item-group apex-item-group--shuttle', ...extras.classes),
    id: name,
    role: 'group',
    'aria-labelledby': `${name}_LABEL`,
    tabindex: '-1',
  })}${extras.attributes}><table cellpadding="0" cellspacing="0" border="0" role="presentation" class="shuttle"><tbody><tr><td class="shuttleSelect1"><select title="Move from" multiple="multiple" id="${name}_LEFT" size="${height}" class="shuttle_left apex-item-select">${options(left, [])}</select></td>${
    moving
      ? `<td align="center" class="shuttleControl">${SHUTTLE_BUTTONS.move!.map(button).join('')}</td>`
      : ''
  }<td class="shuttleSelect2"><select title="Move to" multiple="multiple" id="${name}_RIGHT" name="${name}" size="${height}" class="shuttle_right apex-item-select"${required(item) ? ' required' : ''}>${options(right, [])}</select></td>${
    ordering
      ? `<td align="center" class="shuttleSort2">${SHUTTLE_BUTTONS.sort!.map(button).join('')}</td>`
      : ''
  }</tr></tbody></table></div>`;
};

// ---------------------------------------------------------------- popup LOV and combobox

const popupLov: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const multiple =
    get(item.props, 'multipleValues.type') !== undefined || flag(renderer, item, 'multipleValues', false);
  const enterable = flag(renderer, item, 'manualEntry', false);
  const values = multiple ? splitValues(item, value) : value ? [value] : [];
  const lov = lovRows(renderer, ctx, item);
  const display = values.map(
    (entry) => lov.rows.find((row) => row[lov.returned] === entry)?.[lov.display] ?? entry,
  );
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, display.join(', '));
  // settings.displayAs: inlinePopup (POPUP, the default) or modalDialog (DIALOG).
  const isPopup = !['modalDialog', 'dialog'].includes(setting(renderer, item, 'displayAs', 'inlinePopup'));
  const columns = Object.fromEntries([
    ...lov.columns.map((column, index) => [
      column.name,
      {
        index,
        heading: column.heading,
        label: column.heading,
        alignment: 'start',
        canSort: true,
        canSearch: column.searchable,
        isHidden: false,
        seq: index + 1,
      },
    ]),
    ...(lov.columns.some((column) => column.name === lov.returned)
      ? []
      : [
          [
            lov.returned,
            {
              index: lov.columns.length,
              heading: lov.returned,
              canSearch: false,
              isHidden: true,
              hidden: true,
            },
          ],
        ]),
  ]);
  const initial = setting(renderer, item, 'initialFetch', 'auto');
  onload(
    ctx,
    `apex.widget.popupLov(${json({
      itemId: name,
      ajaxIdentifier: ajaxIdentifier(ctx, name),
      ...(cascading(item).parents ? { dependingOnSelector: cascading(item).parents } : {}),
      ...(cascading(item).submit ? { pageItemsToSubmit: cascading(item).submit } : {}),
      itemsToSubmit: [],
      nullValue: '',
      nullDisplayValue: '',
      initialFetch: initial === 'onUserRequest' ? 'none' : initial === 'autoCurrentValue' ? 'value' : 'empty',
      multiple,
      separator: separator(item),
      storageType: 'SEPARATED',
      enterable,
      display: lov.columns.length > 1 ? 'grid' : 'list',
      title: renderer.label(item),
      isPopup,
      width: num(item.props, 'settings.popupWidth', 0) || undefined,
      height: num(item.props, 'settings.popupHeight', 0) || undefined,
      incrementalSearch: true,
      minSearchChars: num(item.props, 'search.minChars', 0),
      columns,
      valueColumn: lov.returned,
      displayColumn: lov.display,
      recordTemplate: null,
      extraOut: {},
      persistState: true,
      defaultGridOptions: { columnSort: true },
    })});`,
    apexScript('widget.iconList'),
    apexScript('modelViewBase'),
    apexScript('widget.grid'),
  );
  const extras = elementExtras(renderer, ctx, item);
  const input = (inputValue: string) =>
    `<input${attrs({
      type: 'text',
      class: classes('apex-item-text apex-item-popup-lov', ...extras.classes),
      id: name,
      name: enterable ? name : `${name}_DISPLAY`,
      size: num(item.props, 'appearance.width', 30),
      value: inputValue,
      placeholder: placeholder(renderer, ctx, item) || undefined,
      required: required(item),
      'aria-labelledby': `${name}_LABEL`,
    })}${extras.attributes}>`;
  const hiddenValue = enterable
    ? ''
    : `<input type="hidden" name="${name}" id="${name}_HIDDENVALUE" value="${escapeHtml(value)}">`;
  const button = `<button type="button" class="a-Button a-Button--popupLOV" id="${name}_lov_btn" tabindex="-1" aria-hidden="true"><span class="a-Icon icon-popup-lov" aria-hidden="true"></span></button>`;
  if (multiple)
    return `<div class="apex-item-group apex-item-group--popup-lov" role="none"><ul class="apex-item-multi" role="none">${values
      .map(
        (entry, index) =>
          `<li class="apex-item-multi-item" data-value="${escapeHtml(entry)}">${escapeHtml(display[index] ?? entry)}</li>`,
      )
      .join('')}<li class="apex-item-multi-input">${input('')}</li></ul>${hiddenValue}${button}</div>`;
  return `<div class="apex-item-group apex-item-group--popup-lov" role="none">${input(enterable ? value : (display[0] ?? ''))}${hiddenValue}${button}</div>`;
};

function comboSelect(kind: 'combobox' | 'selectOne' | 'selectMany'): ItemRenderer {
  return (renderer, ctx, item, name, value) => {
    itemState.set(item, {});
    const multi =
      kind === 'selectMany' || (kind === 'combobox' && flag(renderer, item, 'multiSelection', false));
    const values = multi ? splitValues(item, value) : value ? [value] : [];
    const lov = lovRows(renderer, ctx, item);
    const entries = lov.rows.map((row) => ({ d: row[lov.display] ?? '', r: row[lov.returned] ?? '' }));
    if (isReadOnly(renderer, ctx, item))
      return readOnlyMarkup(item, name, value, displayFor(entries, values).join(', '));
    const tag = kind === 'combobox' ? 'a-combobox' : 'a-select';
    const manual = kind === 'combobox' && flag(renderer, item, 'manualEntry', true);
    const parents = cascading(item);
    const extras = elementExtras(renderer, ctx, item);
    state(item).wrapper = [
      kind === 'combobox' ? 'combobox' : kind === 'selectOne' ? 'select-one' : 'select-many',
      ...(kind === 'combobox' ? [multi ? 'combobox-many' : 'combobox-one'] : []),
    ];
    const extraColumns = lov.columns.filter((column) => column.name !== lov.display);
    const metadata = extraColumns
      .map(
        (column, index) =>
          `<a-column-metadata name="${escapeHtml(column.name)}" index="${index}" searchable="${column.searchable}"></a-column-metadata>`,
      )
      .join('');
    const optionsHtml = lov.rows
      .map(
        (row) =>
          `<a-option value="${escapeHtml(row[lov.returned] ?? '')}">${escapeHtml(row[lov.display] ?? '')}${extraColumns
            .map(
              (column) =>
                `<a-option-column-value>${escapeHtml(row[column.name] ?? '')}</a-option-column-value>`,
            )
            .join('')}</a-option>`,
      )
      .join('');
    return `<${tag}${attrs({
      id: name,
      name,
      class: extras.classes.join(' ') || undefined,
      value: multi ? values.join(separator(item)) : value,
      'display-values-as':
        setting(renderer, item, 'displayValuesAs') === 'commaSeparatedList' ? 'separated' : 'chips',
      'match-type': str(item.props, 'search.matchType') === 'startsWith' ? 'starts-with' : 'contains',
      'case-sensitive': bool(item.props, 'search.caseSensitive', false) ? 'true' : undefined,
      'min-characters-search': num(item.props, 'search.minChars', 0),
      'max-results': num(item.props, 'settings.maxValuesInList', 250),
      'multi-value': multi ? 'true' : undefined,
      'multi-select': multi ? 'true' : undefined,
      'multi-value-separator': separator(item),
      'multi-value-storage':
        str(item.props, 'multipleValues.type') === 'jsonArray' ? 'json-array' : 'separated',
      'return-display': kind !== 'combobox' || !manual ? 'true' : undefined,
      'manual-entries-item': undefined,
      'ajax-identifier': ajaxIdentifier(ctx, name),
      'parent-items': parents.parents || undefined,
      'parents-required': parents.parents && parents.required ? 'true' : undefined,
      'ajax-items': parents.submit || undefined,
      placeholder: placeholder(renderer, ctx, item) || undefined,
      required: required(item),
      'aria-labelledby': `${name}_LABEL`,
    })}${extras.attributes}>${metadata}${optionsHtml}</${tag}>`;
  };
}

const autoComplete: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, value);
  const entries = lovEntries(renderer, ctx, item).filter((entry) => entry.d !== '');
  const extras = elementExtras(renderer, ctx, item);
  ctx.jsFiles.add(apexScript('item.Autocomplete'));
  // The 26.2 field web components style their shadow DOM from this sheet.
  ctx.cssFiles.add('#APEX_FILES#app_ui/css/WebComponents.min.css?v=#APEX_VERSION#');
  state(item).wrapper = ['auto-complete'];
  return `<a-autocomplete${attrs({
    id: name,
    name,
    class: classes('apex-item-auto-complete', ...extras.classes),
    value,
    'match-type': str(item.props, 'search.matchType') === 'startsWith' ? 'starts-with' : 'contains',
    'max-results': num(item.props, 'settings.maxValuesInList', 7),
    'min-characters-search': num(item.props, 'search.minChars', 1),
    'highlight-choices': 'true',
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'aria-labelledby': `${name}_LABEL`,
  })}${extras.attributes}>${entries.map((entry) => `<a-option>${escapeHtml(entry.d)}</a-option>`).join('')}</a-autocomplete>`;
};

// ---------------------------------------------------------------- rich items

const starRating: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  const stars = Number(setting(renderer, item, 'noOfStars', '5')) || 5;
  const readOnly = isReadOnly(renderer, ctx, item);
  onload(
    ctx,
    `apex.widget.starRating(${json(name)},${json({
      numStars: stars,
      iconClass: iconClasses(setting(renderer, item, 'icon', 'fa-star')).replace(/^fa\s+/u, ''),
      tooltip: setting(renderer, item, 'tooltip', '#VALUE#'),
      clearTooltip: 'Clear',
      showClearButton: flag(renderer, item, 'showClearButton', true),
      isRequired: required(item),
      readOnly,
      readOnlyDisplay: setting(renderer, item, 'readOnlyDisplay', 'stars')
        .replace(/([A-Z])/gu, '_$1')
        .toUpperCase(),
      showValue: flag(renderer, item, 'showValue', false) ? 'STARS_AND_VALUE' : 'STARS',
      activeColor: setting(renderer, item, 'activeColor') || undefined,
      inactiveColor: setting(renderer, item, 'inactiveColor') || undefined,
    })});`,
    apexScript('widget.starRating'),
  );
  return `<div id="${name}" class="apex-item-starrating"><input type="text" id="${name}_INPUT" name="${name}" value="${escapeHtml(value)}" aria-labelledby="${name}_LABEL"${readOnly ? ' disabled' : ''}></div>`;
};

/** Universal Theme accent colors stand in for the theme-style preset of the color picker. */
const THEME_COLORS = [
  'var(--u-color-1)',
  'var(--u-color-2)',
  'var(--u-color-3)',
  'var(--u-color-4)',
  'var(--u-color-5)',
  'var(--u-color-6)',
  'var(--u-color-7)',
  'var(--u-color-8)',
];

const colorPicker: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  if (isReadOnly(renderer, ctx, item)) {
    Object.assign(state(item), { container: ['is-readonly'], wrapper: ['display-only'] });
    return `<span id="${name}_DISPLAY" class="display_only apex-item-display-only"><span aria-hidden="true" style="display:inline-block;inline-size:1em;block-size:1em;border-radius:50%;vertical-align:middle;background:${escapeHtml(value)}"></span> ${escapeHtml(value)}</span><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  const displayAs = setting(renderer, item, 'displayAs', 'popup');
  // Native defaults: colorPreset THEME_STYLE, mode FULL.
  const preset = setting(renderer, item, 'colorPreset', 'themeStyle');
  const presetColors =
    preset === 'custom'
      ? setting(renderer, item, 'colors')
          .split(/[,;:\s]+/u)
          .filter(Boolean)
          .join(',')
      : preset === 'themeStyle'
        ? THEME_COLORS.join(',')
        : '';
  ctx.jsFiles.add(apexScript('item.Colorpicker'));
  state(item).wrapper = [
    'color-picker',
    ...(displayAs === 'inline' ? ['color-picker-inline'] : []),
    ...(displayAs === 'nativeColorPicker' ? ['color-picker-native'] : []),
    ...(displayAs === 'colorOnlyPopup' ? ['color-picker-color-only'] : []),
  ];
  const extras = elementExtras(renderer, ctx, item);
  return `<a-color-picker${attrs({
    id: name,
    name,
    class: extras.classes.join(' ') || undefined,
    value,
    'display-as':
      displayAs === 'inline'
        ? 'INLINE'
        : displayAs === 'nativeColorPicker'
          ? 'NATIVE'
          : displayAs === 'colorOnlyPopup'
            ? 'COLOR_ONLY'
            : 'POPUP',
    'display-mode': setting(renderer, item, 'mode', 'full').toUpperCase(),
    'return-value-as': setting(renderer, item, 'returnValueAs', 'hex')
      .toUpperCase()
      .replace('ANYCSSVALUE', 'CSS'),
    'preset-colors': presetColors || undefined,
    'max-preset-colors': presetColors ? Math.min(presetColors.split(',').length, 8) : undefined,
    'contrast-color':
      setting(renderer, item, 'contrastWith') === 'staticColor'
        ? setting(renderer, item, 'contrastColor') || undefined
        : undefined,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'aria-labelledby': `${name}_LABEL`,
  })}${extras.attributes}></a-color-picker>`;
};

const RTE_TOOLS: [string, string, string][] = [
  ['bold', 'Bold', 'fa-bold'],
  ['italic', 'Italic', 'fa-italic'],
  ['underline', 'Underline', 'fa-underline'],
  ['strikeThrough', 'Strikethrough', 'fa-strikethrough'],
  ['insertUnorderedList', 'Bulleted List', 'fa-list-ul'],
  ['insertOrderedList', 'Numbered List', 'fa-list-ol'],
  ['createLink', 'Link', 'fa-link'],
  ['removeFormat', 'Clear Formatting', 'fa-eraser'],
];

/** TinyMCE is not part of the runtime subset, so the editor is an honest contenteditable stand-in. */
const richTextEditor: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  renderer.diagnose(
    'info',
    `Rich Text Editor ${name} uses a simple contenteditable editor locally (TinyMCE is not bundled)`,
    ctx.pageId,
    name,
  );
  const readOnly = isReadOnly(renderer, ctx, item);
  const html = value;
  if (readOnly) {
    Object.assign(state(item), { container: ['is-readonly'], wrapper: ['display-only'] });
    return `<div id="${name}_DISPLAY" class="display_only apex-item-display-only">${html}</div><input type="hidden" name="${name}" id="${name}" value="${escapeHtml(value)}">`;
  }
  // settings.toolbar: basic / intermediate (default) / full.
  const toolbar = setting(renderer, item, 'toolbar', 'intermediate');
  const tools =
    toolbar === 'none' ? [] : toolbar === 'basic' || toolbar === 'simple' ? RTE_TOOLS.slice(0, 6) : RTE_TOOLS;
  ctx.onload.push(`apexLocal.items.richText(${json(name)});`);
  const height = num(item.props, 'settings.height', num(item.props, 'appearance.height', 5) * 24 + 48);
  return `<div class="apex-item-group apex-item-group--rich-text-editor apex-local-rte" id="${name}_CONTAINER_RTE">${
    tools.length
      ? `<div class="apex-local-rte-toolbar" role="toolbar" aria-label="Formatting">${tools
          .map(
            ([command, title, glyph]) =>
              `<button type="button" class="a-Button a-Button--noLabel a-Button--withIcon a-Button--small" data-command="${command}" title="${title}" aria-label="${title}"><span class="fa ${glyph}" aria-hidden="true"></span></button>`,
          )
          .join('')}</div>`
      : ''
  }<div class="apex-local-rte-content" id="${name}_EDITOR" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${name}_LABEL" style="min-height:${height}px">${html}</div><textarea name="${name}" id="${name}" class="textarea apex-item-textarea u-vh" tabindex="-1" aria-hidden="true">${escapeHtml(value)}</textarea></div>`;
};

const markdownEditor: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  if (isReadOnly(renderer, ctx, item)) return readOnlyMarkup(item, name, value, value);
  const extras = elementExtras(renderer, ctx, item);
  ctx.jsFiles.add(`#APEX_FILES#libraries/markedjs/${libraryVersion(renderer, 'markedjs')}/marked.umd.js`);
  ctx.jsFiles.add(`#APEX_FILES#libraries/purify/${libraryVersion(renderer, 'purify')}/purify.min.js`);
  onload(
    ctx,
    `apex.widget.markdown(${json(`#${name}`)},${json({
      toolbar: setting(renderer, item, 'toolbar', 'simple').toUpperCase(),
      toolbarStyle: 'OVERFLOW',
      previewEnabled: true,
      syntaxHighlighting: false,
      escapeInputHtml: 'ESCAPE',
      previewEmptyMessage: '"Nothing to preview"',
    })});`,
    apexScript('widget.toolbar'),
    apexScript('widget.markdownEditor'),
  );
  return `<div class="apex-item-group apex-item-group--textarea"><textarea${attrs({
    name,
    rows: num(item.props, 'appearance.height', 8),
    cols: num(item.props, 'appearance.width', 30),
    id: name,
    class: classes('textarea apex-item-textarea', ...extras.classes),
    maxlength: num(item.props, 'validation.maxLength', 0) || undefined,
    placeholder: placeholder(renderer, ctx, item) || undefined,
    required: required(item),
    'data-markdown': 'true',
  })}${extras.attributes}>${escapeHtml(value)}</textarea></div>`;
};

const FILE_DISPLAY: Record<string, string> = {
  inlineFileBrowse: 'INLINE',
  inlineDropzone: 'DROPZONE_INLINE',
  blockDropzone: 'DROPZONE_BLOCK',
  iconDropzone: 'DROPZONE_ICON',
  nativeFileBrowse: 'NATIVE',
};

/** Attributes describing the item's current file (file name, size, preview link); see extensions/files.ts. */
export type FileAttributes = (
  renderer: ApexRenderer,
  ctx: RenderContext,
  item: ApxComponent,
  value: string,
) => Record<string, string | undefined>;
let fileAttributes: FileAttributes = (_renderer, _ctx, _item, value) => ({ filename: value || undefined });
export function setFileAttributes(attributes: FileAttributes): void {
  fileAttributes = attributes;
}

function fileUpload(kind: 'file' | 'image'): ItemRenderer {
  return (renderer, ctx, item, name, value) => {
    itemState.set(item, {});
    const readOnly = isReadOnly(renderer, ctx, item);
    // Defaults per the native item types: File Upload INLINE, Image Upload DROPZONE_ICON.
    const displayAs = str(
      item.props,
      'display.displayAs',
      kind === 'image' ? 'iconDropzone' : 'inlineFileBrowse',
    );
    ctx.jsFiles.add(apexScript('item.FileUpload'));
    state(item).wrapper = kind === 'image' ? ['image-upload'] : ['file'];
    const extras = elementExtras(renderer, ctx, item);
    return `<a-file-upload${attrs({
      id: name,
      name,
      class: extras.classes.join(' ') || undefined,
      'display-style': FILE_DISPLAY[displayAs] ?? (kind === 'image' ? 'DROPZONE_ICON' : 'INLINE'),
      'upload-type': kind === 'image' ? 'IMAGE' : 'FILE',
      label: str(item.props, 'display.dropzoneTitle') || undefined,
      description: str(item.props, 'display.dropzoneDesc') || undefined,
      accept: str(item.props, 'storage.fileTypes') || (kind === 'image' ? 'image/*' : undefined),
      multiple: bool(item.props, 'storage.allowMultipleFiles', false),
      'max-file-size': num(item.props, 'storage.maxFileSize', 0) || undefined,
      'allow-crop': bool(item.props, 'cropping.allowCropping', false) ? 'true' : undefined,
      'show-preview': kind === 'image' ? 'true' : undefined,
      ...fileAttributes(renderer, ctx, item, value),
      readonly: readOnly,
      required: required(item),
      'aria-labelledby': `${name}_LABEL`,
    })}${extras.attributes}><input type="file" id="${name}_input" name="${name}" class="apex-item-file u-vh"></a-file-upload>`;
  };
}

const QR_PREFIX: Record<string, string> = {
  email: 'mailto:',
  phone: 'tel:',
  sms: 'sms:',
  geoLocation: 'geo:',
};
const QR_SIZE: Record<string, number> = { small: 128, medium: 192, large: 256 };

export function qrPayload(item: ApxComponent, value: string): string {
  const prefix = QR_PREFIX[str(item.props, 'qrCode.dataType')] ?? '';
  return prefix && value && !value.toLowerCase().startsWith(prefix) ? prefix + value : value;
}

export function qrMarkup(
  item: ApxComponent,
  value: string,
  foreground?: string,
  background?: string,
): string {
  if (!value) return '';
  try {
    return qrSvg(qrPayload(item, value), {
      size: QR_SIZE[str(item.props, 'qrCode.size', 'medium')] ?? 192,
      ...(foreground ? { foreground } : {}),
      ...(background ? { background } : {}),
    });
  } catch {
    return '';
  }
}

const qrCode: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  ctx.jsFiles.add(apexScript('item.QRcode'));
  state(item).wrapper = ['qrcode'];
  return `<a-qrcode${attrs({
    id: name,
    class: 'apex-item-qrcode',
    'ajax-identifier': ajaxIdentifier(ctx, name),
    value,
    'aria-labelledby': `${name}_LABEL`,
  })}>${qrMarkup(item, value)}</a-qrcode>`;
};

const percentGraph: ItemRenderer = (renderer, ctx, item, name, value) => {
  itemState.set(item, {});
  ctx.jsFiles.add(apexScript('widget.pctGraph'));
  state(item).wrapper = ['pct-graph'];
  return `<div${attrs({
    class: 'apex-item-pct-graph',
    id: name,
    'data-show-value': flag(renderer, item, 'showValue', true) ? 'true' : 'false',
    'data-bg-color': setting(renderer, item, 'backgroundColor') || undefined,
    'data-fg-color': setting(renderer, item, 'foregroundColor') || undefined,
    'data-text-color': setting(renderer, item, 'textColor') || undefined,
    'data-width': setting(renderer, item, 'barWidth') || undefined,
    'data-label-id': `${name}_LABEL`,
  })}>${escapeHtml(value === '' ? '0' : String(Number(value) || 0))}</div>`;
};

const unsupported =
  (label: string): ItemRenderer =>
  (renderer, ctx, item, name, value) => {
    itemState.set(item, {});
    renderer.diagnose(
      'info',
      `${label} item ${name} is shown read-only in the local preview`,
      ctx.pageId,
      name,
    );
    return readOnlyMarkup(item, name, value, value);
  };

export const ITEM_RENDERERS: Record<string, ItemRenderer> = {
  textField,
  numberField,
  password,
  textarea,
  hidden,
  displayOnly,
  datePicker,
  datePickerApex: datePicker,
  selectList,
  radioGroup: group('radio'),
  checkboxGroup: group('checkbox'),
  checkbox,
  switch: switchItem,
  shuttle,
  popupLov,
  combobox: comboSelect('combobox'),
  selectOne: comboSelect('selectOne'),
  selectMany: comboSelect('selectMany'),
  textFieldWithAutocomplete: autoComplete,
  autoComplete,
  starRating,
  colorPicker,
  richTextEditor,
  markdownEditor,
  fileUpload: fileUpload('file'),
  fileBrowse: fileUpload('file'),
  imageUpload: fileUpload('image'),
  qrCode,
  percentGraph,
  displayImage: unsupported('Display Image'),
  displayMap: unsupported('Display Map'),
  geocodedAddress: unsupported('Geocoded Address'),
  listManager: unsupported('List Manager'),
};

/** Label targets that differ from the item name. */
const LABEL_FOR: Record<string, (name: string) => string> = {
  datePicker: (name) => `${name}_input`,
  starRating: (name) => `${name}_INPUT`,
  shuttle: (name) => `${name}_LEFT`,
};

/** Container classes, pre/post text, template options and inline help as the 26.2 templates expect. */
export const itemTemplate: ItemTemplateHook = (renderer, ctx, item, values) => {
  const type = str(item.props, 'type', 'textField');
  const name = item.id.toUpperCase();
  const entry = itemState.get(item);
  const tokens = (values.ITEM_CSS_CLASSES ?? '').split(/\s+/u).filter(Boolean);
  const wrapperIndex = tokens.findIndex((token) => token.startsWith('apex-item-wrapper--'));
  if (entry?.wrapper?.length && wrapperIndex >= 0) {
    const base = entry.wrapper.filter((modifier) => modifier !== 'has-icon');
    const replacement = (
      base.length ? base : [tokens[wrapperIndex]!.slice('apex-item-wrapper--'.length)]
    ).map((modifier) => `apex-item-wrapper--${modifier}`);
    if (entry.wrapper.includes('has-icon')) replacement.push('apex-item-wrapper--has-icon');
    tokens.splice(wrapperIndex, 1, ...replacement);
  }
  const field = renderer.theme.fields.get(
    (str(item.props, 'appearance.template') || '').replace(/^\//u, '').toLowerCase(),
  );
  const optionsList = strings(get(item.props, 'appearance.templateOptions'));
  const options = optionsList.length
    ? templateOptions(
        optionsList.flatMap((option) => (option === '#DEFAULT#' ? [option] : option.split(/\s+/u))),
        text(field, 'default_template_options'),
      )
    : '';
  const containerClasses = strings(get(item.props, 'appearance.cssClasses'));
  const value = ctx.session.items[name] ?? '';
  tokens.push(
    ...options.split(/\s+/u).filter(Boolean),
    ...containerClasses,
    ...(entry?.container ?? []),
    ...(placeholder(renderer, ctx, item) ? ['apex-item-wrapper--has-placeholder'] : []),
    ...(value !== '' && type !== 'checkbox' ? ['apex-item-wrapper--has-initial-value'] : []),
  );
  values.ITEM_CSS_CLASSES = [...new Set(tokens)].join(' ');
  const pre = str(item.props, 'advanced.preText', str(item.props, 'appearance.preTextHtml'));
  const post = str(item.props, 'advanced.postText', str(item.props, 'appearance.postTextHtml'));
  if (pre) values.CURRENT_ITEM_PRE_TEXT = renderer.substitute(ctx.session, pre, ctx.page, 'HTML');
  if (post) values.CURRENT_ITEM_POST_TEXT = renderer.substitute(ctx.session, post, ctx.page, 'HTML');
  const inline = str(item.props, 'help.inlineHelpText');
  if (inline)
    values.CURRENT_ITEM_INLINE_HELP_TEXT = renderer.substitute(ctx.session, inline, ctx.page, 'HTML');
  const target = LABEL_FOR[type];
  if (target) values.LABEL_OPEN = `label for="${target(name)}"`;
};
