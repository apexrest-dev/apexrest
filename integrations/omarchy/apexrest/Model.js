.pragma library

// Pure parsing for the APEXREST Omarchy panel. The helper relays project
// names, paths, review-comment text and CLI diagnostics, so everything here is
// treated as untrusted: values are bounded, typed and returned as plain
// strings. The panel renders them with Text.PlainText only.

var MAX_TEXT = 200
var MAX_PROJECTS = 12
var MAX_PREVIEWS = 16
var STATES = ["ok", "active", "warn", "crit", "error"]

function text(value, limit) {
  if (value === undefined || value === null) return ""
  var s = String(value).replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
  var max = limit || MAX_TEXT
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

// For Omarchy-owned sinks whose Text format may be AutoText (tooltips).
function noMarkup(value) {
  return text(value).replace(/[<>&]/g, " ")
}

function int(value) {
  return typeof value === "number" && isFinite(value) ? Math.round(value) : null
}

function obj(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null
}

function arr(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : []
}

function state(value) {
  return STATES.indexOf(value) >= 0 ? value : "ok"
}

function parseJson(raw) {
  if (raw === undefined || raw === null) return null
  var s = String(raw).trim()
  if (s === "" || s.length > 4 * 1024 * 1024) return null
  var start = s.lastIndexOf("\n{")
  if (start >= 0) s = s.slice(start + 1)
  try {
    return obj(JSON.parse(s))
  } catch (e) {
    return null
  }
}

function emptySnapshot() {
  return { loaded: false, error: "", at: "", durationMs: 0, version: "", state: "ok",
           previews: [], projects: [], assetsInstalled: true }
}

function localUrl(value) {
  var s = text(value, 200)
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?(\/|$)/.test(s) ? s : ""
}

function preview(raw) {
  var r = obj(raw)
  var port = r ? int(r.port) : null
  if (!r || port === null || port < 1 || port > 65535) return null
  return {
    port: port,
    url: localUrl(r.url),
    app: text(r.app, 64),
    project: text(r.project, 64),
    owner: r.owner === "cli" ? "cli" : "host",
    startedAt: text(r.startedAt, 40),
    environment: text(r.environment, 24)
  }
}

// The deployed app's run URL (<ORDS base>/f?p=<app id>); http(s) only.
function runTarget(raw) {
  var r = obj(raw)
  var url = r ? text(r.url, 300) : ""
  if (!r || !/^https?:\/\/[^\s\/?#]+[^\s]*\/f\?p=\d+$/.test(url)) return null
  return { environment: text(r.environment, 24), applicationId: int(r.applicationId), url: url }
}

function project(raw) {
  var p = obj(raw)
  if (!p || typeof p.path !== "string" || p.path.charAt(0) !== "/") return null
  var dep = obj(p.deployment)
  return {
    path: text(p.path, 400),
    name: text(p.name, 64) || "project",
    pinned: p.pinned === true,
    status: state(p.status),
    issues: arr(p.issues, 6).map(function(i) { return text(i, 160) }).filter(function(i) { return i !== "" }),
    environments: arr(p.environments, 6).map(function(e) {
      e = obj(e) || {}
      return { name: text(e.name, 24), kind: text(e.kind, 12), applicationId: int(e.applicationId) }
    }),
    changes: int(p.changes),
    jobs: int(p.jobs) || 0,
    comments: int(p.comments),
    commentItems: arr(p.commentItems, 5).map(function(c) {
      c = obj(c) || {}
      return { page: text(c.page, 16), text: text(c.text, 140) }
    }),
    previews: arr(p.previews, 8).map(int).filter(function(n) { return n !== null }),
    run: runTarget(p.run),
    deployment: dep ? { status: text(dep.status, 32), state: state(dep.state === "active" ? "active" : dep.state), at: text(dep.at, 40) } : null
  }
}

function snapshot(raw) {
  var s = parseJson(raw)
  var out = emptySnapshot()
  if (!s) {
    out.loaded = true
    out.error = "APEXREST helper returned no data"
    return out
  }
  out.loaded = true
  out.error = s.ok === false ? text(s.error, 200) || "APEXREST helper failed" : text(s.error, 200)
  out.at = text(s.at, 40)
  out.durationMs = int(s.durationMs) || 0
  out.version = text(s.version, 24)
  out.state = state(s.state)
  out.assetsInstalled = s.assetsInstalled !== false
  out.previews = arr(s.previews, MAX_PREVIEWS).map(preview).filter(function(x) { return x !== null })
  out.projects = arr(s.projects, MAX_PROJECTS).map(project).filter(function(x) { return x !== null })
  return out
}

function openComments(snap) {
  var n = 0
  for (var i = 0; i < snap.projects.length; i++) n += snap.projects[i].comments || 0
  return n
}

function previewFor(snap, proj) {
  for (var i = 0; i < snap.previews.length; i++) {
    if (proj.previews.indexOf(snap.previews[i].port) >= 0) return snap.previews[i]
  }
  return null
}

// Live pair sessions (Claude works, Codex reviews) from `apexrest-omarchy pairs`.
var MAX_PAIRS = 8
var REVIEWER_KINDS = ["watching", "reviewing", "waiting", "ok", "notes", "held", "paused", "failed", "stopped"]

function pair(raw) {
  var p = obj(raw)
  if (!p || typeof p.session !== "string" || !/^pair-[A-Za-z0-9_-]{1,64}$/.test(p.session)) return null
  return {
    session: p.session,
    project: text(p.project, 400),
    name: text(p.name, 64) || p.session,
    turn: int(p.turn) || 0,
    phase: p.phase === "working" ? "working" : "idle",
    awaiting: p.awaiting === true,
    paused: p.paused === true,
    held: p.held === true,
    reviewer: REVIEWER_KINDS.indexOf(p.reviewer) >= 0 ? p.reviewer : "watching",
    notes: arr(p.notes, 3).map(function(n) { return text(n, 260) }).filter(function(n) { return n !== "" })
  }
}

function pairs(raw) {
  var r = parseJson(raw)
  if (!r || r.ok === false) return null
  return arr(r.pairs, MAX_PAIRS).map(pair).filter(function(x) { return x !== null })
}

// Bar state contributed by pair sessions: "warn" when you need to act, "active" while working.
function pairState(list) {
  var st = ""
  for (var i = 0; i < list.length; i++) {
    var p = list[i]
    if (p.held || p.awaiting || p.reviewer === "failed" || p.reviewer === "waiting") return "warn"
    if (p.phase === "working" || p.reviewer === "reviewing") st = "active"
  }
  return st
}

function pairFor(list, proj) {
  for (var i = 0; i < list.length; i++) if (list[i].project === proj.path) return list[i]
  return null
}

// "2h", "5m", "3d"; empty when the timestamp is unreadable.
function age(iso, nowMs) {
  var t = Date.parse(iso)
  if (!isFinite(t)) return ""
  var sec = Math.max(0, Math.round((nowMs - t) / 1000))
  if (sec < 60) return sec + "s"
  if (sec < 3600) return Math.round(sec / 60) + "m"
  if (sec < 86400) return Math.round(sec / 3600) + "h"
  return Math.round(sec / 86400) + "d"
}

function envSummary(proj) {
  return proj.environments.map(function(e) {
    return e.name.toUpperCase() + (e.applicationId !== null ? " " + e.applicationId : "")
  }).join(" · ")
}

// Theme colours from colors.toml; fallbacks keep dots readable without a theme.
function palette(toml) {
  var p = { red: "#ff4141", yellow: "#ffd541", green: "#5fd18b", blue: "#31bef9" }
  var s = String(toml || "")
  function pick(keys) {
    for (var i = 0; i < keys.length; i++) {
      var m = s.match(new RegExp("^\\s*" + keys[i] + "\\s*=\\s*[\"']?(#[0-9a-fA-F]{6})", "m"))
      if (m) return m[1]
    }
    return ""
  }
  p.red = pick(["red", "color1"]) || p.red
  p.yellow = pick(["yellow", "color3"]) || p.yellow
  p.green = pick(["green", "color2"]) || p.green
  p.blue = pick(["blue", "color4"]) || p.blue
  return p
}
