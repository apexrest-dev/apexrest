import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  get,
  parseApexLang
} from "./chunk-VJRFADO6.mjs";
import {
  resourceRoot,
  sourceRelease
} from "./chunk-YI25QNSI.mjs";
import "./chunk-33BV6A47.mjs";
import {
  environment,
  parse
} from "./chunk-DFK3P5MT.mjs";
import "./chunk-MKCPTOWL.mjs";
import "./chunk-J2ZZKOUD.mjs";
import {
  external_exports
} from "./chunk-WBDBC3GS.mjs";
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
} from "./chunk-72F3ZMZP.mjs";
import {
  Fault
} from "./chunk-JVBX3L43.mjs";

// packages/core/src/scaffold.ts
import path2 from "node:path";
import { readFile as readFile2 } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// packages/core/src/scaffold-observations.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
async function scaffoldObservationsSql(env, pages) {
  const literal = (value) => {
    if (/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(value))
      throw new Fault("INVALID_INPUT", "Observation target fields must be single-line values.", 2);
    return "'" + value.replaceAll("'", "''") + "'";
  };
  if (!Number.isSafeInteger(env.applicationId) || env.applicationId < 1 || !pages.length || pages.some((id) => !Number.isInteger(id) || id < 1 || id > 9998))
    throw new Fault("INVALID_INPUT", "Observation pages must be explicit scaffold page IDs.", 2);
  const values = {
    APP: String(env.applicationId),
    PAGES: pages.join(","),
    DB: literal(env.databaseIdentity.dbUniqueName),
    SERVICE: literal(env.databaseIdentity.serviceName),
    SCHEMA: literal(env.parsingSchema),
    WORKSPACE: literal(env.workspace)
  };
  const template = await readFile(path.join(resourceRoot(), "scaffold/observations.sql"), "utf8");
  return template.replace(/__([A-Z_]+)__/g, (_all, key) => {
    const value = values[key];
    if (value === void 0)
      throw new Fault("SCAFFOLD_TEMPLATE_INVALID", "Unknown observation template field.", 3);
    return value;
  });
}

// packages/core/src/scaffold.ts
var text = external_exports.string().trim().min(1).max(240).regex(/^[^\x00-\x1f\x7f]+$/);
var column = external_exports.string().regex(/^[A-Z][A-Z0-9_$#]{0,127}$/);
var sql = external_exports.string().trim().min(1).max(16e3).refine(
  (v) => /^(?:select|with)\b/i.test(v) && !v.includes("```") && !/[\x00\r]/.test(v),
  "Supply a SELECT query without code-fence delimiters"
);
var common = { name: text, sql };
var scaffoldSchema = external_exports.strictObject({
  applicationName: text.optional(),
  pages: external_exports.array(
    external_exports.strictObject({
      id: external_exports.number().int().min(1).max(9998),
      name: text,
      regions: external_exports.array(
        external_exports.discriminatedUnion("type", [
          external_exports.strictObject({
            ...common,
            type: external_exports.literal("interactiveReport"),
            columns: external_exports.array(
              external_exports.strictObject({
                name: column,
                heading: text,
                dataType: external_exports.enum(["varchar2", "number", "date", "timestamp"]),
                formatMask: text.optional()
              })
            ).min(1).max(100),
            emptyMessage: text.optional()
          }),
          external_exports.strictObject({
            ...common,
            type: external_exports.literal("cards"),
            titleColumn: column,
            bodyColumn: column
          }),
          external_exports.strictObject({
            ...common,
            type: external_exports.literal("barChart"),
            labelColumn: column,
            valueColumn: column,
            xTitle: text,
            yTitle: text
          })
        ])
      ).min(1).max(20)
    })
  ).min(1).max(30)
});
var stateSchema = external_exports.strictObject({
  version: external_exports.literal(1),
  files: external_exports.record(external_exports.string(), external_exports.string()),
  shells: external_exports.record(external_exports.string(), external_exports.string())
});
var q = (value) => JSON.stringify(value);
var reportAlias = (index) => {
  let alias = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    alias = String.fromCharCode(65 + (n - 1) % 26) + alias;
  return alias;
};
var slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
var group = (name, body, level = 2) => `${"    ".repeat(level)}${name} {
${body}
${"    ".repeat(level)}}`;
var property = (name, value, level = 3) => `${"    ".repeat(level)}${name}: ${value}`;
var block = (head, body, level = 1) => `${"    ".repeat(level)}${head} (
${body}
${"    ".repeat(level)})`;
var source = (query, level = 2) => group(
  "source",
  [
    property("location", "localDatabase", level + 1),
    property("type", "sqlQuery", level + 1),
    property(
      "sqlQuery",
      `
${"    ".repeat(level + 2)}\`\`\`sql
` + query.split("\n").map((l) => "    ".repeat(level + 2) + l).join("\n") + `
${"    ".repeat(level + 2)}\`\`\``,
      level + 1
    )
  ].join("\n"),
  level
);
function renderRegion(region, index) {
  const p = (key, value) => property(key, value);
  const parts = [
    property("name", q(region.name), 2),
    property("type", region.type === "barChart" ? "chart" : region.type, 2)
  ];
  if (region.type !== "barChart") parts.push(source(region.sql));
  parts.push(group("layout", p("sequence", String((index + 1) * 10)) + "\n" + p("slot", "body")));
  parts.push(
    group(
      "appearance",
      p(
        "template",
        "@/" + { interactiveReport: "interactive-report", cards: "cards-container", barChart: "standard" }[region.type]
      ) + "\n" + p("templateOptions", "#DEFAULT#")
    )
  );
  if (region.type === "cards") {
    parts.push(
      group("title", p("column", region.titleColumn)),
      group("body", p("column", region.bodyColumn))
    );
  } else if (region.type === "barChart") {
    parts.push(group("security", p("escapeSpecialChars", "true")), group("chart", p("type", "bar")));
    for (const [axis, title] of [
      ["x", region.xTitle],
      ["y", region.yTitle]
    ])
      parts.push(
        block(`axis ${axis}`, property("name", axis, 3) + "\n" + property("title", q(title), 3), 2)
      );
    parts.push(
      block(
        "series values",
        [
          property("name", q(region.name), 3),
          group("execution", property("sequence", "10", 4), 3),
          source(region.sql, 3),
          group(
            "columnMapping",
            property("label", region.labelColumn, 4) + "\n" + property("value", region.valueColumn, 4),
            3
          )
        ].join("\n"),
        2
      )
    );
  } else {
    if (new Set(region.columns.map((c) => c.name)).size !== region.columns.length)
      throw new Fault("INVALID_INPUT", "Report column names must be unique.", 2);
    parts.push(
      group("pagination", p("type", "rowRangesXToYOfZ")),
      group(
        "messages",
        p("whenNoDataFound", q(region.emptyMessage ?? "No rows found. Clear filters or add source data."))
      ),
      group("link", p("linkColumn", "exclude"))
    );
    for (const [i, c] of region.columns.entries()) {
      const body = [
        property("type", "plainText", 3),
        group("heading", property("heading", q(c.heading), 4), 3),
        group("layout", property("sequence", String(i + 1), 4), 3),
        group("source", property("dataType", c.dataType, 4), 3),
        group("advanced", property("endUserAlias", reportAlias(i), 4), 3)
      ];
      if (i === 0) body.push(group("accessibility", property("valueIdentifiesRow", "true", 4), 3));
      if (c.formatMask) body.push(group("appearance", property("formatMask", q(c.formatMask), 4), 3));
      parts.push(block(`column ${c.name}`, body.join("\n"), 2));
    }
    parts.push(
      block(
        "savedReport 1001",
        [
          property("visibility", "primaryDefault", 3),
          group("view", property("rowsPerPage", "25", 4), 3),
          ...region.columns.map(
            (c, i) => block(`displayColumn ${c.name}`, property("sequence", String(i + 1), 4), 3)
          )
        ].join("\n"),
        2
      )
    );
  }
  return block(`region r${index + 1}`, parts.join("\n"));
}
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
  const target = name ? environment(ctx, name) : void 0;
  if (new Set(spec.pages.map((p) => p.id)).size !== spec.pages.length)
    throw new Fault("INVALID_INPUT", "Page IDs must be unique.", 2);
  const root = await contained(ctx.root, ctx.config.application.sourceDir);
  if (await sourceRelease(root) !== "26.2")
    throw new Fault(
      "SCAFFOLD_RELEASE_UNSUPPORTED",
      "Scaffolding requires an Oracle-generated 26.2 application.",
      3
    );
  return withLock(await contained(ctx.root, ".apexrest/scaffold.lock"), async () => {
    const stateFile = await contained(ctx.root, ".apexrest/scaffold.json");
    const state = await exists(stateFile) ? parse(stateSchema, await readJson(stateFile)) : { version: 1, files: {}, shells: {} };
    const before = await inventory(root), writes = {};
    const conflict = (name2) => new Fault(
      "LOCAL_EDITS_CONFLICT",
      `Scaffold cannot replace unowned or edited source: ${name2}. Preserve the file and edit it manually.`,
      5,
      "conflict"
    );
    const navFile = "shared-components/lists/navigation-menu.apx";
    const navigation = await readFile2(await contained(root, navFile), "utf8");
    const nav = parseApexLang(navigation, navFile);
    if (nav.length !== 1 || nav[0].type !== "list" || nav[0].id !== "navigation-menu")
      throw conflict(navFile);
    let navText = navigation;
    for (const page of spec.pages) {
      const files = Object.keys(before).filter(
        (f) => f.startsWith("pages/") && /^p\d+-/.test(path2.basename(f)) && Number(/^p(\d+)-/.exec(path2.basename(f))?.[1]) === page.id
      );
      if (files.length > 1) throw conflict(`page ${page.id}`);
      const name2 = files[0] ?? `pages/p${String(page.id).padStart(5, "0")}-${slug(page.name)}.apx`;
      const body = page.regions.map(renderRegion).join("\n\n");
      if (files[0] && !state.files[name2]) {
        const old = await readFile2(await contained(root, name2), "utf8");
        const [home, ...extra] = parseApexLang(old, name2);
        if (page.id !== 1 || extra.length || home?.type !== "page" || home.id !== "1" || home.children.length !== 1 || home.children[0].id !== "app-name" || home.children[0].props.type !== "staticContent" || home.props.name !== page.name)
          throw conflict(name2);
        const at = old.lastIndexOf(")");
        state.shells[name2] = old;
        writes[name2] = old.slice(0, at) + body + "\n" + old.slice(at);
      } else {
        if (files[0] && state.files[name2] !== before[name2]) throw conflict(name2);
        const shell = state.shells[name2];
        writes[name2] = shell ? shell.slice(0, shell.lastIndexOf(")")) + body + "\n" + shell.slice(shell.lastIndexOf(")")) : block(
          `page ${page.id}`,
          [
            property("name", q(page.name), 1),
            property(
              "alias",
              q(
                path2.basename(name2).replace(/^p\d+-/, "").replace(/\.apx$/, "").toUpperCase()
              ),
              1
            ),
            property("title", q(page.name), 1),
            group(
              "appearance",
              property("pageTemplate", "@/standard", 2) + "\n" + property("templateOptions", "#DEFAULT#", 2),
              1
            ),
            body
          ].join("\n"),
          0
        ) + "\n";
      }
      const entry = nav[0].children.find(
        (e) => e.type === "entry" && String(get(e.props, "link.target.page")) === String(page.id)
      );
      if (!entry) {
        const id = `scaffold-p${page.id}`;
        if (nav[0].children.some((e) => e.id === id)) throw conflict(navFile);
        const addition = block(
          `entry ${id}`,
          [
            property("label", q(page.name), 2),
            group("layout", property("sequence", String(page.id + 10), 3)),
            group("link", group("target:", property("page", String(page.id), 4), 3))
          ].join("\n")
        );
        const at = navText.lastIndexOf(")");
        navText = navText.slice(0, at) + addition + "\n" + navText.slice(at);
      }
    }
    if (navText !== navigation) writes[navFile] = navText;
    if (spec.applicationName) {
      const name2 = "application.apx";
      const original = await readFile2(await contained(root, name2), "utf8");
      if (!/^    name: .+$/m.test(original)) throw conflict(name2);
      writes[name2] = original.replace(/^    name: .+$/m, () => "    name: " + q(spec.applicationName));
    }
    for (const [name2, value] of Object.entries(writes)) parseApexLang(value, name2);
    const stage = await contained(ctx.root, `.apexrest/scaffolds/${randomUUID()}`);
    const observationsFile = path2.join(stage, "observations.sql");
    if (target)
      await atomicWrite(
        observationsFile,
        await scaffoldObservationsSql(
          target,
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
    for (const [name2, value] of Object.entries(writes)) {
      const target2 = await contained(root, name2);
      const current = await exists(target2) ? hash(await readFile2(target2)) : void 0;
      if (current !== before[name2])
        throw new Fault("SOURCE_DRIFT", `Source changed before writing ${name2}; staged copies retained.`, 5);
      await atomicWrite(target2, value);
      state.files[name2] = hash(value);
    }
    await writeJson(stateFile, state);
    return {
      files: Object.keys(writes),
      pages: spec.pages.map((p) => ({ id: p.id, name: p.name })),
      sourceDigest: hash(canonical(await inventory(root))),
      compilerValidation: "required-by-ship",
      nextAction: "apexrest_ship mode:apply",
      stage: path2.relative(ctx.root, stage),
      ...target ? {
        readback: {
          sqlFile: path2.relative(ctx.root, observationsFile),
          environment: name,
          connectionRef: target.readConnectionRef,
          purpose: "Only if requested: manually execute read-only metadata/query observations after import. Not executed by scaffold or ship."
        }
      } : {}
    };
  });
}
export {
  renderRegion,
  scaffold,
  scaffoldSchema
};
