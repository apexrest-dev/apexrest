import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Model.js" as Model

// APEXREST in the Omarchy bar. A Python helper (bin/apexrest-omarchy) reads
// local APEXREST state through the CLI's read-only JSON commands: running
// previews, recent projects with their Git changes, sync and deployment
// journal, and open review comments. From the panel you can open or stop a
// local preview, start one (Node.js and SQLite, no database), or open a
// terminal, Claude Code or Codex in a project. It never deploys, imports,
// restores or opens a database session.
Panel {
  id: root
  moduleName: "apexrest"
  ipcTarget: "apexrest"
  manageIpc: false

  ShellIpc {
    target: "apexrest"
    function open() { root.open() }
    function close() { root.close() }
    function toggle() { root.toggle() }
    function refresh() { root.refresh() }
  }

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  function localPath(rel) {
    return decodeURIComponent(String(Qt.resolvedUrl(rel)).replace(/^file:\/\//, ""))
  }
  readonly property string helper: localPath("bin/apexrest-omarchy")

  readonly property int refreshIntervalSec: Number(setting("refreshIntervalSec", 60)) || 0
  readonly property bool notifications: setting("notifications", true) !== false
  readonly property int maxProjects: Math.max(1, Math.min(12, Number(setting("maxProjects", 6)) || 6))
  readonly property bool includeTemp: setting("includeTempProjects", false) === true
  readonly property var pinned: {
    var v = setting("projects", [])
    return Array.isArray(v) ? v.filter(function(p) { return typeof p === "string" && p !== "" }).slice(0, 12) : []
  }

  property var snap: Model.emptySnapshot()
  property string busy: ""
  property string notice: ""
  property double nowMs: Date.now()

  readonly property int liveCount: snap.previews.length
  readonly property int commentCount: Model.openComments(snap)
  readonly property string state: snap.loaded ? snap.state : "ok"

  readonly property string barLabel: {
    if (state === "crit" || state === "error") return "!"
    if (commentCount > 0) return String(commentCount)
    if (liveCount > 0) return String(liveCount)
    return ""
  }

  // Traffic-light colours from the current theme (red / yellow / green / blue).
  property var lights: Model.palette("")
  FileView {
    id: themeColors
    path: Commons.Color.currentThemePath + "/colors.toml"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.lights = Model.palette(text())
  }
  Connections {
    target: Commons.Color
    function onUrgentChanged() { themeColors.reload() }
    function onAccentChanged() { themeColors.reload() }
  }

  function colorFor(st) {
    if (st === "crit" || st === "error") return root.lights.red
    if (st === "warn") return root.lights.yellow
    if (st === "active") return root.lights.blue
    if (st === "live" || st === "ok") return root.lights.green
    return Commons.Color.muted
  }

  readonly property string badgeState: {
    if (state === "crit" || state === "error") return "crit"
    if (commentCount > 0) return "warn"
    if (state === "active") return "active"
    if (liveCount > 0) return "live"
    return ""
  }

  readonly property string heroStatus: {
    if (!snap.loaded) return strings.t("status.loading")
    if (snap.error && snap.projects.length === 0) return strings.t("status.error")
    var parts = []
    if (liveCount) parts.push(strings.tn("count.previews", liveCount).arg(liveCount))
    if (commentCount) parts.push(strings.tn("count.comments", commentCount).arg(commentCount))
    var bad = snap.projects.filter(function(p) { return p.status === "crit" || p.status === "error" }).length
    if (bad) parts.push(strings.tn("count.attention", bad).arg(bad))
    if (!parts.length) parts.push(strings.t("status.idle"))
    return parts.join(" · ")
  }

  function refresh() {
    nowMs = Date.now()
    if (snapshotProc.running) return
    if (busy === "") busy = "refresh"
    var cmd = ["python3", "-I", helper, "snapshot", "--max", String(maxProjects)]
    pinned.forEach(function(p) { cmd.push("--pin", p) })
    if (includeTemp) cmd.push("--include-temp")
    if (notifications) cmd.push("--notify")
    snapshotProc.command = cmd
    snapshotProc.running = true
  }

  function act(kind, args, closeAfter) {
    if (actionProc.running) return
    notice = ""
    busy = kind
    actionProc.kind = kind
    actionProc.command = ["python3", "-I", helper].concat(args)
    actionProc.running = true
    if (closeAfter) root.close()
  }

  Process {
    id: cachedProc
    command: ["python3", "-I", root.helper, "cached"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var s = Model.snapshot(text)
        if (!s.error && !root.snap.loaded) root.snap = s
      }
    }
  }

  Process {
    id: snapshotProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.snap = Model.snapshot(text)
    }
    onExited: if (root.busy === "refresh") root.busy = ""
  }

  Process {
    id: actionProc
    property string kind: ""
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var r = Model.parseJson(text)
        if (!r || r.ok === false) root.notice = r ? Model.text(r.error) : strings.t("notice.failed")
        else if (actionProc.kind === "start" && Model.localUrl(r.url) !== "")
          root.notice = strings.t("notice.started").arg(Model.localUrl(r.url))
      }
    }
    onExited: {
      var k = actionProc.kind
      root.busy = ""
      if (k === "start" || k === "stop") root.refresh()
    }
  }

  Timer {
    interval: Math.max(15, root.refreshIntervalSec) * 1000
    running: root.refreshIntervalSec > 0
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  Timer {
    interval: 30000
    running: root.opened
    repeat: true
    onTriggered: root.nowMs = Date.now()
  }

  Component.onCompleted: cachedProc.running = true
  onOpenedChanged: if (opened) refresh()

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    labelText: !vertical ? root.barLabel : ""
    slotSize: Style.bar.iconSlot * (root.barLabel !== "" && !vertical ? 1.6 : 1)
    tooltipText: Model.noMarkup("APEXREST · " + root.heroStatus)
    iconComponent: Component {
      Item {
        ApexrestMark {
          x: (parent.width - width) / 2
          y: (parent.height - height) / 2
          size: button.iconSize
          outline: root.bar.foreground
          // Full colour while something is live or needs you; quieter when idle.
          idle: root.badgeState === ""
          badge: root.badgeState
          badgeColor: root.colorFor(root.badgeState)
          badgeRing: root.bar.background
        }
      }
    }
    onPressed: function(b) {
      if (b === Qt.MiddleButton) root.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: panel.loadedContent
    contentWidth: panel.fittedContentWidth(Style.space(460))
    contentHeight: panel.fittedContentHeight(panel.loadedContentHeight)

    content: PanelKeyCatcher {
      anchors.fill: parent
      implicitHeight: column.implicitHeight
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: column.implicitHeight
        clip: contentHeight > height
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: column
          width: parent.width
          spacing: Style.space(12)

          // ---------- Hero ----------
          Item {
            width: parent.width
            implicitHeight: Math.max(heroIcon.height, heroLabels.implicitHeight)

            ApexrestMark {
              id: heroIcon
              size: Style.font.display * 1.5
              outline: root.bar.foreground
              badge: root.badgeState
              badgeColor: root.colorFor(root.badgeState)
              badgeRing: Commons.Color.popups.background
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
            }

            Column {
              id: heroLabels
              anchors.left: heroIcon.right
              anchors.leftMargin: Style.space(14)
              anchors.right: heroActions.left
              anchors.rightMargin: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(2)

              PlainText {
                text: "APEXREST"
                font.pixelSize: Style.font.title
                font.bold: true
                font.letterSpacing: 0.6
              }
              PlainText {
                text: root.heroStatus.toUpperCase()
                color: root.badgeState === "" ? root.bar.foreground : root.colorFor(root.badgeState)
                font.pixelSize: Style.font.caption
                font.bold: true
                font.letterSpacing: 1.2
                elide: Text.ElideRight
                width: parent.width
              }
              PlainText {
                visible: root.snap.at !== ""
                text: strings.t("status.checked")
                  .arg(root.snap.version || "?")
                  .arg(Model.age(root.snap.at, root.nowMs) || "—")
                opacity: 0.6
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
                width: parent.width
              }
            }

            Row {
              id: heroActions
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(2)
              PanelActionButton {
                iconText: root.busy === "refresh" ? "󰔟" : "󰑐"
                tooltipText: strings.t("tip.refresh")
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                enabled: root.busy === ""
                onClicked: root.refresh()
              }
            }
          }

          PlainText {
            visible: root.snap.error !== ""
            width: parent.width
            wrapMode: Text.Wrap
            color: Commons.Color.urgent
            font.pixelSize: Style.font.bodySmall
            text: root.snap.error
          }

          PlainText {
            visible: root.snap.loaded && !root.snap.assetsInstalled
            width: parent.width
            wrapMode: Text.Wrap
            opacity: 0.75
            font.pixelSize: Style.font.caption
            text: strings.t("hint.assets")
          }

          // ---------- Live previews ----------
          Column {
            visible: root.snap.previews.length > 0
            width: parent.width
            spacing: Style.space(6)
            PanelSectionHeader { text: strings.t("section.previews"); foreground: root.bar.foreground; fontFamily: root.bar.fontFamily }
            Repeater {
              model: root.snap.previews
              PreviewRow { required property var modelData; preview: modelData }
            }
          }

          PanelSeparator { visible: root.snap.previews.length > 0; foreground: root.bar.foreground }

          // ---------- Projects ----------
          Column {
            width: parent.width
            spacing: Style.space(10)
            PanelSectionHeader { text: strings.t("section.projects"); foreground: root.bar.foreground; fontFamily: root.bar.fontFamily }
            PlainText {
              visible: root.snap.loaded && root.snap.projects.length === 0 && root.snap.error === ""
              width: parent.width
              wrapMode: Text.Wrap
              opacity: 0.7
              font.pixelSize: Style.font.bodySmall
              text: strings.t("empty.projects")
            }
            Repeater {
              model: root.snap.projects
              ProjectRow { required property var modelData; project: modelData }
            }
          }

          PlainText {
            visible: root.notice !== ""
            text: root.notice
            width: parent.width
            wrapMode: Text.Wrap
            maximumLineCount: 4
            elide: Text.ElideRight
            opacity: 0.8
            font.pixelSize: Style.font.caption
          }

          PlainText {
            width: parent.width
            wrapMode: Text.Wrap
            opacity: 0.45
            font.pixelSize: Style.font.caption
            text: strings.t("footer.safety")
          }
        }
      }
    }
  }

  // ---------- Components ----------

  component PlainText: Text {
    textFormat: Text.PlainText
    color: root.bar.foreground
    font.family: root.bar.fontFamily
  }

  component StatusDot: Rectangle {
    property string status: "ok"
    implicitWidth: Style.space(9)
    implicitHeight: implicitWidth
    width: implicitWidth
    height: implicitHeight
    radius: width / 2
    color: status === "idle" ? "transparent" : root.colorFor(status)
    border.width: status === "idle" ? Math.max(1, Style.spacing.hairline) : 0
    border.color: Commons.Color.muted
  }

  component ActionButton: PanelActionButton {
    foreground: root.bar.foreground
    fontFamily: root.bar.fontFamily
  }

  // One running preview: app, project, port; open in the browser or stop it.
  component PreviewRow: Item {
    id: prow
    property var preview: ({})
    width: parent ? parent.width : 0
    implicitHeight: Math.max(prowLabels.implicitHeight, prowButtons.implicitHeight)

    Column {
      id: prowLabels
      anchors.left: parent.left
      anchors.right: prowButtons.left
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(1)
      Row {
        width: parent.width
        spacing: Style.space(8)
        StatusDot { status: "live"; anchors.verticalCenter: parent.verticalCenter }
        PlainText {
          text: (prow.preview.project || prow.preview.app) + (prow.preview.project && prow.preview.app && prow.preview.app !== prow.preview.project ? "  ·  " + prow.preview.app : "")
          font.pixelSize: Style.font.bodySmall
          font.bold: true
          elide: Text.ElideRight
          width: parent.width - x
        }
      }
      PlainText {
        text: [
          ":" + prow.preview.port,
          prow.preview.environment ? strings.t("preview.connected").arg(prow.preview.environment.toUpperCase()) : strings.t("preview.local"),
          prow.preview.owner === "cli" ? strings.t("preview.cli") : strings.t("preview.agent"),
          Model.age(prow.preview.startedAt, root.nowMs)
        ].filter(function(s) { return s !== "" }).join("  ·  ")
        opacity: 0.6
        font.pixelSize: Style.font.caption
        elide: Text.ElideRight
        width: parent.width
      }
    }

    Row {
      id: prowButtons
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(2)
      ActionButton {
        iconText: "󰖟"
        tooltipText: strings.t("tip.openPreview")
        enabled: prow.preview.url !== "" && root.busy === ""
        opacity: enabled ? 1 : 0.4
        onClicked: root.act("open", ["open", prow.preview.url], true)
      }
      ActionButton {
        iconText: root.busy === "stop" ? "󰔟" : "󰓛"
        tooltipText: prow.preview.owner === "cli" ? strings.t("tip.stop") : strings.t("tip.stopAgent")
        enabled: prow.preview.owner === "cli" && root.busy === ""
        opacity: enabled ? 1 : 0.4
        onClicked: root.act("stop", ["stop", String(prow.preview.port)], false)
      }
    }
  }

  // One project: status, environments, changes, last deployment, review
  // comments; preview, terminal and agent shortcuts.
  component ProjectRow: Item {
    id: row
    property var project: ({})
    readonly property var live: Model.previewFor(root.snap, project)
    width: parent ? parent.width : 0
    implicitHeight: rowLabels.implicitHeight

    Column {
      id: rowLabels
      anchors.left: parent.left
      anchors.right: parent.right
      spacing: Style.space(3)

      Item {
        width: parent.width
        implicitHeight: Math.max(nameRow.implicitHeight, rowButtons.implicitHeight)
        Row {
          id: nameRow
          anchors.left: parent.left
          anchors.right: rowButtons.left
          anchors.rightMargin: Style.space(6)
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(8)
          StatusDot {
            status: row.project.status === "ok" ? (row.live ? "live" : "idle") : row.project.status
            anchors.verticalCenter: parent.verticalCenter
          }
          PlainText {
            text: row.project.name + (row.project.pinned ? "  󰐃" : "")
            font.pixelSize: Style.font.body
            font.bold: true
            elide: Text.ElideRight
            width: Math.min(implicitWidth, parent.width - x - envText.implicitWidth - parent.spacing)
            anchors.verticalCenter: parent.verticalCenter
          }
          PlainText {
            id: envText
            text: Model.envSummary(row.project)
            opacity: 0.6
            font.pixelSize: Style.font.caption
            anchors.verticalCenter: parent.verticalCenter
          }
        }
        Row {
          id: rowButtons
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(1)
          ActionButton {
            iconText: row.live ? "󰖟" : (root.busy === "start" ? "󰔟" : "󰐊")
            tooltipText: row.live ? strings.t("tip.openPreview") : strings.t("tip.start")
            enabled: root.busy === ""
            onClicked: row.live
              ? root.act("open", ["open", row.live.url], true)
              : root.act("start", ["start", row.project.path], false)
          }
          ActionButton {
            iconText: "✻"
            tooltipText: strings.t("tip.claude")
            enabled: root.busy === ""
            onClicked: root.act("terminal", ["terminal", row.project.path, "claude"], true)
          }
          ActionButton {
            iconText: "󰚩"
            tooltipText: strings.t("tip.codex")
            enabled: root.busy === ""
            onClicked: root.act("terminal", ["terminal", row.project.path, "codex"], true)
          }
          ActionButton {
            iconText: "󰆍"
            tooltipText: strings.t("tip.terminal")
            enabled: root.busy === ""
            onClicked: root.act("terminal", ["terminal", row.project.path, "shell"], true)
          }
          ActionButton {
            iconText: "󰉋"
            tooltipText: strings.t("tip.folder")
            enabled: root.busy === ""
            onClicked: root.act("folder", ["folder", row.project.path], true)
          }
        }
      }

      // Facts line: Git changes · last deployment · comments · jobs
      PlainText {
        leftPadding: Style.space(17)
        width: parent.width
        elide: Text.ElideRight
        font.pixelSize: Style.font.caption
        opacity: 0.7
        text: {
          var p = row.project, parts = []
          if (p.changes !== null) parts.push(p.changes ? strings.tn("fact.changes", p.changes).arg(p.changes) : strings.t("fact.clean"))
          if (p.deployment) parts.push(strings.t("fact.deployed").arg(p.deployment.status).arg(Model.age(p.deployment.at, root.nowMs)))
          else parts.push(strings.t("fact.neverDeployed"))
          if (p.jobs) parts.push(strings.tn("fact.jobs", p.jobs).arg(p.jobs))
          return parts.join("  ·  ")
        }
      }

      // Open review comments left in the local preview, waiting for an agent.
      Repeater {
        model: row.project.commentItems
        PlainText {
          required property var modelData
          leftPadding: Style.space(17)
          width: rowLabels.width
          elide: Text.ElideRight
          font.pixelSize: Style.font.caption
          color: root.colorFor("warn")
          text: "󰆉  " + strings.t("comment.line").arg(modelData.page).arg(modelData.text)
        }
      }
      PlainText {
        visible: (row.project.comments || 0) > row.project.commentItems.length
        leftPadding: Style.space(17)
        font.pixelSize: Style.font.caption
        opacity: 0.6
        text: strings.t("comment.more").arg((row.project.comments || 0) - row.project.commentItems.length)
      }

      Repeater {
        model: row.project.issues
        PlainText {
          required property var modelData
          leftPadding: Style.space(17)
          width: rowLabels.width
          wrapMode: Text.Wrap
          maximumLineCount: 2
          elide: Text.ElideRight
          font.pixelSize: Style.font.caption
          color: root.colorFor(row.project.status === "warn" ? "warn" : "crit")
          text: modelData
        }
      }
    }
  }
}
