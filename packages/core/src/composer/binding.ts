import { Fault } from '../result.ts';
import type { Blueprint, Entity, Instance } from './schemas.ts';

export interface MetadataSnapshot {
  schema: string;
  objects: Record<
    string,
    {
      columns: Record<string, unknown>[];
      constraints: Record<string, unknown>[];
      constraintColumns: Record<string, unknown>[];
    }
  >;
  signatures: Record<string, Record<string, unknown>[]>;
}
export function keyFields(entity: Entity) {
  return entity.read.key.map((key) => {
    const entries = Object.entries(entity.read.fields).filter(
      ([name, field]) => name === key || field.column === key,
    );
    if (entries.length > 1)
      throw new Fault('KEY_MAPPING_AMBIGUOUS', 'A key part must identify exactly one projected field.', 5);
    const entry = entries[0];
    if (!entry) throw new Fault('KEY_MAPPING_MISSING', 'Every key part must map to a projected field.', 5);
    return entry[0];
  });
}
const unsafeSql = () =>
  new Fault('CONTRACT_SQL_UNSAFE', 'Row predicates accept reviewed expressions only.', 5);
const untrustedContext = () =>
  new Fault('AUTH_CONTEXT_UNTRUSTED', 'Row access may only use server-owned APEX session bindings.', 5);
const serverBinds = new Set(['APP_USER', 'APP_ID', 'APP_SESSION']);
// Conservative allowlist: unquoted identifiers, numeric/string literals, comparison and
// logical operators, parentheses, server-owned APEX binds and side-effect-free functions.
const safeFunctions = new Set([
  'UPPER',
  'LOWER',
  'TRIM',
  'TRUNC',
  'NVL',
  'COALESCE',
  'LENGTH',
  'SUBSTR',
  'INSTR',
  'TO_CHAR',
  'TO_NUMBER',
  'TO_DATE',
  'APEX_AUTHORIZATION.IS_AUTHORIZED',
]);
const groupingWords = new Set(['AND', 'OR', 'NOT', 'IN']);
const deniedWords =
  /^(?:SELECT|WITH|COMMIT|ROLLBACK|SAVEPOINT|GRANT|REVOKE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXECUTE|IMMEDIATE|HOST|CONNECT|BEGIN|DECLARE|CALL|LOCK)$/;
const deniedOwners = /^(?:DBMS_|UTL_|WWV_|OWA_|APEX_(?!AUTHORIZATION$)|(?:OWA|HTP|HTF|SYS)$)/;
const tokens = {
  space: /[ \t]+/y,
  string: /'(?:[^']|'')*'/y,
  number: /\d+(?:\.\d+)?/y,
  bind: /:([A-Za-z][A-Za-z0-9_]*)/y,
  name: /[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){0,2}/y,
  operator: /<>|!=|\^=|<=|>=|=|<|>|\(|\)|,|\+|-|\*|\//y,
};
function match(pattern: RegExp, value: string, at: number) {
  pattern.lastIndex = at;
  return pattern.exec(value);
}
/** Accepts only a reviewed, allowlisted SQL boolean expression; never statements or session reads. */
export function expression(value: string) {
  if (!value.trim() || value.length > 4000) throw unsafeSql();
  if (/:\s*"/.test(value)) throw untrustedContext();
  if (/[\x00-\x08\x0a-\x1f\x7f;`&#$"@{}\[\]|]|--|\/\*|\*\//.test(value)) throw unsafeSql();
  let at = 0,
    depth = 0;
  while (at < value.length) {
    let found: RegExpExecArray | null;
    if ((found = match(tokens.space, value, at))) at += found[0].length;
    else if ((found = match(tokens.string, value, at))) at += found[0].length;
    else if ((found = match(tokens.bind, value, at))) {
      if (!serverBinds.has(found[1]!.toUpperCase())) throw untrustedContext();
      at += found[0].length;
    } else if ((found = match(tokens.name, value, at))) {
      const name = found[0].toUpperCase(),
        parts = name.split('.');
      at += found[0].length;
      if (parts.some((part) => deniedWords.test(part)) || deniedOwners.test(parts[0]!)) {
        if (!safeFunctions.has(name)) throw unsafeSql();
      }
      // q'..', n'..' and similar prefixed literals are not part of the reviewed dialect.
      if (value[at] === "'") throw unsafeSql();
      const next = value.slice(at).match(/^[ \t]*(.)/)?.[1];
      if (next === '(' && !safeFunctions.has(name) && !groupingWords.has(name)) throw unsafeSql();
      if (next !== '(' && safeFunctions.has(name) && name.includes('.')) throw unsafeSql();
    } else if ((found = match(tokens.number, value, at))) at += found[0].length;
    else if ((found = match(tokens.operator, value, at))) {
      if (found[0] === '(') depth++;
      if (found[0] === ')' && --depth < 0) throw unsafeSql();
      at += found[0].length;
    } else if (value[at] === ':') throw untrustedContext();
    else throw unsafeSql();
  }
  if (depth !== 0) throw unsafeSql();
  return value;
}
/** Oracle dictionary names: unquoted identifiers are case-insensitive, quoted ones exact. */
export function oracleName(value: unknown) {
  const text = String(value ?? '');
  return /^".*"$/.test(text) ? text.slice(1, -1) : text.toUpperCase();
}
const sameName = (a: unknown, b: unknown) => oracleName(a) === oracleName(b);
/** ALL_TAB_COLUMNS reports precision inside DATA_TYPE, for example TIMESTAMP(6) WITH TIME ZONE. */
export function oracleType(value: unknown) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/\(\s*\d+(?:\s*,\s*\d+)?\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const entry = <T>(record: Record<string, T>, name: string) =>
  Object.entries(record).find(([key]) => sameName(key, name))?.[1];
export function bind(blueprint: Blueprint, instance: Instance, metadata?: MetadataSnapshot) {
  const ref = instance.bindings.records;
  if (!ref.startsWith('entity:'))
    throw new Fault('BINDING_MISSING', 'Expected an explicit entity binding.', 5);
  const entity = blueprint.entities[ref.slice(7)];
  if (!entity) throw new Fault('BINDING_MISSING', 'Entity binding is absent.', 5);
  if (!Object.keys(entity.read.fields).length || Object.keys(entity.read.fields).length > 32)
    throw new Fault('CONTRACT_FIELD_LIMIT', 'Entities support 1–32 scalar fields.', 5);
  const fieldNames = Object.keys(entity.read.fields);
  if (
    fieldNames.some((field) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field)) ||
    new Set(fieldNames.map((field) => field.toUpperCase())).size !== fieldNames.length
  )
    throw new Fault(
      'FIELD_SYMBOL_COLLISION',
      'Field names must form unique case-insensitive APEX item suffixes.',
      5,
    );
  const keys = keyFields(entity),
    auth = blueprint.contracts[entity.authorization.readContract];
  if (new Set(keys).size !== keys.length)
    throw new Fault('KEY_MAPPING_DUPLICATE', 'Each ordered key part must occur once.', 5);
  if (!auth || auth.kind !== 'authorization' || !auth.rowPredicate)
    throw new Fault('AUTH_CONTRACT_MISSING', 'A reviewed server row-read contract is required.', 5);
  const predicate = expression(auth.rowPredicate);
  if (entity.read.kind === 'oracle-view') {
    const key = blueprint.contracts[entity.read.keyContract ?? ''];
    if (!key || key.kind !== 'key' || JSON.stringify(key.fields) !== JSON.stringify(keys))
      throw new Fault('KEY_CONTRACT_MISSING', 'Views require an explicit ordered key contract.', 5);
  }
  if (
    new Set(Object.values(entity.read.fields).map((f) => f.column.toUpperCase())).size !==
    Object.keys(entity.read.fields).length
  )
    throw new Fault('COLUMN_COLLISION', 'Projected field mappings must be unique.', 5);
  for (const name of [
    ...instance.parameters.editableFields,
    instance.parameters.groupField,
    instance.parameters.filterField,
    instance.parameters.detailField,
    instance.parameters.timeField,
    instance.parameters.parentField,
  ].filter(Boolean))
    if (!entity.read.fields[name!])
      throw new Fault('FIELD_MAPPING_MISSING', 'A selected field is not in the entity contract.', 5);
  const writable = instance.parameters.createEnabled || instance.parameters.editEnabled;
  let command: Blueprint['commands'][string] | undefined;
  let writeExpression: string | undefined;
  if (writable) {
    if (keys.length !== 1)
      throw new Fault('COMPOSITE_WRITE_UNSUPPORTED', 'Write CRUD requires one scalar key.', 5);
    const version = entity.capabilities.optimisticLock?.field;
    if (
      !version ||
      entity.read.fields[version]?.type !== 'integer' ||
      !entity.read.fields[version] ||
      entity.read.fields[version]!.nullable ||
      entity.read.fields[keys[0]!]!.nullable
    )
      throw new Fault('OPTIMISTIC_LOCK_MISSING', 'Persisted key/version fields must be non-null.', 5);
    if (instance.parameters.editableFields.some((field) => keys.includes(field) || field === version))
      throw new Fault('MASS_ASSIGNMENT_DENIED', 'Key and row version are server managed.', 5);
    if (
      !['string', 'integer', 'decimal'].includes(entity.read.fields[keys[0]!]!.type) ||
      instance.parameters.editableFields.some((f) => entity.read.fields[f]!.type === 'boolean')
    )
      throw new Fault(
        'WRITE_TYPE_UNSUPPORTED',
        'This write adapter supports text/numeric keys and scalar text/number/date/timestamp fields.',
        5,
      );
    const ref = instance.bindings.saveRecord;
    command = ref?.startsWith('command:') ? blueprint.commands[ref.slice(8)] : undefined;
    if (!command)
      throw new Fault('COMMAND_BINDING_MISSING', 'Write mode requires an explicit API command.', 5);
    const signature = blueprint.contracts[command.signatureRef],
      writeAuth = blueprint.contracts[command.authorizationContract],
      errors = blueprint.contracts[command.errorContract];
    if (
      !signature ||
      signature.kind !== 'command' ||
      signature.transaction !== 'caller-owned' ||
      !signature.parameters ||
      !writeAuth ||
      writeAuth.kind !== 'authorization' ||
      !errors ||
      errors.kind !== 'errors' ||
      command.authorizationContract !== entity.authorization.writeContract
    )
      throw new Fault(
        'COMMAND_CONTRACT_MISSING',
        'Write mode requires exact reviewed signature, authorization and error contracts.',
        5,
      );
    if (!writeAuth.expression)
      throw new Fault(
        'AUTH_CONTRACT_MISSING',
        'Write authorization requires a reviewed server expression.',
        5,
      );
    writeExpression = expression(writeAuth.expression);
    if (command.outputs.recordKey.from === command.outputs.recordVersion.from)
      throw new Fault(
        'COMMAND_ARGUMENT_MISMATCH',
        'Record key and version require distinct API output arguments.',
        5,
      );
    const supplied = new Set([
      ...Object.keys(command.inputs),
      ...Object.values(command.outputs).map((o) => o.from),
    ]);
    if (
      Object.keys(signature.parameters).some((p) => !supplied.has(p)) ||
      [...supplied].some((p) => !signature.parameters![p])
    )
      throw new Fault('COMMAND_ARGUMENT_MISMATCH', 'Every exact signature argument must be mapped.', 5);
    const types = (field: string) => {
      const type = entity.read.fields[field]?.type;
      return type === 'integer' || type === 'decimal'
        ? ['NUMBER', 'PLS_INTEGER', 'BINARY_INTEGER']
        : type === 'date'
          ? ['DATE']
          : type === 'timestamp'
            ? ['TIMESTAMP']
            : ['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'];
    };
    for (const [argument, mapping] of Object.entries(command.inputs)) {
      const field = mapping.from.replace(/^record\./, '');
      if (mapping.mode === 'in-out' && field !== keys[0])
        throw new Fault(
          'COMMAND_ARGUMENT_MISMATCH',
          'Only the record key supports IN OUT in this adapter.',
          5,
        );
      if (!types(field).includes(signature.parameters[argument]?.type ?? ''))
        throw new Fault(
          'COMMAND_ARGUMENT_MISMATCH',
          'API argument scalar datatype differs from the field contract.',
          5,
        );
      if (
        !mapping.from.startsWith('record.') ||
        !entity.read.fields[field] ||
        signature.parameters[argument]?.mode !== mapping.mode
      )
        throw new Fault(
          'COMMAND_ARGUMENT_MISMATCH',
          'API argument mode or field mapping does not match its contract.',
          5,
        );
      if (!keys.includes(field) && field !== version && !instance.parameters.editableFields.includes(field))
        throw new Fault(
          'COMMAND_INPUT_UNAVAILABLE',
          'API inputs must map to an editable field or the managed record key/version.',
          5,
        );
    }
    if (
      !types(keys[0]!).includes(signature.parameters[command.outputs.recordKey.from]?.type ?? '') ||
      !types(version).includes(signature.parameters[command.outputs.recordVersion.from]?.type ?? '')
    )
      throw new Fault('COMMAND_ARGUMENT_MISMATCH', 'Key/version output datatypes differ from the entity.', 5);
    if (!Object.values(command.inputs).some((m) => m.from === 'record.' + version && m.mode === 'in'))
      throw new Fault('OPTIMISTIC_LOCK_MISSING', 'Expected version must be passed explicitly to the API.', 5);
    for (const output of Object.values(command.outputs))
      if (!['out', 'in-out'].includes(signature.parameters[output.from]?.mode ?? ''))
        throw new Fault('COMMAND_ARGUMENT_MISMATCH', 'API key/version outputs must be OUT or IN OUT.', 5);
    if (metadata) {
      const rows =
        entry(metadata.signatures, command.package)?.filter((row) =>
          sameName(row.OBJECT_NAME, command!.procedure),
        ) ?? [];
      const overloads = new Set(rows.map((row) => String(row.OVERLOAD ?? row.SUBPROGRAM_ID ?? '')));
      if (overloads.size !== 1 && !signature.overload)
        throw new Fault('COMMAND_OVERLOAD_AMBIGUOUS', 'An exact reviewed API overload is required.', 5);
      const selected = rows.filter(
        (row) => !signature.overload || String(row.OVERLOAD ?? '') === signature.overload,
      );
      if (
        new Set(selected.map((row) => String(row.SUBPROGRAM_ID))).size !== 1 ||
        selected.length !== Object.keys(signature.parameters).length ||
        selected.some((row) => Number(row.DATA_LEVEL ?? 0) !== 0 || Number(row.POSITION) === 0)
      )
        throw new Fault(
          'COMMAND_ARGUMENT_MISMATCH',
          'The complete live scalar procedure signature must match the reviewed contract.',
          5,
        );
      for (const [argument, spec] of Object.entries(signature.parameters)) {
        const row = selected.find(
          (r) =>
            sameName(r.ARGUMENT_NAME, argument) &&
            (!signature.overload || String(r.OVERLOAD ?? '') === signature.overload),
        );
        if (
          !row ||
          String(row.IN_OUT)
            .toLowerCase()
            .replace(/\s*\/\s*|\s+/g, '-') !== spec.mode ||
          oracleType(row.DATA_TYPE) !== spec.type ||
          (row.DEFAULTED === 'Y') !== spec.defaulted
        )
          throw new Fault(
            'COMMAND_ARGUMENT_MISMATCH',
            'Live API signature differs from its reviewed contract.',
            5,
          );
      }
    }
  }
  if (metadata) {
    const object = entry(metadata.objects, entity.read.object);
    if (!object) throw new Fault('OBJECT_BINDING_MISSING', 'The selected Oracle object was not verified.', 5);
    for (const field of Object.values(entity.read.fields)) {
      const column = object.columns.find((row) => sameName(row.COLUMN_NAME, field.column));
      if (!column || (column.NULLABLE === 'Y' && !field.nullable))
        throw new Fault('COLUMN_CONTRACT_MISMATCH', 'Live field nullability or column mapping differs.', 5);
      const expected = ['integer', 'decimal'].includes(field.type)
        ? ['NUMBER', 'FLOAT']
        : field.type === 'date'
          ? ['DATE']
          : field.type === 'timestamp'
            ? ['TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITH LOCAL TIME ZONE']
            : ['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'];
      if (!expected.includes(oracleType(column.DATA_TYPE)))
        throw new Fault('COLUMN_TYPE_UNSUPPORTED', 'Live datatype needs an explicit supported adapter.', 5);
      if (field.maxLength && Number(column.CHAR_LENGTH ?? column.DATA_LENGTH) > field.maxLength)
        throw new Fault('COLUMN_CONTRACT_MISMATCH', 'Producer length exceeds consumer capacity.', 5);
      if (
        (field.precision !== undefined &&
          (column.DATA_PRECISION == null || Number(column.DATA_PRECISION) > field.precision)) ||
        (field.scale !== undefined && Number(column.DATA_SCALE) !== field.scale)
      )
        throw new Fault(
          'COLUMN_CONTRACT_MISMATCH',
          'Live numeric precision or scale differs from the field contract.',
          5,
        );
    }
    if (entity.read.kind === 'oracle-table') {
      const primary = object.constraints.find(
        (row) => row.CONSTRAINT_TYPE === 'P' && row.STATUS === 'ENABLED' && row.VALIDATED === 'VALIDATED',
      );
      const columns = object.constraintColumns
        .filter((row) => row.CONSTRAINT_NAME === primary?.CONSTRAINT_NAME)
        .sort((a, b) => Number(a.POSITION) - Number(b.POSITION))
        .map((row) => oracleName(row.COLUMN_NAME));
      if (
        !primary ||
        JSON.stringify(columns) !== JSON.stringify(keys.map((k) => oracleName(entity.read.fields[k]!.column)))
      )
        throw new Fault(
          'PRIMARY_KEY_MISMATCH',
          'Live enabled/validated primary key differs from the contract.',
          5,
        );
    }
  }
  return { entity, keys, predicate, command, writable, entityRef: ref, writeExpression };
}
