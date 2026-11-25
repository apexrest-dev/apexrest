import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  pageGuards,
  renderPageBody,
  renderProcess,
  scaffoldSchema,
  validateSpec
} from "./chunk-BBZ43UIE.mjs";
import {
  declarations,
  editSpans,
  get,
  parseApexLang
} from "./chunk-C66KGFY2.mjs";
import {
  resourceRoot,
  sourceRelease
} from "./chunk-JI42DR2Q.mjs";
import {
  environment,
  parse
} from "./chunk-O3XZW7YC.mjs";
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
} from "./chunk-YLKYRT24.mjs";
import {
  Fault,
  external_exports
} from "./chunk-HRRL6FHO.mjs";

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
var stateSchema = external_exports.strictObject({
  version: external_exports.literal(1),
  files: external_exports.record(external_exports.string(), external_exports.string()),
  shells: external_exports.record(external_exports.string(), external_exports.string()),
  navigation: external_exports.record(external_exports.string(), external_exports.string()).optional()
});
var q = (value) => JSON.stringify(value);
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
  const specDigest = hash(raw);
  return scaffoldSpec(ctx, parse(scaffoldSchema, input), raw, name, async () => {
    if (hash(await readFile2(file, "utf8")) !== specDigest)
      throw new Fault(
        "SOURCE_DRIFT",
        "The scaffold specification changed before writing; the staged exact input is retained.",
        5
      );
  });
}
async function scaffoldSpec(ctx, spec, raw, name, recheck) {
  const specDigest = hash(raw);
  const target = name ? environment(ctx, name) : void 0;
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
    for (const file of Object.keys(before).filter(
      (name2) => name2.startsWith("pages/") && name2.endsWith(".apx")
    )) {
      for (const node of parseApexLang(await readFile2(await contained(root, file), "utf8"), file)) {
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
        state.shells[name2] = old.replace(/^    name: .+$/m, () => "    name: " + q(page.name)).replace(/^    title: .+$/m, () => "    title: " + q(page.name));
        const shell = state.shells[name2];
        const close = shell.lastIndexOf(")");
        writes[name2] = shell.slice(0, close) + body + "\n" + shell.slice(close);
      } else {
        if (files[0] && state.files[name2] !== before[name2]) throw conflict(name2);
        let shell = state.shells[name2];
        if (shell) {
          if (page.alias && page.alias !== parseApexLang(shell, name2)[0]?.props.alias)
            throw conflict("existing Home page alias");
          shell = shell.replace(/^    name: .+$/m, () => "    name: " + q(page.name)).replace(/^    title: .+$/m, () => "    title: " + q(page.name));
          state.shells[name2] = shell;
        }
        writes[name2] = shell ? shell.slice(0, shell.lastIndexOf(")")) + body + "\n" + shell.slice(shell.lastIndexOf(")")) : block(
          `page ${page.id}`,
          [
            property("name", q(page.name), 1),
            property(
              "alias",
              // The compiler requires upper-case aliases (VALUE_NOT_UPPERCASE), given or derived.
              q(
                (page.alias ?? path2.basename(name2).replace(/^p\d+-/, "").replace(/\.apx$/, "")).toUpperCase()
              ),
              1
            ),
            property("title", q(page.name), 1),
            group(
              "appearance",
              (page.mode === "modalDialog" ? property("pageMode", "modalDialog", 2) + "\n" + property("dialogTemplate", "@/modal-dialog", 2) : property("pageTemplate", "@/standard", 2)) + "\n" + property("templateOptions", "#DEFAULT#", 2),
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
      if ((page.navigation ?? page.mode !== "modalDialog") === false) {
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
        const content = old.replace(/^        label: .+$/m, () => "        label: " + q(page.name));
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
        const id = `scaffold-p${page.id}`;
        if (menu.children.some((e) => e.id === id)) throw conflict(navFile);
        const addition = block(
          `entry ${id}`,
          [
            property("label", q(page.name), 2),
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
          (node) => node.kind === "entry" && node.key === id && scope && node.start > scope.start && node.end < scope.end
        );
        if (!added) throw conflict(navFile);
        ownedNavigation[id] = hash(navText.slice(added.start, added.end));
      }
    }
    if (navText !== navigation) writes[navFile] = navText;
    if (spec.applicationProcesses !== void 0) {
      const file = "shared-components/app-processes.apx";
      if (state.files[file] && state.files[file] !== before[file]) throw conflict(file);
      const old = before[file] ? await readFile2(await contained(root, file), "utf8") : "";
      const shell = state.shells[file] ?? old;
      for (const source of Object.keys(before).filter((name2) => name2.endsWith(".apx"))) {
        const text = source === file ? shell : await readFile2(await contained(root, source), "utf8");
        if (!/\bappProcess\s/.test(text)) continue;
        const nodes = parseApexLang(text, source);
        const found = (list) => list.some(
          (node) => node.type === "appProcess" && spec.applicationProcesses.some((process) => process.id === node.id) || found(node.children)
        );
        if (found(nodes)) throw conflict(source);
      }
      state.shells[file] = shell;
      writes[file] = shell + (spec.applicationProcesses.length ? "\n" : "") + spec.applicationProcesses.map((value, i) => renderProcess({ ...value, sequence: value.sequence ?? (i + 1) * 10 }, i, true)).join("\n");
    }
    if (spec.applicationName) {
      const name2 = "application.apx";
      const original = await readFile2(await contained(root, name2), "utf8");
      if (!/^    name: .+$/m.test(original)) throw conflict(name2);
      writes[name2] = original.replace(/^    name: .+$/m, () => "    name: " + q(spec.applicationName));
    }
    const executionIds = /* @__PURE__ */ new Map();
    for (const source of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(writes)])) {
      if (!source.endsWith(".apx")) continue;
      const text = writes[source] ?? await readFile2(await contained(root, source), "utf8");
      if (!text.includes("executionMappingIdentifier")) continue;
      const nodes = parseApexLang(text, source);
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
        const keys = list.filter((node) => node.id).map((node) => `${node.type}:${node.id}`);
        if (new Set(keys).size !== keys.length) throw conflict(`duplicate components in ${name2}`);
        list.forEach((node) => unique(node.children));
      };
      unique(nodes);
    }
    const stage = await contained(ctx.root, `.apexrest/scaffolds/${randomUUID()}`);
    await atomicWrite(path2.join(stage, "spec.json"), raw);
    const observationsFile = path2.join(stage, "observations.sql");
    if (target && release === "26.2")
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
    await recheck();
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
      specDigest,
      compilerValidation: "required-by-ship",
      nextAction: "apexrest_ship mode:apply",
      stage: path2.relative(ctx.root, stage),
      ...target && release === "26.2" ? {
        readback: {
          sqlFile: path2.relative(ctx.root, observationsFile),
          environment: name,
          connectionRef: target.readConnectionRef,
          purpose: "Only if requested: manually execute read-only metadata/query observations after import. Not executed by scaffold or ship."
        }
      } : {},
      ...target && release === "26.1" ? {
        readbackUnavailable: "The optional scaffold SQL observations are qualified for 26.2 only. Use scoped metadata reads for 26.1."
      } : {}
    };
  });
}

export {
  scaffold,
  scaffoldSpec
};
