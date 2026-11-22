import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  declarations,
  editSpans
} from "./chunk-TDM3E2NK.mjs";
import {
  get,
  parseApexLang
} from "./chunk-MJESXBPA.mjs";
import {
  resourceRoot,
  sourceRelease
} from "./chunk-QHMPNNGG.mjs";
import "./chunk-6H3NFORN.mjs";
import "./chunk-MPKKOQVI.mjs";
import "./chunk-33BV6A47.mjs";
import {
  environment,
  parse
} from "./chunk-LIG5PZ4K.mjs";
import {
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  inventory,
  readJson,
  withLock,
  writeJson
} from "./chunk-26MTCOZK.mjs";
import {
  Fault,
  external_exports
} from "./chunk-CI5IU2PI.mjs";

// packages/core/src/scaffold.ts
import path2 from "node:path";
import { readFile as readFile2 } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// packages/core/src/scaffold-observations.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
async function scaffoldObservationsSql(env, pages) {
  const literal2 = (value) => {
    if (/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(value))
      throw new Fault("INVALID_INPUT", "Observation target fields must be single-line values.", 2);
    return "'" + value.replaceAll("'", "''") + "'";
  };
  if (!Number.isSafeInteger(env.applicationId) || env.applicationId < 1 || !pages.length || pages.some((id2) => !Number.isInteger(id2) || id2 < 1 || id2 > 9998))
    throw new Fault("INVALID_INPUT", "Observation pages must be explicit scaffold page IDs.", 2);
  const values = {
    APP: String(env.applicationId),
    PAGES: pages.join(","),
    DB: literal2(env.databaseIdentity.dbUniqueName),
    SERVICE: literal2(env.databaseIdentity.serviceName),
    SCHEMA: literal2(env.parsingSchema),
    WORKSPACE: literal2(env.workspace)
  };
  const template = await readFile(path.join(resourceRoot(), "scaffold/observations.sql"), "utf8");
  return template.replace(/__([A-Z_]+)__/g, (_all, key) => {
    const value = values[key];
    if (value === void 0)
      throw new Fault("SCAFFOLD_TEMPLATE_INVALID", "Unknown observation template field.", 3);
    return value;
  });
}

// packages/core/src/scaffold-spec.ts
var text = external_exports.string().trim().min(1).max(240).regex(/^[^\x00-\x1f\x7f]+$/);
var id = external_exports.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,127}$/);
var item = external_exports.string().regex(/^P\d+_[A-Z][A-Z0-9_]{0,100}$/);
var column = external_exports.string().regex(/^[A-Z][A-Z0-9_$#]{0,127}$/);
var literal = external_exports.string().max(4e3).regex(/^[^\x00-\x1f\x7f]*$/);
var code = external_exports.string().trim().min(1).max(64e3).refine(
  (v) => !v.includes("```") && !/[\x00\r]/.test(v),
  "Code cannot contain APEXlang fence delimiters or control characters"
);
var sql = code.refine((v) => /^(select|with)\b/i.test(v), "Supply a SELECT query");
var scaffoldTarget = external_exports.strictObject({
  page: external_exports.number().int().min(1).max(9999),
  items: external_exports.record(item, literal).optional(),
  clearCache: external_exports.array(external_exports.number().int().min(1).max(9999)).max(30).optional()
});
var condition = external_exports.discriminatedUnion("type", [
  external_exports.strictObject({ type: external_exports.enum(["always", "never", "userIsAuthenticated", "userIsPublicUser"]) }),
  external_exports.strictObject({ type: external_exports.enum(["itemIsNull", "itemIsNotNull"]), item }),
  external_exports.strictObject({ type: external_exports.enum(["item=value", "item!=value"]), item, value: literal }),
  external_exports.strictObject({ type: external_exports.enum(["request=Value", "request!=Value"]), value: literal }),
  external_exports.strictObject({ type: external_exports.literal("expression"), plsqlExpression: code })
]);
var guards = {
  condition: condition.optional(),
  authorizationScheme: id.optional(),
  buildOption: id.optional()
};
var query = { sql, itemsToSubmit: external_exports.array(item).max(100).optional() };
var region = { id: id.optional(), name: text, ...guards };
var reportColumn = external_exports.strictObject({
  name: column,
  heading: text,
  dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]),
  formatMask: text.optional(),
  link: scaffoldTarget.optional(),
  linkText: literal.optional()
});
var regions = external_exports.discriminatedUnion("type", [
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.enum(["interactiveReport", "classicReport"]),
    columns: external_exports.array(reportColumn).min(1).max(100),
    emptyMessage: text.optional(),
    link: scaffoldTarget.optional()
  }),
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.literal("cards"),
    titleColumn: column,
    bodyColumn: column,
    keyColumn: column.optional(),
    link: scaffoldTarget.optional()
  }),
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.literal("barChart"),
    labelColumn: column,
    valueColumn: column,
    xTitle: text,
    yTitle: text
  }),
  external_exports.strictObject({
    ...region,
    type: external_exports.literal("chart"),
    chartType: external_exports.enum(["bar", "line", "pie", "donut"]),
    series: external_exports.array(
      external_exports.strictObject({
        ...query,
        id: id.optional(),
        name: text,
        labelColumn: column,
        valueColumn: column,
        link: scaffoldTarget.optional()
      })
    ).min(1).max(12),
    xTitle: text.optional(),
    yTitle: text.optional()
  }),
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.literal("calendar"),
    displayColumn: column,
    startDateColumn: column,
    endDateColumn: column.optional(),
    keyColumn: column.optional(),
    showTime: external_exports.boolean().optional(),
    initialDate: external_exports.iso.date().optional(),
    link: scaffoldTarget.optional()
  }),
  external_exports.strictObject({ ...region, ...query, type: external_exports.literal("form") }),
  external_exports.strictObject({ ...region, type: external_exports.literal("staticContent"), html: code.optional() })
]);
var processFields = {
  id,
  plsql: code,
  point: external_exports.enum(["beforeHeader", "afterSubmit", "processing", "ajaxCallback"]).optional(),
  sequence: external_exports.number().int().min(1).max(9999).optional(),
  ...guards,
  successMessage: text.optional()
};
var pageProcess = external_exports.strictObject({ ...processFields, button: id.optional() });
var scaffoldSchema = external_exports.strictObject({
  applicationName: text.optional(),
  applicationProcesses: external_exports.array(external_exports.strictObject(processFields).omit({ successMessage: true })).max(100).optional(),
  pages: external_exports.array(
    external_exports.strictObject({
      id: external_exports.number().int().min(1).max(9998),
      name: text,
      alias: id.optional(),
      navigation: external_exports.boolean().optional(),
      ...guards,
      regions: external_exports.array(regions).min(1).max(30),
      items: external_exports.array(
        external_exports.strictObject({
          name: item,
          type: external_exports.enum([
            "selectList",
            "datePicker",
            "numberField",
            "textField",
            "textarea",
            "hidden",
            "displayOnly"
          ]),
          region: id,
          label: text.optional(),
          required: external_exports.boolean().optional(),
          defaultValue: literal.optional(),
          formatMask: text.optional(),
          sourceColumn: column.optional(),
          dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]).optional(),
          primaryKey: external_exports.boolean().optional(),
          lov: external_exports.union([
            external_exports.array(external_exports.strictObject({ label: text, value: literal })).min(1).max(100),
            external_exports.strictObject({ sql })
          ]).optional(),
          ...guards
        })
      ).max(100).optional(),
      buttons: external_exports.array(
        external_exports.strictObject({
          id,
          label: text,
          region: id,
          action: external_exports.enum(["submitPage", "redirectToPage"]).optional(),
          target: scaffoldTarget.optional(),
          confirmation: external_exports.strictObject({
            message: text,
            style: external_exports.enum(["information", "warning", "danger"]).optional()
          }).optional(),
          ...guards
        })
      ).max(100).optional(),
      processes: external_exports.array(pageProcess).max(100).optional(),
      validations: external_exports.array(
        external_exports.strictObject({
          id,
          plsql: code,
          errorMessage: text,
          item: item.optional(),
          button: id.optional(),
          ...guards
        })
      ).max(100).optional(),
      branches: external_exports.array(external_exports.strictObject({ id, target: scaffoldTarget, button: id.optional(), ...guards })).max(100).optional(),
      refreshes: external_exports.array(
        external_exports.strictObject({ items: external_exports.array(item).min(1).max(100), regions: external_exports.array(id).min(1).max(30) })
      ).max(30).optional()
    })
  ).min(1).max(30)
});

// packages/core/src/scaffold-renderer.ts
var q = (v) => JSON.stringify(v);
var indent = (v) => v.split("\n").map((line) => line ? "    " + line : line).join("\n");
var g = (name, value) => `${name} {
${indent(value)}
}`;
var n = (kind, id2, value) => `${kind} ${id2} (
${indent(value.filter(Boolean).join("\n"))}
)
`;
var fence = (language, value) => `
${indent("```" + language + "\n" + value + "\n```")}`;
var invalid = (message) => {
  throw new Fault("INVALID_INPUT", message, 2);
};
var ref = (value) => "@" + value;
function condition2(value, button) {
  const parts = button ? [`whenButtonPressed: ${ref(button)}`] : [];
  for (const [key, field] of Object.entries(value.condition ?? {}))
    parts.push(`${key}: ${key === "type" ? field : q(field)}`);
  if (value.condition?.type === "expression") parts.push("language: plsql");
  return parts.length ? g("serverSideCondition", parts.join("\n")) : "";
}
function guards2(value, button, securityExtra = "") {
  const security = [
    value.authorizationScheme ? `authorizationScheme: ${ref(value.authorizationScheme)}` : "",
    securityExtra
  ].filter(Boolean).join("\n");
  return [
    condition2(value, button),
    security ? g("security", security) : "",
    value.buildOption ? g("config", `buildOption: ${ref(value.buildOption)}`) : ""
  ].filter(Boolean);
}
function target(value) {
  return g(
    "target:",
    [
      `page: ${value.page}`,
      value.items ? g(
        "items:",
        Object.entries(value.items).map(([key, val]) => `${key}: ${q(val)}`).join("\n")
      ) : "",
      value.clearCache?.length ? `clearCache: ${value.clearCache.join(",")}` : ""
    ].filter(Boolean).join("\n")
  );
}
function query2(value, location = true) {
  return g(
    "source",
    [
      location ? "location: localDatabase" : "",
      "type: sqlQuery",
      value.itemsToSubmit?.length ? `pageItemsToSubmit: ${value.itemsToSubmit.join(",")}` : "",
      `sqlQuery:${fence("sql", value.sql)}`
    ].filter(Boolean).join("\n")
  );
}
function appearance(template) {
  return g("appearance", `template: @/${template}
templateOptions: #DEFAULT#`);
}
var reportAlias = (index) => {
  let alias = "";
  for (let num = index + 1; num; num = Math.floor((num - 1) / 26))
    alias = String.fromCharCode(65 + (num - 1) % 26) + alias;
  return alias;
};
function renderRegion(region2, index, release = "26.2") {
  const chart = region2.type === "chart" || region2.type === "barChart";
  const parts = [
    `name: ${q(region2.name)}`,
    `type: ${chart ? "chart" : region2.type}`,
    g("layout", `sequence: ${(index + 1) * 10}
slot: body`),
    appearance(
      region2.type === "cards" ? "cards-container" : ["interactiveReport", "classicReport"].includes(region2.type) ? "interactive-report" : "standard"
    ),
    ...guards2(region2, void 0, chart ? "escapeSpecialChars: true" : "")
  ];
  if ("sql" in region2) parts.push(query2(region2));
  if (region2.type === "staticContent" && region2.html)
    parts.push(g("source", `htmlCode:${fence("html", region2.html)}`));
  if (region2.type === "form") parts.push(g("edit", "enabled: false"));
  if (region2.type === "calendar") {
    if (region2.initialDate)
      parts.push(
        g(
          "componentAdvanced",
          `initJavaScriptFunction:${fence("javascript-browser", `function(options) { options.initialDate = ${q(region2.initialDate)}; return options; }`)}`
        )
      );
    parts.push(
      g(
        "settings",
        [
          `displayColumn: ${region2.displayColumn}`,
          `startDateColumn: ${region2.startDateColumn}`,
          region2.endDateColumn ? `endDateColumn: ${region2.endDateColumn}` : "",
          region2.keyColumn ? `pkColumn: ${region2.keyColumn}` : "",
          `showTime: ${region2.showTime ?? false}`,
          region2.link ? target(region2.link).replace(/^target:/, "viewEditLink:") : ""
        ].filter(Boolean).join("\n")
      )
    );
  }
  if (region2.type === "cards") {
    parts.push(g("title", `column: ${region2.titleColumn}`), g("body", `column: ${region2.bodyColumn}`));
    if (region2.keyColumn) parts.push(g("card", `primaryKeyColumn1: ${region2.keyColumn}`));
    if (region2.link)
      parts.push(
        n("action", "open", [
          "type: fullCard",
          g("layout", "sequence: 10"),
          g("behavior", "type: redirectThisApp\n" + target(region2.link))
        ])
      );
  }
  if (chart) {
    const kind = region2.type === "barChart" ? "bar" : region2.chartType;
    parts.push(g("chart", `type: ${kind}`));
    if (kind !== "pie" && kind !== "donut")
      for (const [axis, title] of [
        ["x", region2.xTitle],
        ["y", region2.yTitle]
      ])
        parts.push(n("axis", axis, [`name: ${axis}`, title ? `title: ${q(title)}` : ""]));
    const series = region2.type === "barChart" ? [{ ...region2, id: "values" }] : region2.series;
    series.forEach(
      (entry, ordinal) => parts.push(
        n("series", entry.id ?? `s${ordinal + 1}`, [
          `name: ${q(entry.name)}`,
          g("execution", `sequence: ${(ordinal + 1) * 10}`),
          query2(entry, false),
          g("columnMapping", `label: ${entry.labelColumn}
value: ${entry.valueColumn}`),
          "link" in entry && entry.link ? g("link", "type: redirectThisApp\n" + target(entry.link)) : ""
        ])
      )
    );
  }
  if (region2.type === "interactiveReport" || region2.type === "classicReport") {
    if (region2.type === "classicReport")
      parts.push(g("componentAppearance", "template: @/standard\ntemplateOptions: #DEFAULT#"));
    else
      parts.push(
        g("pagination", "type: rowRangesXToYOfZ"),
        g("link", region2.link ? "linkColumn: customTarget\n" + target(region2.link) : "linkColumn: exclude")
      );
    parts.push(
      g(
        "messages",
        `whenNoDataFound: ${q(region2.emptyMessage ?? "No rows found. Clear filters or add source data.")}`
      )
    );
    region2.columns.forEach((column2, i) => {
      const body = [
        region2.type === "classicReport" ? `${column2.link ? "type: link\n" : ""}reportColumnQueryId: ${i + 1}
derivedColumn: N` : `type: ${column2.link ? "link" : "plainText"}`,
        g("heading", `heading: ${q(column2.heading)}`),
        g("layout", `sequence: ${(i + 1) * 10}`)
      ];
      if (region2.type === "interactiveReport")
        body.push(
          g(
            "source",
            `dataType: ${release === "26.1" ? { varchar2: "STRING", number: "NUMBER", date: "DATE", timestamp: "TIMESTAMP" }[column2.dataType] : column2.dataType}`
          ),
          g("advanced", `endUserAlias: ${reportAlias(i)}`)
        );
      if (i === 0) body.push(g("accessibility", "valueIdentifiesRow: true"));
      if (column2.formatMask) body.push(g("appearance", `formatMask: ${q(column2.formatMask)}`));
      if (column2.link)
        body.push(
          g("link", `linkText: ${q(column2.linkText ?? "#" + column2.name + "#")}
${target(column2.link)}`)
        );
      parts.push(n("column", column2.name, body));
    });
    if (region2.type === "interactiveReport")
      parts.push(
        n("savedReport", "1001", [
          "visibility: primaryDefault",
          g("view", "rowsPerPage: 25"),
          ...region2.columns.map((c, i) => n("displayColumn", c.name, [`sequence: ${i + 1}`]))
        ])
      );
  }
  return indent(n("region", region2.id ?? `r${index + 1}`, parts));
}
function renderProcess(value, mapping, shared = false) {
  return n(shared ? "appProcess" : "process", value.id, [
    `name: ${q(value.id)}`,
    "type: executeCode",
    shared ? "" : g("advanced", `executionMappingIdentifier: ${mapping}`),
    g("source", `plsqlCode:${fence("plsql", value.plsql)}`),
    g(
      "execution",
      `sequence: ${value.sequence ?? 10}
point: ${value.point ?? (shared ? "beforeHeader" : "afterSubmit")}`
    ),
    ...guards2(value, shared ? void 0 : value.button),
    value.successMessage && !shared ? g("successMessage", `successMessage: ${q(value.successMessage)}`) : ""
  ]);
}
function renderPageBody(page, release) {
  const parts = page.regions.map((region2, index) => renderRegion(region2, index, release));
  page.items?.forEach((item2, i) => {
    const hidden = item2.type === "hidden";
    const fields = [
      `type: ${item2.type}`,
      hidden ? "" : g("label", `label: ${q(item2.label ?? item2.name)}`),
      g("layout", `sequence: ${(i + 1) * 10}
region: ${ref(item2.region)}
slot: regionBody`),
      hidden ? "" : g(
        "appearance",
        `template: @/${item2.required ? "required-floating" : "optional-floating"}
templateOptions: #DEFAULT#${item2.formatMask ? "\nformatMask: " + q(item2.formatMask) : ""}`
      ),
      hidden || item2.type === "displayOnly" ? "" : g("validation", `valueRequired: ${item2.required ?? false}`),
      ...guards2(item2, void 0, hidden ? "sessionStateProtection: checksumRequiredSessionLevel" : "")
    ];
    if (item2.defaultValue !== void 0)
      fields.push(g("default", `type: static
staticValue: ${q(item2.defaultValue)}`));
    if (item2.lov)
      fields.push(
        g(
          "lov",
          Array.isArray(item2.lov) ? `type: staticValues
staticValues: ${q("STATIC:" + item2.lov.map((option) => `${option.label};${option.value}`).join(","))}
displayNullValue: true
nullDisplayValue: - Select -` : `type: sqlQuery
sqlQuery:${fence("sql", item2.lov.sql)}
displayNullValue: true
nullDisplayValue: - Select -`
        )
      );
    if (item2.sourceColumn)
      fields.push(
        g(
          "source",
          `formRegion: ${ref(item2.region)}
column: ${item2.sourceColumn}
dataType: ${item2.dataType ?? "varchar2"}
queryOnly: true${item2.primaryKey ? "\nprimaryKey: true" : ""}`
        )
      );
    parts.push(indent(n("pageItem", item2.name, fields)));
  });
  page.buttons?.forEach(
    (button, i) => parts.push(
      indent(
        n("button", button.id, [
          `buttonName: ${button.id.replaceAll("-", "_").toUpperCase()}`,
          `label: ${q(button.label)}`,
          g(
            "layout",
            `sequence: ${(i + 1) * 10}
region: ${ref(button.region)}
slot: ${release === "26.1" ? "next" : "NEXT"}`
          ),
          g("appearance", "buttonTemplate: @/text\ntemplateOptions: #DEFAULT#"),
          g(
            "behavior",
            (button.target ? "action: redirectThisApp\n" + target(button.target) : "action: submitPage") + (button.confirmation ? "\nrequiresConfirmation: true" : "")
          ),
          button.confirmation ? g(
            "confirmation",
            `message: ${q(button.confirmation.message)}${button.confirmation.style ? "\nstyle: " + button.confirmation.style : ""}`
          ) : "",
          ...guards2(button)
        ])
      )
    )
  );
  const mapping = (i) => 76e13 + page.id * 1e3 + i + 1;
  page.processes?.forEach(
    (process, i) => parts.push(indent(renderProcess({ ...process, sequence: process.sequence ?? (i + 1) * 10 }, mapping(i))))
  );
  page.regions.filter((region2) => region2.type === "form").forEach(
    (region2, i) => parts.push(
      indent(
        n("process", `initialize-${region2.id ?? "r" + (page.regions.indexOf(region2) + 1)}`, [
          "name: Initialize form",
          "type: formInitialization",
          `formRegion: ${ref(region2.id ?? "r" + (page.regions.indexOf(region2) + 1))}`,
          g("advanced", `executionMappingIdentifier: ${mapping(100 + i)}`),
          g("execution", `sequence: 10
point: beforeHeader`)
        ])
      )
    )
  );
  page.validations?.forEach(
    (validation, i) => parts.push(
      indent(
        n("validation", validation.id, [
          `name: ${q(validation.id)}`,
          g("execution", `sequence: ${(i + 1) * 10}`),
          g(
            "validation",
            `type: functionBodyReturningBoolean
plsqlFunctionBody:${fence("plsql", validation.plsql)}`
          ),
          g(
            "error",
            `errorMessage: ${q(validation.errorMessage)}${validation.item ? "\nassociatedItem: " + ref(validation.item) : ""}`
          ),
          ...guards2(validation, validation.button)
        ])
      )
    )
  );
  page.branches?.forEach(
    (branch, i) => parts.push(
      indent(
        n("branch", branch.id, [
          `name: ${q(branch.id)}`,
          g("behavior", "type: pageOrUrl\n" + target(branch.target)),
          g("execution", `point: afterProcessing
sequence: ${(i + 1) * 10}`),
          ...guards2(branch, branch.button)
        ])
      )
    )
  );
  page.refreshes?.forEach(
    (refresh, i) => parts.push(
      indent(
        n("dynamicAction", `refresh-${i + 1}`, [
          `name: Refresh dependent regions ${i + 1}`,
          g("execution", `sequence: ${(i + 1) * 10}`),
          g("when", `event: change
selectionType: items
items: ${refresh.items.join(",")}`),
          ...refresh.regions.map(
            (region2, ordinal) => n("action", `refresh-${ordinal + 1}`, [
              "action: refresh",
              g("affectedElements", `selectionType: region
region: ${ref(region2)}`),
              g("execution", `sequence: ${(ordinal + 1) * 10}
fireOnInit: false`)
            ])
          )
        ])
      )
    )
  );
  return parts.join("\n");
}
function validateSpec(spec) {
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) invalid(`${label} must be unique.`);
  };
  unique(
    spec.pages.map((page) => String(page.id)),
    "Page IDs"
  );
  const checkTarget = (target2) => {
    if (target2 && Object.keys(target2.items ?? {}).some((name) => !name.startsWith(`P${target2.page}_`)))
      invalid("Target item names must belong to the target page.");
  };
  unique(
    (spec.applicationProcesses ?? []).map((process) => process.id),
    "Application process IDs"
  );
  for (const page of spec.pages) {
    const regions2 = page.regions.map((region2, i) => region2.id ?? `r${i + 1}`), items = page.items?.map((item2) => item2.name) ?? [], buttons = page.buttons?.map((button) => button.id) ?? [];
    unique(regions2, "Region IDs");
    unique(items, "Item names");
    unique(buttons, "Button IDs");
    unique(
      buttons.map((id2) => id2.replaceAll("-", "_").toUpperCase()),
      "Button request names"
    );
    for (const list of [page.processes, page.validations, page.branches])
      unique(
        (list ?? []).map((value) => value.id),
        "Component IDs"
      );
    const requireRegion = (id2) => {
      if (!regions2.includes(id2)) invalid(`Unknown page ${page.id} region ${id2}.`);
    };
    const requireItem = (name) => {
      if (!items.includes(name)) invalid(`Unknown page ${page.id} item ${name}.`);
    };
    page.items?.forEach((item2) => {
      if (!item2.name.startsWith(`P${page.id}_`)) invalid(`Item ${item2.name} must belong to page ${page.id}.`);
      requireRegion(item2.region);
      if (item2.type === "selectList" && !item2.lov) invalid("Select list items require a LOV.");
      if (item2.lov && item2.type !== "selectList") invalid("Only select lists accept a LOV.");
      if (Array.isArray(item2.lov) && item2.lov.some((option) => /[,;]/.test(option.label + option.value)))
        invalid("Static LOV labels/values cannot contain comma or semicolon; use a SQL LOV.");
      if (item2.sourceColumn && page.regions[regions2.indexOf(item2.region)]?.type !== "form")
        invalid("sourceColumn requires a native form region.");
      if (!item2.sourceColumn && (item2.primaryKey !== void 0 || item2.dataType !== void 0))
        invalid("Form dataType/primaryKey require sourceColumn.");
      if (item2.required && ["hidden", "displayOnly"].includes(item2.type))
        invalid("Hidden/display-only items cannot require editable input.");
      if (item2.type === "hidden" && item2.formatMask)
        invalid("Hidden items cannot have a display format mask.");
    });
    page.buttons?.forEach((button) => {
      requireRegion(button.region);
      if (button.action === "redirectToPage" && !button.target) invalid("Redirect buttons require target.");
      if (button.action === "submitPage" && button.target) invalid("Submit buttons cannot have a target.");
      checkTarget(button.target);
    });
    for (const value of [...page.processes ?? [], ...page.validations ?? [], ...page.branches ?? []])
      if (value.button && !buttons.includes(value.button))
        invalid(`Unknown page ${page.id} button ${value.button}.`);
    page.validations?.forEach((validation) => {
      if (validation.item) requireItem(validation.item);
    });
    page.branches?.forEach((branch) => checkTarget(branch.target));
    page.refreshes?.forEach((refresh) => {
      refresh.items.forEach(requireItem);
      refresh.regions.forEach(requireRegion);
      for (const id2 of refresh.regions) {
        const region2 = page.regions[regions2.indexOf(id2)];
        const sources = region2.type === "chart" ? region2.series : "sql" in region2 ? [region2] : [];
        if (!sources.length || sources.some((source) => refresh.items.some((item2) => !source.itemsToSubmit?.includes(item2))))
          invalid(`Refresh region ${id2} must submit every triggering item on every query/series.`);
      }
    });
    for (const region2 of page.regions) {
      if ("link" in region2) checkTarget(region2.link);
      if ("columns" in region2)
        region2.columns.forEach((column2) => {
          checkTarget(column2.link);
          if (column2.linkText !== void 0 && !column2.link) invalid("Column linkText requires a link.");
        });
      if (region2.type === "classicReport" && region2.link)
        invalid("Classic report links belong to individual columns.");
      if (region2.type === "chart") region2.series.forEach((series) => checkTarget(series.link));
      if ("columns" in region2)
        unique(
          region2.columns.map((column2) => column2.name),
          "Report columns"
        );
      if (region2.type === "chart")
        unique(
          region2.series.map((series, i) => series.id ?? `s${i + 1}`),
          "Series IDs"
        );
      for (const source of region2.type === "chart" ? region2.series : "sql" in region2 ? [region2] : [])
        source.itemsToSubmit?.forEach(requireItem);
      if (region2.type === "cards" && region2.link && !region2.keyColumn)
        invalid("Linked cards require a keyColumn.");
      if (region2.type === "calendar" && region2.link && !region2.keyColumn)
        invalid("Linked calendars require a keyColumn.");
    }
  }
}
function pageGuards(page) {
  return guards2(page, void 0, "pageAccessProtection: argumentsMustHaveChecksum").map(indent).join("\n");
}

// packages/core/src/scaffold.ts
var stateSchema = external_exports.strictObject({
  version: external_exports.literal(1),
  files: external_exports.record(external_exports.string(), external_exports.string()),
  shells: external_exports.record(external_exports.string(), external_exports.string()),
  navigation: external_exports.record(external_exports.string(), external_exports.string()).optional()
});
var q2 = (value) => JSON.stringify(value);
var slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
var group = (name, body, level = 2) => `${"    ".repeat(level)}${name} {
${body}
${"    ".repeat(level)}}`;
var property = (name, value, level = 3) => `${"    ".repeat(level)}${name}: ${value}`;
var block = (head, body, level = 1) => `${"    ".repeat(level)}${head} (
${body}
${"    ".repeat(level)})`;
async function scaffold(ctx, specFile, name) {
  const file = await contained(ctx.root, specFile);
  const raw = await readFile2(file, "utf8");
  if (Buffer.byteLength(raw) > 256 * 1024)
    throw new Fault("INVALID_INPUT", "Scaffold specification exceeds 256 KiB.", 2);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Fault("INVALID_INPUT", "specFile must contain valid JSON.", 2);
  }
  const spec = parse(scaffoldSchema, input);
  const specDigest = hash(raw);
  const target2 = name ? environment(ctx, name) : void 0;
  validateSpec(spec);
  const root = await contained(ctx.root, ctx.config.application.sourceDir);
  const release = await sourceRelease(root);
  if (release !== "26.1" && release !== "26.2")
    throw new Fault(
      "SCAFFOLD_RELEASE_UNSUPPORTED",
      "Scaffolding requires an Oracle-generated 26.1 or 26.2 application.",
      3
    );
  return withLock(await contained(ctx.root, ".apexrest/scaffold.lock"), async () => {
    const stateFile = await contained(ctx.root, ".apexrest/scaffold.json");
    const state = await exists(stateFile) ? parse(stateSchema, await readJson(stateFile)) : {
      version: 1,
      files: {},
      shells: {},
      navigation: {}
    };
    const ownedNavigation = state.navigation ??= {};
    const before = await inventory(root), writes = {};
    const conflict = (name2) => new Fault(
      "LOCAL_EDITS_CONFLICT",
      `Scaffold cannot replace unowned or edited source: ${name2}. Preserve the file and edit it manually.`,
      5,
      "conflict"
    );
    const navFile = release === "26.1" ? "shared-components/lists.apx" : "shared-components/lists/navigation-menu.apx";
    const navigation = await readFile2(await contained(root, navFile), "utf8");
    const nav = parseApexLang(navigation, navFile);
    const menus = nav.filter((node) => node.type === "list" && node.id === "navigation-menu");
    if (menus.length !== 1) throw conflict(navFile);
    const menu = menus[0];
    let navText = navigation;
    const aliases = /* @__PURE__ */ new Map();
    for (const file2 of Object.keys(before).filter(
      (name2) => name2.startsWith("pages/") && name2.endsWith(".apx")
    )) {
      for (const node of parseApexLang(await readFile2(await contained(root, file2), "utf8"), file2)) {
        if (node.type === "page" && typeof node.props.alias === "string")
          aliases.set(node.props.alias.toUpperCase(), Number(node.id));
      }
    }
    for (const page of spec.pages) {
      const files = Object.keys(before).filter(
        (f) => f.startsWith("pages/") && /^p\d+-/.test(path2.basename(f)) && Number(/^p(\d+)-/.exec(path2.basename(f))?.[1]) === page.id
      );
      if (files.length > 1) throw conflict(`page ${page.id}`);
      let alias = page.alias?.toLowerCase() ?? slug(page.name);
      if (!page.alias) {
        const base = alias;
        for (let attempt = 0; alias === "page" || aliases.has(alias.toUpperCase()) && aliases.get(alias.toUpperCase()) !== page.id; attempt++) {
          alias = `${base}-${page.id}${attempt ? "-" + attempt : ""}`;
        }
      }
      if (page.alias && aliases.has(page.alias.toUpperCase()) && aliases.get(page.alias.toUpperCase()) !== page.id)
        throw conflict(`page alias ${page.alias}`);
      const name2 = files[0] ?? `pages/p${String(page.id).padStart(5, "0")}-${alias}.apx`;
      aliases.set(
        (page.alias ?? path2.basename(name2).replace(/^p\d+-/, "").replace(/\.apx$/, "")).toUpperCase(),
        page.id
      );
      if (files[0] && page.alias && !state.shells[name2] && page.alias.toLowerCase() !== path2.basename(name2).replace(/^p\d+-/, "").replace(/\.apx$/, ""))
        throw conflict("Changing a page alias requires an explicit source rename.");
      const body = renderPageBody(page, release);
      if ((state.shells[name2] || page.id === 1 && files[0] && !state.files[name2]) && (page.condition || page.authorizationScheme || page.buildOption))
        throw conflict(
          "Preserve the existing Home page security; place guards on its regions and processes."
        );
      if (files[0] && !state.files[name2]) {
        const old = await readFile2(await contained(root, name2), "utf8");
        const [home, ...extra] = parseApexLang(old, name2);
        if (page.id !== 1 || extra.length || home?.type !== "page" || home.id !== "1" || home.children.length !== 1 || home.children[0].id !== "app-name" || home.children[0].props.type !== "staticContent")
          throw conflict(name2);
        if (page.alias && page.alias !== home.props.alias) throw conflict("existing Home page alias");
        state.shells[name2] = old.replace(/^    name: .+$/m, () => "    name: " + q2(page.name)).replace(/^    title: .+$/m, () => "    title: " + q2(page.name));
        const shell = state.shells[name2];
        const close = shell.lastIndexOf(")");
        writes[name2] = shell.slice(0, close) + body + "\n" + shell.slice(close);
      } else {
        if (files[0] && state.files[name2] !== before[name2]) throw conflict(name2);
        let shell = state.shells[name2];
        if (shell) {
          if (page.alias && page.alias !== parseApexLang(shell, name2)[0]?.props.alias)
            throw conflict("existing Home page alias");
          shell = shell.replace(/^    name: .+$/m, () => "    name: " + q2(page.name)).replace(/^    title: .+$/m, () => "    title: " + q2(page.name));
          state.shells[name2] = shell;
        }
        writes[name2] = shell ? shell.slice(0, shell.lastIndexOf(")")) + body + "\n" + shell.slice(shell.lastIndexOf(")")) : block(
          `page ${page.id}`,
          [
            property("name", q2(page.name), 1),
            property(
              "alias",
              q2(
                page.alias ?? path2.basename(name2).replace(/^p\d+-/, "").replace(/\.apx$/, "").toUpperCase()
              ),
              1
            ),
            property("title", q2(page.name), 1),
            group(
              "appearance",
              property("pageTemplate", "@/standard", 2) + "\n" + property("templateOptions", "#DEFAULT#", 2),
              1
            ),
            pageGuards(page),
            body
          ].join("\n"),
          0
        ) + "\n";
      }
      const entry = menu.children.find(
        (e) => e.type === "entry" && String(get(e.props, "link.target.page")) === String(page.id)
      );
      if (page.navigation === false) {
        if (!entry) continue;
        if (entry.id !== `scaffold-p${page.id}` || !ownedNavigation[entry.id])
          throw conflict(`${navFile} unowned entry ${entry.id}`);
        const nodes = declarations(navText), owner = nodes.find((node2) => node2.kind === "list" && node2.key === "navigation-menu");
        const node = nodes.find(
          (node2) => node2.kind === "entry" && node2.key === entry.id && owner && node2.start > owner.start && node2.end < owner.end
        );
        if (!node || ownedNavigation[entry.id] !== node.digest)
          throw conflict(`${navFile} entry ${entry.id}`);
        navText = editSpans(navText, [{ ...node, expectedDigest: node.digest, content: "" }]);
        delete ownedNavigation[entry.id];
        continue;
      }
      if (entry && (entry.id === `scaffold-p${page.id}` || page.id === 1 && state.shells[name2])) {
        const owners = declarations(navText), owner = owners.find((node2) => node2.kind === "list" && node2.key === "navigation-menu");
        const node = owners.find(
          (node2) => node2.kind === "entry" && node2.key === entry.id && owner && node2.start > owner.start && node2.end < owner.end
        );
        if (!node) throw conflict(navFile);
        const old = navText.slice(node.start, node.end);
        if (ownedNavigation[entry.id] && ownedNavigation[entry.id] !== hash(old))
          throw conflict(`${navFile} entry ${entry.id}`);
        if (!ownedNavigation[entry.id] && state.files[navFile] && state.files[navFile] !== before[navFile] && entry.props.label !== page.name)
          throw conflict(`${navFile} entry ${entry.id}`);
        if (!/^        label: .+$/m.test(old)) throw conflict(navFile);
        const content = old.replace(/^        label: .+$/m, () => "        label: " + q2(page.name));
        navText = editSpans(navText, [
          {
            ...node,
            expectedDigest: node.digest,
            content
          }
        ]);
        ownedNavigation[entry.id] = hash(content);
      }
      if (!entry) {
        const id2 = `scaffold-p${page.id}`;
        if (menu.children.some((e) => e.id === id2)) throw conflict(navFile);
        const addition = block(
          `entry ${id2}`,
          [
            property("label", q2(page.name), 2),
            group("layout", property("sequence", String(page.id + 10), 3)),
            group("link", group("target:", property("page", String(page.id), 4), 3))
          ].join("\n")
        );
        const owner = declarations(navText).find(
          (node) => node.kind === "list" && node.key === "navigation-menu"
        );
        if (!owner) throw conflict(navFile);
        const at = navText.lastIndexOf(")", owner.end - 1);
        navText = navText.slice(0, at) + addition + "\n" + navText.slice(at);
        const nodes = declarations(navText), scope = nodes.find((node) => node.kind === "list" && node.key === "navigation-menu");
        const added = nodes.find(
          (node) => node.kind === "entry" && node.key === id2 && scope && node.start > scope.start && node.end < scope.end
        );
        if (!added) throw conflict(navFile);
        ownedNavigation[id2] = hash(navText.slice(added.start, added.end));
      }
    }
    if (navText !== navigation) writes[navFile] = navText;
    if (spec.applicationProcesses !== void 0) {
      const file2 = "shared-components/app-processes.apx";
      if (state.files[file2] && state.files[file2] !== before[file2]) throw conflict(file2);
      const old = before[file2] ? await readFile2(await contained(root, file2), "utf8") : "";
      const shell = state.shells[file2] ?? old;
      for (const source of Object.keys(before).filter((name2) => name2.endsWith(".apx"))) {
        const text2 = source === file2 ? shell : await readFile2(await contained(root, source), "utf8");
        if (!/\bappProcess\s/.test(text2)) continue;
        const nodes = parseApexLang(text2, source);
        const found = (list) => list.some(
          (node) => node.type === "appProcess" && spec.applicationProcesses.some((process) => process.id === node.id) || found(node.children)
        );
        if (found(nodes)) throw conflict(source);
      }
      state.shells[file2] = shell;
      writes[file2] = shell + (spec.applicationProcesses.length ? "\n" : "") + spec.applicationProcesses.map((value, i) => renderProcess({ ...value, sequence: value.sequence ?? (i + 1) * 10 }, i, true)).join("\n");
    }
    if (spec.applicationName) {
      const name2 = "application.apx";
      const original = await readFile2(await contained(root, name2), "utf8");
      if (!/^    name: .+$/m.test(original)) throw conflict(name2);
      writes[name2] = original.replace(/^    name: .+$/m, () => "    name: " + q2(spec.applicationName));
    }
    const executionIds = /* @__PURE__ */ new Map();
    for (const source of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(writes)])) {
      if (!source.endsWith(".apx")) continue;
      const text2 = writes[source] ?? await readFile2(await contained(root, source), "utf8");
      if (!text2.includes("executionMappingIdentifier")) continue;
      const nodes = parseApexLang(text2, source);
      const check = (list) => {
        for (const node of list) {
          const mapping = get(node.props, "advanced.executionMappingIdentifier");
          if (mapping !== void 0) {
            const key = String(mapping), previous = executionIds.get(key);
            if (previous && (writes[source] || writes[previous])) throw conflict(`execution ID ${key}`);
            executionIds.set(key, source);
          }
          check(node.children);
        }
      };
      check(nodes);
    }
    for (const [name2, value] of Object.entries(writes)) {
      const nodes = parseApexLang(value, name2);
      const unique = (list) => {
        const keys = list.map((node) => `${node.type}:${node.id}`);
        if (new Set(keys).size !== keys.length) throw conflict(`duplicate components in ${name2}`);
        list.forEach((node) => unique(node.children));
      };
      unique(nodes);
    }
    const stage = await contained(ctx.root, `.apexrest/scaffolds/${randomUUID()}`);
    await atomicWrite(path2.join(stage, "spec.json"), raw);
    const observationsFile = path2.join(stage, "observations.sql");
    if (target2 && release === "26.2")
      await atomicWrite(
        observationsFile,
        await scaffoldObservationsSql(
          target2,
          spec.pages.map((p) => p.id)
        )
      );
    for (const [name2, value] of Object.entries(writes)) {
      if (before[name2])
        await atomicWrite(path2.join(stage, "before", name2), await readFile2(await contained(root, name2)));
      await atomicWrite(path2.join(stage, "after", name2), value);
    }
    if (canonical(await inventory(root)) !== canonical(before))
      throw new Fault("SOURCE_DRIFT", "Source changed during scaffolding; staged outputs retained.", 5);
    if (hash(await readFile2(file, "utf8")) !== specDigest)
      throw new Fault(
        "SOURCE_DRIFT",
        "The scaffold specification changed before writing; the staged exact input is retained.",
        5
      );
    for (const [name2, value] of Object.entries(writes)) {
      const target3 = await contained(root, name2);
      const current = await exists(target3) ? hash(await readFile2(target3)) : void 0;
      if (current !== before[name2])
        throw new Fault("SOURCE_DRIFT", `Source changed before writing ${name2}; staged copies retained.`, 5);
      await atomicWrite(target3, value);
      state.files[name2] = hash(value);
    }
    await writeJson(stateFile, state);
    return {
      files: Object.keys(writes),
      pages: spec.pages.map((p) => ({ id: p.id, name: p.name })),
      sourceDigest: hash(canonical(await inventory(root))),
      specDigest,
      compilerValidation: "required-by-ship",
      nextAction: "apexrest_ship mode:apply",
      stage: path2.relative(ctx.root, stage),
      ...target2 && release === "26.2" ? {
        readback: {
          sqlFile: path2.relative(ctx.root, observationsFile),
          environment: name,
          connectionRef: target2.readConnectionRef,
          purpose: "Only if requested: manually execute read-only metadata/query observations after import. Not executed by scaffold or ship."
        }
      } : {},
      ...target2 && release === "26.1" ? {
        readbackUnavailable: "The optional scaffold SQL observations are qualified for 26.2 only. Use scoped metadata reads for 26.1."
      } : {}
    };
  });
}
export {
  renderRegion,
  scaffold,
  scaffoldSchema
};
