.pragma library

// Pure parsing for the APEXREST Omarchy panel. Everything here treats its
// input as untrusted: the helper relays CLI output, which echoes project
// files, Git paths and Oracle messages. Values are bounded, typed and plain
// strings; the panel renders them with Text.PlainText only.

var MAX_TEXT = 160
var MAX_ENVIRONMENTS = 8
var MAX_PREVIEWS = 6
var MAX_RECENT = 5
var MAX_CONNECTIONS = 12

function text(value, limit) {
  if (value === undefined || value === null) return ""
  var s = String(value).replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
  var max = limit || MAX_TEXT
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

function firstLine(value, limit) {
  if (value === undefined || value === null) return ""
  var lines = String(value).split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    // Oracle compiler summaries open with a generic header; the useful text
    // is on the "Error:" line.
    if (/^Error:/.test(line)) return text(line.replace(/^Error:\s*/, ""), limit)
  }
  for (var j = 0; j < lines.length; j++) {
    if (lines[j].trim() !== "") return text(lines[j], limit)
  }
  return ""
}

function parseJson(raw) {
  if (raw === undefined || raw === null) return null
  var s = String(raw).trim()
  if (s === "" || s.length > 4 * 1024 * 1024) return null
  // The helper prints exactly one JSON line; tolerate stray leading output.
  var start = s.lastIndexOf("\n{")
  if (start >= 0) s = s.slice(start + 1)
  try {
    var value = JSON.parse(s)
    return value !== null && typeof value === "object" ? value : null
  } catch (e) {
    return null
  }
}

function obj(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null
}

function count(value) {
  return typeof value === "number" && isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/[^\s"'<>]+$/.test(value) && value.length <= 2048
}

function isAbsolutePath(value) {
  return typeof value === "string" && value.length > 1 && value.length <= 4096 && value.charAt(0) === "/" && value.indexOf("\n") < 0
}

function refName(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(value) ? value : ""
}

function pinnedProject(value) {
  var s = typeof value === "string" ? value.trim().replace(/\/+$/, "") : ""
  return isAbsolutePath(s) ? s : ""
}

function baseName(path) {
  var s = String(path || "").replace(/\/+$/, "")
  var i = s.lastIndexOf("/")
  return text(i >= 0 ? s.slice(i + 1) : s, 48)
}

function sameDir(a, b) {
  var x = String(a || "").replace(/\/+$/, "")
  var y = String(b || "").replace(/\/+$/, "")
  return x !== "" && (x === y || x.indexOf(y + "/") === 0)
}

function data(result) {
  var r = obj(result)
  return r && r.ok === true ? obj(r.data) : null
}

function emptySnapshot() {
  return {
    loaded: false,
    cliFound: false,
    cli: "",
    error: "",
    version: "",
    settingsSupported: false,
    runtime: { node: "", java: "", sqlcl: "", ready: false },
    decisions: { enabled: false, apiKeyEnv: "OPENAI_API_KEY", keyInEnvironment: false },
    catalog: {
      enabled: true,
      references: 0,
      components: 0,
      patterns: 0
    },
    sqlcl: { mode: "", transport: "direct", restrictLevel: "" },
    connections: [],
    previewAssets: false,
    previews: [],
    recent: [],
    project: null
  }
}

// raw: the helper's `snapshot` line.
function snapshot(raw) {
  var out = emptySnapshot()
  var doc = parseJson(raw)
  if (!doc) {
    out.error = "APEXREST returned no readable status."
    return out
  }
  out.loaded = true
  out.cli = text(doc.cli, 300)
  out.cliFound = out.cli !== ""
  if (doc.ok === false) out.error = text(doc.error, 300)

  var version = data(doc.version)
  if (version) out.version = text(version.version, 24)

  var doctor = data(doc.doctor)
  var components = doctor ? obj(doctor.managedComponents) : null
  if (components) {
    out.runtime.node = text(components.node, 16)
    out.runtime.java = text(components.java, 16)
    out.runtime.sqlcl = text(components.sqlcl, 16)
    out.runtime.ready = out.runtime.java === "verified" && out.runtime.sqlcl === "verified"
  }

  var settings = data(doc.settings)
  if (settings) {
    out.settingsSupported = true
    var d = obj(settings.decisionApi) || {}
    out.decisions.enabled = d.enabled === true
    out.decisions.apiKeyEnv = text(d.apiKeyEnv, 64) || "OPENAI_API_KEY"
    out.decisions.keyInEnvironment = d.keyInEnvironment === true
    var c = obj(settings.catalog) || {}
    var refs = obj(c.references) || {}
    out.catalog.enabled = c.enabled !== false
    out.catalog.references = count(refs["26.1"]) + count(refs["26.2"])
    out.catalog.components = count(c.components)
    out.catalog.patterns = count(c.patterns)
    var recent = Array.isArray(settings.recentProjects) ? settings.recentProjects : []
    for (var i = 0; i < recent.length && out.recent.length < MAX_RECENT; i++) {
      var r = obj(recent[i])
      if (!r || !isAbsolutePath(r.path)) continue
      out.recent.push({ path: r.path, name: text(r.projectId, 48) || baseName(r.path), at: text(r.at, 40) })
    }
  }

  var sqlcl = data(doc.sqlcl)
  if (sqlcl) {
    out.sqlcl.mode = sqlcl.mode === "mcp" ? "mcp" : "cli"
    out.sqlcl.transport = sqlcl.databaseTransport === "ords" ? "ords" : "direct"
    out.sqlcl.restrictLevel = text(sqlcl.mcpRestrictLevel, 4)
  }

  var connections = data(doc.connections)
  if (connections) {
    var names = Object.keys(connections)
    for (var k = 0; k < names.length && out.connections.length < MAX_CONNECTIONS; k++) {
      var ref = refName(names[k])
      var entry = obj(connections[names[k]])
      if (!ref || !entry) continue
      out.connections.push({ name: ref, kind: text(entry.kind, 24), target: text(entry.name || entry.url || "", 80) })
    }
  }

  var preview = data(doc.preview)
  if (preview) {
    out.previewAssets = preview.assetsInstalled === true
    var running = Array.isArray(preview.running) ? preview.running : []
    for (var p = 0; p < running.length && out.previews.length < MAX_PREVIEWS; p++) {
      var pr = obj(running[p])
      if (!pr || !isHttpUrl(pr.url)) continue
      var port = count(pr.port)
      if (port < 1 || port > 65535) continue
      out.previews.push({ url: pr.url, port: port, app: baseName(pr.sourceDir), sourceDir: isAbsolutePath(pr.sourceDir) ? pr.sourceDir : "" })
    }
  }

  out.project = project(doc.current, doc.project)
  return out
}

// The current project's read-only snapshot (apexrest panel status).
function project(result, path) {
  if (!isAbsolutePath(path)) return null
  var out = {
    path: path,
    name: baseName(path),
    configured: false,
    error: "",
    profile: "",
    decisionOverride: "",   // "", "on" or "off": a project decisionApi wins over the global default
    environments: [],
    lastDeployment: null
  }
  var r = obj(result)
  if (!r) {
    out.error = "Project status unavailable."
    return out
  }
  if (r.ok !== true) {
    var diag = Array.isArray(r.diagnostics) && r.diagnostics.length ? r.diagnostics[0] : null
    out.error = firstLine((diag && diag.message) || r.summary || "Project status unavailable.")
    return out
  }
  var d = obj(r.data) || {}
  out.configured = d.configured === true
  var cfg = obj(d.configuration) || {}
  var app = obj(cfg.application) || {}
  out.name = text(app.alias || cfg.projectId, 48) || out.name
  var toolchain = obj(cfg.toolchain) || {}
  out.profile = toolchain.profile === "26.2" ? "26.2" : "26.1"
  var decision = obj(cfg.decisionApi)
  if (decision) out.decisionOverride = decision.enabled === true ? "on" : "off"
  var envs = obj(cfg.environments) || {}
  var names = Object.keys(envs)
  for (var i = 0; i < names.length && out.environments.length < MAX_ENVIRONMENTS; i++) {
    var name = refName(names[i])
    var e = obj(envs[names[i]])
    if (!name || !e) continue
    var kind = text(e.kind, 12).toLowerCase()
    out.environments.push({
      name: name,
      kind: kind,
      deployable: kind === "dev" || kind === "development" || kind === "qa" || kind === "test",
      readRef: refName(e.readConnectionRef),
      deployRef: refName(e.deployConnectionRef),
      workspace: text(e.workspace, 64),
      applicationId: typeof e.applicationId === "number" && isFinite(e.applicationId) ? String(Math.floor(e.applicationId)) : ""
    })
  }
  var deps = Array.isArray(d.deployments) ? d.deployments : []
  if (deps.length && obj(deps[0])) out.lastDeployment = { status: text(deps[0].status, 24), at: text(deps[0].at, 40) }
  return out
}

// raw: `apexrest connection list --saved --json` relayed by the helper.
function savedConnections(raw) {
  var d = data(parseJson(raw))
  var list = d && Array.isArray(d.connections) ? d.connections : []
  var out = []
  for (var i = 0; i < list.length && out.length < MAX_CONNECTIONS; i++) {
    var c = obj(list[i])
    var name = c ? text(c.name, 80) : ""
    if (name) out.push(name)
  }
  return out
}

// raw: `apexrest apex validate --json` relayed by the helper.
function validation(raw) {
  var doc = parseJson(raw)
  if (!doc) return { ok: false, errors: 1, message: "Validation returned no readable result." }
  var diags = Array.isArray(doc.diagnostics) ? doc.diagnostics : []
  var errors = 0
  var first = ""
  for (var i = 0; i < diags.length; i++) {
    var d = diags[i] || {}
    if (d.severity !== "error") continue
    errors++
    if (!first) {
      var where = d.file ? text(d.file, 60) + (d.line ? ":" + Math.floor(Number(d.line) || 0) : "") + " " : ""
      first = where + firstLine(d.message, 120)
    }
  }
  var ok = doc.ok === true && errors === 0
  if (!ok && errors === 0) errors = 1
  return { ok: ok, errors: errors, message: ok ? "" : (first || firstLine(doc.summary || doc.error, 140) || "Validation failed.") }
}

// raw: any single APEXREST JSON result.
function actionResult(raw) {
  var doc = parseJson(raw)
  if (!doc) return { ok: false, message: "No readable result." }
  if (doc.ok === true) return { ok: true, message: "" }
  var d = Array.isArray(doc.diagnostics) && doc.diagnostics.length ? doc.diagnostics[0] : null
  return { ok: false, message: firstLine((d && d.message) || doc.summary || doc.error || "Failed.", 160) }
}

// ISO timestamp → compact age ("4m", "3h", "2d"); "" when unreadable.
function age(iso, nowMs) {
  var t = Date.parse(String(iso || ""))
  if (!isFinite(t)) return ""
  var s = Math.max(0, Math.round(((nowMs || Date.now()) - t) / 1000))
  if (s < 60) return s + "s"
  if (s < 3600) return Math.floor(s / 60) + "m"
  if (s < 86400) return Math.floor(s / 3600) + "h"
  return Math.floor(s / 86400) + "d"
}

function hostPort(url) {
  var m = /^https?:\/\/([^/]+)/.exec(String(url || ""))
  return m ? text(m[1], 64) : ""
}

function previewOf(snap, projectPath) {
  for (var i = 0; i < snap.previews.length; i++)
    if (sameDir(snap.previews[i].sourceDir, projectPath)) return snap.previews[i]
  return null
}

// Agent prompt starters. Each is a literal request the user makes by clicking;
// the agent's own APEXREST safeguards (plan, backup, DEV/QA/TEST only) apply.
function agentPrompt(kind, env) {
  if (kind === "validate") return "Validate this APEX application with apexrest and fix every compiler error in the changed files."
  if (kind === "ship" && refName(env)) return "Ship the current APEX changes to the " + env + " environment with apexrest, then report the deployment outcome."
  return ""
}
