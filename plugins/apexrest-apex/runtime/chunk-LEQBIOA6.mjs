import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  appearance,
  fence,
  group,
  indent,
  node,
  refreshAction
} from "./chunk-OA3W7BIM.mjs";
import {
  Fault,
  external_exports
} from "./chunk-OWILYJ3V.mjs";

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
var table = column;
var edit = external_exports.strictObject({
  operations: external_exports.array(external_exports.enum(["add", "update", "delete"])).min(1).max(3),
  rowVersionColumn: column.optional()
});
var gridColumn = external_exports.strictObject({
  name: column,
  heading: text.optional(),
  dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]),
  primaryKey: external_exports.boolean().optional(),
  hidden: external_exports.boolean().optional(),
  queryOnly: external_exports.boolean().optional(),
  /** Detail grids: the master grid column this column joins to. */
  masterColumn: column.optional()
});
var reportExtras = { refreshOnDialogClose: external_exports.boolean().optional() };
var regions = external_exports.discriminatedUnion("type", [
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.enum(["interactiveReport", "classicReport"]),
    columns: external_exports.array(reportColumn).min(1).max(100),
    emptyMessage: text.optional(),
    link: scaffoldTarget.optional(),
    ...reportExtras
  }),
  external_exports.strictObject({
    ...region,
    ...query,
    type: external_exports.literal("cards"),
    titleColumn: column,
    bodyColumn: column,
    keyColumn: column.optional(),
    link: scaffoldTarget.optional(),
    ...reportExtras
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
  external_exports.strictObject({
    ...region,
    type: external_exports.literal("form"),
    sql: sql.optional(),
    itemsToSubmit: external_exports.array(item).max(100).optional(),
    table: table.optional(),
    edit: edit.optional()
  }),
  external_exports.strictObject({
    ...region,
    type: external_exports.literal("interactiveGrid"),
    table,
    columns: external_exports.array(gridColumn).min(1).max(100),
    edit: edit.optional(),
    /** Detail grid of a master-detail page: the master grid region on the same page. */
    master: id.optional()
  }),
  external_exports.strictObject({
    ...region,
    type: external_exports.literal("facetedSearch"),
    filteredRegion: id,
    facets: external_exports.array(
      external_exports.strictObject({
        item,
        type: external_exports.enum(["search", "checkboxGroup", "radioGroup"]),
        label: text,
        columns: external_exports.array(column).min(1).max(20)
      })
    ).min(1).max(20)
  }),
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
      /** modalDialog pages leave the navigation menu unless navigation is true. */
      mode: external_exports.enum(["normal", "modalDialog"]).optional(),
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
var g = group;
var n = (kind, id2, value) => node(kind, id2, value);
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
var reportAlias = (index) => {
  let alias = "";
  for (let num = index + 1; num; num = Math.floor((num - 1) / 26))
    alias = String.fromCharCode(65 + (num - 1) % 26) + alias;
  return alias;
};
function editGroup(edit2) {
  if (!edit2) return g("edit", "enabled: false");
  return g(
    "edit",
    [
      "enabled: true",
      `allowedOperations: [
${indent(edit2.operations.join("\n"))}
]`,
      `lostUpdateType: ${edit2.rowVersionColumn ? "rowVersionColumn" : "rowValues"}`,
      edit2.rowVersionColumn ? `rowVersionColumn: ${edit2.rowVersionColumn}` : ""
    ].filter(Boolean).join("\n")
  );
}
var tableSource = (table2) => g("source", `location: localDatabase
tableName: ${table2}`);
var regionId = (page, region2) => region2.id ?? `r${page.regions.indexOf(region2) + 1}`;
function renderRegion(region2, index, release = "26.2", slot = "body") {
  const chart = region2.type === "chart" || region2.type === "barChart";
  const parts = [
    `name: ${q(region2.name)}`,
    `type: ${chart ? "chart" : region2.type}`,
    g("layout", `sequence: ${(index + 1) * 10}
slot: ${slot}`),
    appearance(
      region2.type === "cards" ? "cards-container" : ["interactiveReport", "classicReport", "interactiveGrid"].includes(region2.type) ? "interactive-report" : region2.type === "facetedSearch" ? "blank-with-attributes" : "standard"
    ),
    ...guards2(region2, void 0, chart ? "escapeSpecialChars: true" : "")
  ];
  if ("sql" in region2 && region2.sql) parts.push(query2({ ...region2, sql: region2.sql }));
  if (region2.type === "staticContent" && region2.html)
    parts.push(g("source", `htmlCode:${fence("html", region2.html)}`));
  if (region2.type === "form") {
    if (region2.table) parts.push(tableSource(region2.table));
    parts.push(editGroup(region2.edit));
  }
  if (region2.type === "interactiveGrid") {
    parts.push(tableSource(region2.table), editGroup(region2.edit));
    const controls = [
      "searchCol",
      "searchField",
      "actionsMenu",
      "resetButton",
      ...region2.edit ? ["saveButton"] : []
    ];
    parts.push(g("toolbar", `controls: [
${indent(controls.join("\n"))}
]`));
    if (region2.master) parts.push(g("masterDetail", `masterRegion: ${ref(region2.master)}`));
    region2.columns.forEach(
      (column2, i) => parts.push(
        n("column", column2.name, [
          `type: ${column2.hidden ? "hidden" : "textField"}`,
          column2.hidden ? "" : g("heading", `heading: ${q(column2.heading ?? column2.name)}`),
          g("layout", `sequence: ${(i + 1) * 10}`),
          g(
            "source",
            [
              `databaseColumn: ${column2.name}`,
              `dataType: ${column2.dataType}`,
              column2.primaryKey ? "primaryKey: true" : "",
              column2.queryOnly || column2.primaryKey ? "queryOnly: true" : ""
            ].filter(Boolean).join("\n")
          ),
          column2.masterColumn ? g("masterDetail", `masterColumn: ${ref(column2.masterColumn)}`) : "",
          // The first visible column labels the row for assistive technology.
          column2 === region2.columns.find((entry) => !entry.hidden) ? g("accessibility", "valueIdentifiesRow: true") : ""
        ])
      )
    );
    const shown = region2.columns.filter((column2) => !column2.hidden);
    parts.push(
      n("savedReport", "1", [
        "visibility: primary",
        g("view", "default: grid"),
        ...shown.map(
          (column2, i) => n("displayColumn", "", [
            `column: ${ref(column2.name)}`,
            g("layout", `sequence: ${(i + 1) * 10}`)
          ]).replace("displayColumn  (", "displayColumn (")
        )
      ])
    );
  }
  if (region2.type === "facetedSearch") {
    parts.push(g("source", `filteredRegion: ${ref(region2.filteredRegion)}`));
    region2.facets.forEach(
      (facet, i) => parts.push(
        n("facet", facet.item, [
          `type: ${facet.type}`,
          g("label", `label: ${q(facet.label)}`),
          g("layout", `sequence: ${(i + 1) * 10}`),
          facet.type === "search" ? "" : g("lov", "type: distinctValues"),
          g(
            "source",
            facet.type === "search" ? `dbColumns: ${facet.columns.join(",")}` : `databaseColumn: ${facet.columns[0]}`
          )
        ])
      )
    );
  }
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
function formControls(page) {
  return page.regions.flatMap((region2) => {
    if (region2.type !== "form" || !region2.edit) return [];
    const form = regionId(page, region2);
    const key = page.items?.find((item2) => item2.region === form && item2.primaryKey && item2.sourceColumn);
    return [{ form, region: region2, key: key?.name, buttons: `${form}-buttons` }];
  });
}
var modal = (page) => page.mode === "modalDialog";
function renderPageBody(page, release, options = {}) {
  const slot = modal(page) ? "contentBody" : "body";
  const parts = options.regions === false ? [] : page.regions.map((region2, index) => renderRegion(region2, index, release, slot));
  const controls = formControls(page);
  controls.forEach(
    (control, i) => parts.push(
      indent(
        n("region", control.buttons, [
          `name: ${q(control.region.name + " buttons")}`,
          "type: staticContent",
          g(
            "layout",
            `sequence: ${(page.regions.length + i + 1) * 10}
slot: ${modal(page) ? "dialogFooter" : "body"}`
          ),
          appearance("buttons-container")
        ])
      )
    )
  );
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
    if (item2.sourceColumn) {
      const form = page.regions.find((region2) => regionId(page, region2) === item2.region);
      const edit2 = form?.type === "form" ? form.edit : void 0;
      const queryOnly = !edit2 || item2.primaryKey || item2.sourceColumn === edit2.rowVersionColumn;
      fields.push(
        g(
          "source",
          `formRegion: ${ref(item2.region)}
column: ${item2.sourceColumn}
dataType: ${item2.dataType ?? "varchar2"}${queryOnly ? "\nqueryOnly: true" : ""}${item2.primaryKey ? "\nprimaryKey: true" : ""}`
        )
      );
    }
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
  controls.forEach((control) => {
    const ops = control.region.edit.operations;
    const buttons = [];
    if (modal(page))
      buttons.push([
        `cancel-${control.form}`,
        "CANCEL",
        "Cancel",
        g("behavior", "action: definedByDynamicAction"),
        "",
        "close"
      ]);
    const keyCondition = (type) => control.key ? g("serverSideCondition", `type: ${type}
item: ${control.key}`) : "";
    if (ops.includes("delete"))
      buttons.push([
        `delete-${control.form}`,
        "DELETE",
        "Delete",
        g(
          "behavior",
          "action: submitPage\ndatabaseAction: delete\nrequiresConfirmation: true\nexecuteValidations: false"
        ) + "\n" + g("confirmation", 'message: "Delete this row?"\nstyle: danger'),
        keyCondition("itemIsNotNull"),
        "delete"
      ]);
    if (ops.includes("update"))
      buttons.push([
        `save-${control.form}`,
        "SAVE",
        "Apply Changes",
        g("behavior", "action: submitPage\ndatabaseAction: update"),
        keyCondition("itemIsNotNull"),
        "next"
      ]);
    if (ops.includes("add"))
      buttons.push([
        `create-${control.form}`,
        "CREATE",
        "Create",
        g("behavior", "action: submitPage\ndatabaseAction: insert"),
        keyCondition("itemIsNull"),
        "next"
      ]);
    buttons.forEach(
      ([id2, name, label, behavior, condition3, slot2], i) => parts.push(
        indent(
          n("button", id2, [
            `buttonName: ${name}`,
            `label: ${q(label)}`,
            g(
              "layout",
              `sequence: ${(i + 1) * 10}
region: ${ref(control.buttons)}
slot: ${release === "26.1" ? slot2 : slot2 === "next" ? "NEXT" : slot2 === "close" ? "CLOSE" : "DELETE"}`
            ),
            g(
              "appearance",
              `buttonTemplate: @/text${name === "SAVE" || name === "CREATE" ? "\nhot: true" : ""}
templateOptions: #DEFAULT#`
            ),
            behavior,
            condition3
          ])
        )
      )
    );
    if (modal(page))
      parts.push(
        indent(
          n("dynamicAction", `cancel-${control.form}`, [
            "name: Cancel dialog",
            g("execution", "sequence: 10"),
            g("when", `event: click
selectionType: button
button: ${ref(`cancel-${control.form}`)}`),
            // Without fireOnInit: false the cancel runs when the dialog loads and closes it at once.
            n("action", "cancel-dialog", [
              "action: cancelDialog",
              g("execution", "sequence: 10\nfireOnInit: false")
            ])
          ])
        )
      );
  });
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
  controls.forEach((control, i) => {
    const requests = control.region.edit.operations.map((op) => ({ add: "CREATE", update: "SAVE", delete: "DELETE" })[op]).join(",");
    parts.push(
      indent(
        n("process", `process-${control.form}`, [
          `name: ${q("Process form " + control.region.name)}`,
          "type: formAutoRowProcessing",
          `formRegion: ${ref(control.form)}`,
          g("advanced", `executionMappingIdentifier: ${mapping(200 + i)}`),
          g("execution", "sequence: 10\npoint: processing"),
          g("serverSideCondition", `type: requestIsContainedInValue
value: ${requests}`)
        ])
      )
    );
    if (modal(page))
      parts.push(
        indent(
          n("process", `close-${control.form}`, [
            "name: Close dialog",
            "type: closeDialog",
            g("advanced", `executionMappingIdentifier: ${mapping(300 + i)}`),
            g("execution", "sequence: 50\npoint: processing"),
            g("serverSideCondition", `type: requestIsContainedInValue
value: ${requests}`)
          ])
        )
      );
  });
  page.regions.filter((region2) => region2.type === "interactiveGrid" && region2.edit).forEach(
    (region2, i) => parts.push(
      indent(
        n("process", `save-${regionId(page, region2)}`, [
          `name: ${q("Save " + region2.name)}`,
          "type: interactiveGridAutoRowProcessing",
          `editableRegion: ${ref(regionId(page, region2))}`,
          g("advanced", `executionMappingIdentifier: ${mapping(400 + i)}`),
          g("execution", `sequence: ${(i + 1) * 10}
point: processing`)
        ])
      )
    )
  );
  page.regions.filter((region2) => "refreshOnDialogClose" in region2 && region2.refreshOnDialogClose).forEach((region2, i) => {
    const id2 = regionId(page, region2);
    parts.push(
      indent(
        n("dynamicAction", `dialog-closed-${id2}`, [
          `name: ${q("Refresh " + region2.name + " after dialog")}`,
          g("execution", `sequence: ${(page.refreshes?.length ?? 0) * 10 + (i + 1) * 10}`),
          g("when", `event: apexafterclosedialog
selectionType: region
region: ${ref(id2)}`),
          refreshAction("refresh", id2, 10)
        ])
      )
    );
  });
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
            (region2, ordinal) => refreshAction(`refresh-${ordinal + 1}`, region2, (ordinal + 1) * 10)
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
        const sources = region2.type === "chart" ? region2.series : "sql" in region2 && region2.sql ? [region2] : [];
        if (!sources.length || sources.some((source) => refresh.items.some((item2) => !source.itemsToSubmit?.includes(item2))))
          invalid(`Refresh region ${id2} must submit every triggering item on every query/series.`);
      }
    });
    for (const region2 of page.regions) {
      if ("link" in region2) checkTarget(region2.link);
      if (region2.type === "interactiveReport" || region2.type === "classicReport")
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
      for (const source of region2.type === "chart" ? region2.series : "sql" in region2 && region2.sql ? [region2] : [])
        source.itemsToSubmit?.forEach(requireItem);
      if (region2.type === "cards" && region2.link && !region2.keyColumn)
        invalid("Linked cards require a keyColumn.");
      if (region2.type === "calendar" && region2.link && !region2.keyColumn)
        invalid("Linked calendars require a keyColumn.");
      const where = `Page ${page.id} region ${regionId(page, region2)}`;
      if ((region2.type === "form" || region2.type === "interactiveGrid") && region2.edit) {
        if (!region2.authorizationScheme && !page.authorizationScheme)
          invalid(`${where} edits data: give it (or its page) an authorizationScheme.`);
        if (new Set(region2.edit.operations).size !== region2.edit.operations.length)
          invalid(`${where} lists an edit operation twice.`);
      }
      if (region2.type === "form") {
        if (!!region2.sql === !!region2.table) invalid(`${where} needs exactly one of sql or table.`);
        if (region2.edit && !region2.table) invalid(`${where} edits data and needs a table.`);
        if (region2.edit) {
          const id2 = regionId(page, region2);
          const own = (page.items ?? []).filter((item2) => item2.region === id2 && item2.sourceColumn);
          if (own.filter((item2) => item2.primaryKey).length !== 1)
            invalid(`${where} edits data and needs exactly one primaryKey item.`);
          if (region2.edit.rowVersionColumn && !own.some((item2) => item2.sourceColumn === region2.edit.rowVersionColumn))
            invalid(`${where} rowVersionColumn needs an item with that sourceColumn.`);
        }
      }
      if (region2.type === "interactiveGrid") {
        const names = region2.columns.map((column2) => column2.name);
        unique(names, "Grid columns");
        if (region2.edit) {
          if (region2.columns.filter((column2) => column2.primaryKey).length !== 1)
            invalid(`${where} edits data and needs exactly one primaryKey column.`);
          if (region2.edit.rowVersionColumn && !names.includes(region2.edit.rowVersionColumn))
            invalid(`${where} rowVersionColumn must be one of its columns.`);
        }
        const joins = region2.columns.filter((column2) => column2.masterColumn);
        if (region2.master) {
          const master = page.regions.find((other) => regionId(page, other) === region2.master);
          if (!master || master === region2 || master.type !== "interactiveGrid")
            invalid(`${where} master must be another interactive grid on page ${page.id}.`);
          if (!joins.length) invalid(`${where} is a detail grid and needs a column with masterColumn.`);
          for (const column2 of joins)
            if (master?.type === "interactiveGrid" && !master.columns.some((entry) => entry.name === column2.masterColumn))
              invalid(
                `${where} column ${column2.name} joins to unknown master column ${column2.masterColumn}.`
              );
        } else if (joins.length) invalid(`${where} uses masterColumn without a master grid.`);
      }
      if (region2.type === "facetedSearch") {
        const filtered = page.regions.find((other) => regionId(page, other) === region2.filteredRegion);
        if (!filtered || !["classicReport", "cards"].includes(filtered.type))
          invalid(`${where} must filter a classic report or cards region on page ${page.id}.`);
        if (filtered?.type === "classicReport") {
          const reportColumns = new Set(filtered.columns.map((column2) => column2.name));
          for (const facet of region2.facets)
            for (const column2 of facet.columns)
              if (!reportColumns.has(column2))
                invalid(
                  `${where} facet ${facet.item} uses ${column2}, which ${filtered.name} does not select.`
                );
        }
        for (const facet of region2.facets) {
          if (!facet.item.startsWith(`P${page.id}_`))
            invalid(`Facet ${facet.item} must belong to page ${page.id}.`);
          if (items.includes(facet.item)) invalid(`Facet ${facet.item} duplicates a page item.`);
          if (facet.type !== "search" && facet.columns.length !== 1)
            invalid(`Facet ${facet.item} (${facet.type}) filters exactly one column.`);
        }
      }
    }
    const generated = formControls(page);
    for (const control of generated) {
      if (regions2.includes(control.buttons))
        invalid(`Region id ${control.buttons} is reserved for form buttons.`);
      for (const prefix of ["cancel", "delete", "save", "create"])
        if (buttons.includes(`${prefix}-${control.form}`))
          invalid(`Button id ${prefix}-${control.form} is generated for form ${control.form}.`);
      if (buttons.length)
        unique(
          [
            ...buttons.map((id2) => id2.replaceAll("-", "_").toUpperCase()),
            "CREATE",
            "SAVE",
            "DELETE",
            "CANCEL"
          ],
          "Button request names"
        );
    }
    if (generated.length > 1) invalid(`Page ${page.id} has more than one editable form.`);
    unique(
      [
        ...items,
        ...page.regions.flatMap(
          (region2) => region2.type === "facetedSearch" ? region2.facets.map((f) => f.item) : []
        )
      ],
      "Item and facet names"
    );
  }
}
function pageGuards(page) {
  return guards2(page, void 0, "pageAccessProtection: argumentsMustHaveChecksum").map(indent).join("\n");
}

export {
  scaffoldSchema,
  renderRegion,
  renderProcess,
  renderPageBody,
  validateSpec,
  pageGuards
};
