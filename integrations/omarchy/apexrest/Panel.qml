import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Model.js" as Model

// APEXREST in the Omarchy bar: the machine-wide state and settings of the
// APEXREST plugin. Status shows the runtime, the current project (the one
// APEXREST last worked in, or a pinned folder) and every running preview.
// Settings switch the default OpenAI Decisions selection, the reference
// catalog and the SQLcl backend through `apexrest settings configure` and
// `apexrest sqlcl configure`. The panel never imports, deploys or writes to a
// database; shipping is handed to the coding agent and its own safeguards.
Panel {
  id: root
  moduleName: "apexrest"
  ipcTarget: "apexrest"
  // Own the IPC target to add `settings` and `status`, which open a page directly:
  //   omarchy-shell apexrest settings
  manageIpc: false

  ShellIpc {
    target: "apexrest"
    function open() { root.open() }
    function close() { root.close() }
    function show() { root.open() }
    function hide() { root.close() }
    function toggle() { root.toggle() }
    function status() { root.page = "status"; root.open() }
    function settings() { root.page = "settings"; root.open() }
  }

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  readonly property string helper: decodeURIComponent(String(Qt.resolvedUrl("bin/apexrest-omarchy")).replace(/^file:\/\//, ""))
  readonly property string pinned: Model.pinnedProject(String(setting("projectPath", "")))
  readonly property string cliSetting: String(setting("apexrestCommand", ""))
  readonly property int refreshIntervalSec: Math.max(10, Number(setting("refreshIntervalSec", 60)) || 60)

  property string page: "status"       // "status" | "settings"
  property var snap: Model.emptySnapshot()
  property var savedConnections: []
  property bool savedLoaded: false
  property string busy: ""             // action in flight
  property var lastValidation: null
  property string notice: ""
  property double nowMs: Date.now()

  readonly property var current: snap.project
  readonly property var currentPreview: current ? Model.previewOf(snap, current.path) : null
  readonly property bool usable: snap.loaded && snap.cliFound && snap.error === ""
  readonly property bool attention: snap.loaded && (!snap.cliFound || snap.error !== "" || !snap.runtime.ready)

  readonly property string barGlyph: "󰆼"
  readonly property string barLabel: attention ? "!" : (snap.previews.length > 0 ? "●" : "")

  readonly property string heroStatus: {
    if (!snap.loaded) return strings.t("status.loading")
    if (!snap.cliFound) return strings.t("status.noCli")
    if (snap.error !== "") return strings.t("status.error")
    if (!snap.runtime.ready) return strings.t("status.runtimeIncomplete")
    var parts = []
    if (snap.previews.length > 0) parts.push(strings.tn("status.previews", snap.previews.length).arg(Commons.I18n.formatNumber(snap.previews.length)))
    parts.push(snap.decisions.enabled ? strings.t("status.decisionsOn") : strings.t("status.localSelection"))
    if (!snap.catalog.enabled) parts.push(strings.t("status.catalogOff"))
    return parts.join(" · ")
  }

  function run(args, kind) {
    if (actionProc.running) return
    busy = kind
    notice = ""
    actionProc.kind = kind
    actionProc.command = ["bash", helper].concat(args)
    actionProc.running = true
  }

  function launch(args) {
    if (launchProc.running) return
    notice = ""
    launchProc.command = ["bash", helper].concat(args)
    launchProc.running = true
  }

  function refresh() {
    nowMs = Date.now()
    if (snapshotProc.running) return
    snapshotProc.command = pinned ? ["bash", helper, "snapshot", pinned] : ["bash", helper, "snapshot"]
    snapshotProc.running = true
  }

  function loadSavedConnections() {
    if (savedProc.running) return
    savedProc.running = true
  }

  function usageLine(c) {
    return strings.t("catalog.usageLine")
      .arg(Commons.I18n.formatNumber(c.search))
      .arg(Commons.I18n.formatNumber(c.read))
      .arg(Commons.I18n.formatNumber(c.select))
  }

  function tokenLine(c) {
    if (c.totalTokens === 0) return "—"
    return strings.t("tokens.line")
      .arg(Commons.I18n.formatNumber(c.totalTokens))
      .arg(Commons.I18n.formatNumber(c.cachedTokens))
      .arg(Commons.I18n.formatNumber(c.outputTokens))
  }

  function timingLine(t) {
    var line = strings.t("timing.line")
      .arg(Commons.I18n.formatNumber(t.count))
      .arg(Model.duration(t.averageMs))
      .arg(Model.duration(t.lastMs))
    if (t.failed > 0) line += "  ·  " + strings.tn("timing.failed", t.failed).arg(Commons.I18n.formatNumber(t.failed))
    return line
  }

  function askAgent(kind, env) {
    if (!current) return
    var prompt = Model.agentPrompt(kind, env)
    launch(prompt ? ["agent", current.path, prompt] : ["agent", current.path])
    close()
  }

  Process {
    id: snapshotProc
    environment: ({ APEXREST_CLI: root.cliSetting })
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.snap = Model.snapshot(text)
    }
  }

  Process {
    id: savedProc
    command: ["bash", root.helper, "saved-connections"]
    environment: ({ APEXREST_CLI: root.cliSetting })
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.savedConnections = Model.savedConnections(text)
        root.savedLoaded = true
      }
    }
  }

  Process {
    id: actionProc
    property string kind: ""
    environment: ({ APEXREST_CLI: root.cliSetting })
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (actionProc.kind === "validate") {
          root.lastValidation = Model.validation(text)
        } else {
          var result = Model.actionResult(text)
          if (!result.ok) root.notice = result.message
        }
      }
    }
    onExited: {
      root.busy = ""
      root.refresh()
    }
  }

  Process {
    id: launchProc
    environment: ({ APEXREST_CLI: root.cliSetting })
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var result = Model.actionResult(text)
        if (!result.ok) root.notice = result.message
      }
    }
  }

  // Local reads only (no database, no SQLcl), so it also runs while the panel
  // is closed to keep the bar's preview and attention marks current.
  Timer {
    interval: (root.opened ? Math.min(10, root.refreshIntervalSec) : root.refreshIntervalSec) * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  onOpenedChanged: if (opened) refresh()
  onPinnedChanged: refresh()
  onPageChanged: if (page === "settings" && !savedLoaded) loadSavedConnections()

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.barGlyph
    labelText: !vertical ? root.barLabel : ""
    slotSize: Style.bar.iconSlot * (root.barLabel !== "" && !vertical ? 1.6 : 1)
    tooltipText: ""
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
    contentWidth: panel.fittedContentWidth(Style.space(420))
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
            implicitHeight: Math.max(heroIcon.implicitHeight, heroLabels.implicitHeight)

            PlainText {
              id: heroIcon
              text: root.barGlyph
              font.pixelSize: Style.font.display
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
                text: root.snap.version ? "APEXREST " + root.snap.version : "APEXREST"
                font.pixelSize: Style.font.title
                font.bold: true
                elide: Text.ElideRight
                width: parent.width
              }
              PlainText {
                text: root.heroStatus.toUpperCase()
                opacity: 0.7
                font.pixelSize: Style.font.caption
                font.bold: true
                font.letterSpacing: 1.2
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
                iconText: "󰓙"
                tooltipText: strings.t("tip.doctor")
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                visible: root.snap.cliFound
                onClicked: { root.launch(["doctor"]); root.close() }
              }
              PanelActionButton {
                iconText: "󰑐"
                tooltipText: strings.t("action.refresh")
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                onClicked: { root.refresh(); if (root.page === "settings") root.loadSavedConnections() }
              }
            }
          }

          ButtonGroup {
            visible: root.usable
            options: [
              { value: "status", label: strings.t("page.status") },
              { value: "settings", label: strings.t("page.settings") }
            ]
            value: root.page
            focusable: false
            foreground: root.bar.foreground
            fontFamily: root.bar.fontFamily
            fontSize: Style.font.bodySmall
            onChanged: function(v) { root.page = v }
          }

          // ---------- Setup / error ----------
          PlainText {
            visible: root.snap.loaded && !root.usable
            width: parent.width
            wrapMode: Text.Wrap
            opacity: 0.8
            font.pixelSize: Style.font.bodySmall
            text: !root.snap.cliFound ? strings.t("help.noCli") : root.snap.error
          }

          // ================= STATUS PAGE =================
          Column {
            visible: root.usable && root.page === "status"
            width: parent.width
            spacing: Style.space(12)

            // ---------- Runtime ----------
            Column {
              width: parent.width
              spacing: Style.spacing.labelGap
              PanelSectionHeader { text: strings.t("section.runtime"); foreground: root.bar.foreground; fontFamily: root.bar.fontFamily }
              InfoPair { label: "Java"; value: root.snap.runtime.java || "—" }
              InfoPair { label: "SQLcl"; value: root.snap.runtime.sqlcl || "—" }
              InfoPair { label: strings.t("info.runtimePath"); value: root.snap.cli }
            }

            PanelSeparator { foreground: root.bar.foreground }

            // ---------- Current project ----------
            Column {
              width: parent.width
              spacing: Style.space(8)

              PanelSectionHeader {
                text: root.pinned ? strings.t("section.pinnedProject") : strings.t("section.currentProject")
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
              }

              PlainText {
                visible: !root.current
                width: parent.width
                wrapMode: Text.Wrap
                opacity: 0.7
                font.pixelSize: Style.font.bodySmall
                text: strings.t("help.noProject")
              }

              Column {
                visible: !!root.current
                width: parent.width
                spacing: Style.space(1)
                PlainText {
                  text: root.current ? root.current.name + (root.current.configured ? "  ·  APEX " + root.current.profile : "") : ""
                  font.pixelSize: Style.font.body
                  font.bold: true
                  elide: Text.ElideRight
                  width: parent.width
                }
                PlainText {
                  text: root.current ? root.current.path : ""
                  opacity: 0.6
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideMiddle
                  width: parent.width
                }
                PlainText {
                  visible: !!root.current && root.current.error !== ""
                  text: root.current ? root.current.error : ""
                  color: Commons.Color.urgent
                  font.pixelSize: Style.font.caption
                  wrapMode: Text.Wrap
                  width: parent.width
                }
              }

              InfoPair {
                visible: !!root.current && root.current.configured
                label: strings.t("info.changes")
                value: root.current ? Commons.I18n.formatNumber(root.current.changeCount) : ""
              }
              InfoPair {
                visible: !!root.current && root.current.configured
                label: strings.t("info.lastDeployment")
                value: !root.current || !root.current.lastDeployment ? "—"
                  : root.current.lastDeployment.status + "  ·  " + strings.t("info.ago").arg(Model.age(root.current.lastDeployment.at, root.nowMs))
              }
              InfoPair {
                visible: !!root.lastValidation
                label: strings.t("info.validation")
                value: !root.lastValidation ? "" : root.lastValidation.ok ? strings.t("info.validationPassed")
                  : strings.tn("info.validationErrors", root.lastValidation.errors).arg(Commons.I18n.formatNumber(root.lastValidation.errors))
              }
              Caption {
                visible: !!root.lastValidation && !root.lastValidation.ok
                text: root.lastValidation ? root.lastValidation.message : ""
                maximumLineCount: 3
                elide: Text.ElideRight
              }

              // Environments of the current project with their connection references.
              Repeater {
                model: root.current && root.current.configured ? root.current.environments : []
                Item {
                  id: envRow
                  required property var modelData
                  width: parent.width
                  implicitHeight: Math.max(envLabels.implicitHeight, envButtons.implicitHeight)

                  Column {
                    id: envLabels
                    anchors.left: parent.left
                    anchors.right: envButtons.left
                    anchors.rightMargin: Style.space(6)
                    anchors.verticalCenter: parent.verticalCenter
                    PlainText {
                      text: envRow.modelData.name + "  ·  " + envRow.modelData.kind.toUpperCase() + (envRow.modelData.applicationId ? "  ·  " + strings.t("env.app").arg(envRow.modelData.applicationId) : "")
                      font.pixelSize: Style.font.bodySmall
                      font.bold: true
                      elide: Text.ElideRight
                      width: parent.width
                    }
                    PlainText {
                      text: strings.t("env.connection").arg(envRow.modelData.readRef || "—")
                      opacity: 0.6
                      font.pixelSize: Style.font.caption
                      elide: Text.ElideRight
                      width: parent.width
                    }
                  }

                  Row {
                    id: envButtons
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(2)
                    PanelActionButton {
                      iconText: root.busy === "test:" + envRow.modelData.readRef ? "󰔟" : "󰌘"
                      tooltipText: strings.t("tip.testConnection").arg(envRow.modelData.readRef)
                      foreground: root.bar.foreground
                      fontFamily: root.bar.fontFamily
                      visible: envRow.modelData.readRef !== ""
                      enabled: root.busy === ""
                      onClicked: root.run(["connection-test", root.current.path, envRow.modelData.readRef], "test:" + envRow.modelData.readRef)
                    }
                    PanelActionButton {
                      iconText: "󰐊"
                      tooltipText: strings.t("tip.connectedPreview")
                      foreground: root.bar.foreground
                      fontFamily: root.bar.fontFamily
                      enabled: root.busy === "" && !root.currentPreview
                      opacity: enabled ? 1 : 0.4
                      onClicked: root.run(["preview-start", root.current.path, envRow.modelData.name], "preview")
                    }
                    PanelActionButton {
                      iconText: "󰜎"
                      tooltipText: strings.t("tip.ship").arg(envRow.modelData.name)
                      foreground: root.bar.foreground
                      fontFamily: root.bar.fontFamily
                      visible: envRow.modelData.deployable
                      onClicked: root.askAgent("ship", envRow.modelData.name)
                    }
                  }
                }
              }

              Grid {
                visible: !!root.current && root.current.configured
                width: parent.width
                columns: 2
                columnSpacing: Style.space(6)
                rowSpacing: Style.space(6)
                readonly property real cellWidth: (width - columnSpacing) / 2

                Button {
                  width: parent.cellWidth
                  iconText: root.busy === "preview" ? "󰑐" : "󰐊"
                  iconSpinning: root.busy === "preview"
                  text: root.currentPreview ? strings.t("action.openPreview") : strings.t("action.startPreview")
                  tooltipText: strings.t("tip.localPreview")
                  fontSize: Style.font.bodySmall
                  foreground: root.bar.foreground
                  fontFamily: root.bar.fontFamily
                  bordered: true
                  enabled: root.busy === ""
                  opacity: enabled ? 1 : 0.5
                  onClicked: root.currentPreview ? root.launch(["open-url", root.currentPreview.url]) : root.run(["preview-start", root.current.path], "preview")
                }
                Button {
                  width: parent.cellWidth
                  iconText: root.busy === "validate" ? "󰑐" : "󰄬"
                  iconSpinning: root.busy === "validate"
                  text: root.busy === "validate" ? strings.t("action.validating") : strings.t("action.validate")
                  tooltipText: strings.t("tip.validate")
                  fontSize: Style.font.bodySmall
                  foreground: root.bar.foreground
                  fontFamily: root.bar.fontFamily
                  bordered: true
                  enabled: root.busy === ""
                  opacity: enabled ? 1 : 0.5
                  onClicked: root.run(["validate", root.current.path], "validate")
                }
                Button {
                  width: parent.cellWidth
                  iconText: "󰚩"
                  text: strings.t("action.agent")
                  tooltipText: strings.t("tip.agent")
                  fontSize: Style.font.bodySmall
                  foreground: root.bar.foreground
                  fontFamily: root.bar.fontFamily
                  bordered: true
                  onClicked: root.askAgent("", "")
                }
                Button {
                  width: parent.cellWidth
                  iconText: "󰆍"
                  text: strings.t("action.terminal")
                  fontSize: Style.font.bodySmall
                  foreground: root.bar.foreground
                  fontFamily: root.bar.fontFamily
                  bordered: true
                  onClicked: { root.launch(["terminal", root.current.path]); root.close() }
                }
              }

              // Other recent projects: clicking one makes it current.
              Column {
                visible: !root.pinned && root.snap.recent.length > 1
                width: parent.width
                spacing: Style.space(2)
                PlainText {
                  text: strings.t("info.recent")
                  opacity: 0.6
                  font.pixelSize: Style.font.caption
                }
                Repeater {
                  model: root.snap.recent.slice(1)
                  Button {
                    required property var modelData
                    width: parent.width
                    leftAlign: true
                    iconText: "󰉋"
                    text: modelData.name + "  ·  " + strings.t("info.ago").arg(Model.age(modelData.at, root.nowMs))
                    tooltipText: modelData.path
                    fontSize: Style.font.bodySmall
                    foreground: root.bar.foreground
                    fontFamily: root.bar.fontFamily
                    enabled: root.busy === ""
                    onClicked: root.run(["use-project", modelData.path], "project")
                  }
                }
              }
            }

            PanelSeparator { foreground: root.bar.foreground }

            // ---------- Local previews (every project) ----------
            Column {
              width: parent.width
              spacing: Style.space(6)
              PanelSectionHeader { text: strings.t("section.previews"); foreground: root.bar.foreground; fontFamily: root.bar.fontFamily }

              Caption {
                visible: root.snap.previews.length === 0
                text: root.snap.previewAssets ? strings.t("preview.none") : strings.t("preview.noAssets")
              }

              Repeater {
                model: root.snap.previews
                Item {
                  id: previewRow
                  required property var modelData
                  width: parent.width
                  implicitHeight: Math.max(previewLabel.implicitHeight, previewButtons.implicitHeight)
                  PlainText {
                    id: previewLabel
                    anchors.left: parent.left
                    anchors.right: previewButtons.left
                    anchors.rightMargin: Style.space(6)
                    anchors.verticalCenter: parent.verticalCenter
                    text: "● " + previewRow.modelData.app + "  " + Model.hostPort(previewRow.modelData.url)
                    font.pixelSize: Style.font.bodySmall
                    elide: Text.ElideRight
                  }
                  Row {
                    id: previewButtons
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(2)
                    PanelActionButton {
                      iconText: "󰏌"
                      tooltipText: strings.t("action.openPreview")
                      foreground: root.bar.foreground
                      fontFamily: root.bar.fontFamily
                      onClicked: root.launch(["open-url", previewRow.modelData.url])
                    }
                    PanelActionButton {
                      iconText: root.busy === "stop:" + previewRow.modelData.port ? "󰔟" : "󰓛"
                      tooltipText: strings.t("action.stopPreview")
                      foreground: root.bar.foreground
                      fontFamily: root.bar.fontFamily
                      enabled: root.busy === ""
                      onClicked: root.run(["preview-stop", String(previewRow.modelData.port)], "stop:" + previewRow.modelData.port)
                    }
                  }
                }
              }
            }
          }

          // ---------- Tokens and timing (Status page) ----------
          Column {
            visible: root.usable && root.page === "status" && root.snap.settingsSupported
            width: parent.width
            spacing: Style.spacing.labelGap

            PanelSeparator { foreground: root.bar.foreground }

            PanelSectionHeader {
              text: strings.t("section.usage")
              foreground: root.bar.foreground
              fontFamily: root.bar.fontFamily
            }
            Caption { text: strings.t("tokens.about") }
            InfoPair { label: strings.t("catalog.today"); value: root.tokenLine(root.snap.catalog.today) }
            InfoPair { label: strings.t("catalog.week"); value: root.tokenLine(root.snap.catalog.week) }
            InfoPair { label: strings.t("catalog.total"); value: root.tokenLine(root.snap.catalog.total) }
            InfoPair {
              label: strings.t("tokens.apiTime")
              value: root.snap.catalog.total.apiCalls === 0 ? "—"
                : strings.tn("tokens.apiTimeValue", root.snap.catalog.total.apiCalls)
                    .arg(Model.duration(root.snap.catalog.total.apiMs / root.snap.catalog.total.apiCalls))
                    .arg(Commons.I18n.formatNumber(root.snap.catalog.total.apiCalls))
            }

            PlainText {
              text: strings.t("timing.header")
              opacity: 0.6
              font.pixelSize: Style.font.caption
              topPadding: Style.space(6)
            }
            Caption {
              visible: root.snap.timings.length === 0
              text: strings.t("timing.none")
            }
            Repeater {
              model: root.snap.timings
              Column {
                id: timingRow
                required property var modelData
                width: parent.width
                InfoPair {
                  label: (timingRow.modelData.lastOk ? "" : "✕ ") + timingRow.modelData.label
                  value: root.timingLine(timingRow.modelData)
                }
                Caption {
                  visible: timingRow.modelData.averageSqlclMs > 0 || timingRow.modelData.maxMs > timingRow.modelData.averageMs
                  text: strings.t("timing.detail")
                    .arg(Model.duration(timingRow.modelData.maxMs))
                    .arg(Model.duration(timingRow.modelData.averageSqlclMs))
                    .arg(strings.t("info.ago").arg(Model.age(timingRow.modelData.lastAt, root.nowMs)))
                  horizontalAlignment: Text.AlignRight
                }
              }
            }
          }

          // ================= SETTINGS PAGE =================
          Column {
            visible: root.usable && root.page === "settings"
            width: parent.width
            spacing: Style.space(12)

            Caption {
              visible: !root.snap.settingsSupported
              text: strings.t("help.updateRuntime")
            }

            // ---------- Decisions API ----------
            Column {
              visible: root.snap.settingsSupported
              width: parent.width
              spacing: Style.space(4)
              SettingRow {
                title: strings.t("section.decisions")
                checked: root.snap.decisions.enabled
                busy: root.busy === "decisions"
                onToggled: root.run(["decisions", root.snap.decisions.enabled ? "off" : "on"], "decisions")
              }
              Caption { text: strings.t("decisions.about") }
              Caption {
                text: (root.snap.decisions.keyInEnvironment ? strings.t("decisions.keyFound") : strings.t("decisions.keyMissing")).arg(root.snap.decisions.apiKeyEnv)
              }
              Caption {
                visible: !!root.current && root.current.decisionOverride !== ""
                text: root.current ? strings.t("decisions.override").arg(root.current.name).arg(root.current.decisionOverride === "on" ? strings.t("value.on") : strings.t("value.off")) : ""
              }
            }

            PanelSeparator { visible: root.snap.settingsSupported; foreground: root.bar.foreground }

            // ---------- Component catalog ----------
            Column {
              visible: root.snap.settingsSupported
              width: parent.width
              spacing: Style.spacing.labelGap
              SettingRow {
                title: strings.t("section.catalog")
                checked: root.snap.catalog.enabled
                busy: root.busy === "catalog"
                onToggled: root.run(["catalog", root.snap.catalog.enabled ? "off" : "on"], "catalog")
              }
              Caption {
                text: root.snap.catalog.enabled
                  ? strings.t("catalog.contents")
                      .arg(Commons.I18n.formatNumber(root.snap.catalog.components))
                      .arg(Commons.I18n.formatNumber(root.snap.catalog.patterns))
                      .arg(Commons.I18n.formatNumber(root.snap.catalog.references))
                  : strings.t("catalog.offAbout")
              }
              InfoPair { label: strings.t("catalog.today"); value: root.usageLine(root.snap.catalog.today) }
              InfoPair { label: strings.t("catalog.week"); value: root.usageLine(root.snap.catalog.week) }
              InfoPair { label: strings.t("catalog.total"); value: root.usageLine(root.snap.catalog.total) }
              InfoPair {
                label: strings.t("catalog.decisionsUsed")
                value: Commons.I18n.formatNumber(root.snap.catalog.total.decisions)
              }
              InfoPair {
                label: strings.t("catalog.lastUsed")
                value: root.snap.catalog.lastUsedAt ? strings.t("info.ago").arg(Model.age(root.snap.catalog.lastUsedAt, root.nowMs)) : "—"
              }
              Caption {
                visible: !root.snap.catalog.recording
                text: strings.t("catalog.notRecording")
              }
            }

            PanelSeparator { foreground: root.bar.foreground }

            // ---------- SQLcl ----------
            Column {
              width: parent.width
              spacing: Style.space(6)
              PanelSectionHeader { text: strings.t("section.sqlcl"); foreground: root.bar.foreground; fontFamily: root.bar.fontFamily }

              LabeledChoice {
                label: strings.t("sqlcl.mode")
                options: [
                  { value: "cli", label: "CLI" },
                  { value: "mcp", label: "MCP" }
                ]
                value: root.snap.sqlcl.mode
                onPicked: function(v) { root.run(["sqlcl-mode", v], "sqlcl") }
              }
              LabeledChoice {
                label: strings.t("sqlcl.transport")
                options: [
                  { value: "direct", label: strings.t("sqlcl.direct") },
                  { value: "ords", label: "ORDS" }
                ]
                value: root.snap.sqlcl.transport
                onPicked: function(v) { root.run(["sqlcl-transport", v], "sqlcl") }
              }
              Caption {
                text: root.snap.sqlcl.transport === "ords" ? strings.t("sqlcl.ordsAbout")
                  : root.snap.sqlcl.mode === "mcp" ? strings.t("sqlcl.mcpAbout").arg(root.snap.sqlcl.restrictLevel)
                  : strings.t("sqlcl.cliAbout")
              }

              PlainText {
                text: strings.t("sqlcl.references")
                opacity: 0.6
                font.pixelSize: Style.font.caption
                topPadding: Style.space(4)
              }
              Repeater {
                model: root.snap.connections
                InfoPair {
                  required property var modelData
                  label: modelData.name
                  value: modelData.target || modelData.kind
                }
              }
              Caption {
                visible: root.snap.connections.length === 0
                text: strings.t("sqlcl.noReferences")
              }

              PlainText {
                text: strings.t("sqlcl.saved")
                opacity: 0.6
                font.pixelSize: Style.font.caption
                topPadding: Style.space(4)
              }
              Caption {
                text: savedProc.running ? strings.t("status.loading")
                  : !root.savedLoaded ? "—"
                  : root.savedConnections.length ? root.savedConnections.join("  ·  ")
                  : strings.t("sqlcl.noSaved")
              }
            }
          }

          PlainText {
            visible: root.notice !== ""
            text: root.notice
            width: parent.width
            wrapMode: Text.Wrap
            maximumLineCount: 3
            elide: Text.ElideRight
            color: Commons.Color.urgent
            font.pixelSize: Style.font.caption
          }
        }
      }
    }
  }

  component PlainText: Text {
    textFormat: Text.PlainText
    color: root.bar.foreground
    font.family: root.bar.fontFamily
  }

  component Caption: Text {
    textFormat: Text.PlainText
    color: root.bar.foreground
    font.family: root.bar.fontFamily
    font.pixelSize: Style.font.caption
    opacity: 0.65
    wrapMode: Text.Wrap
    width: parent ? parent.width : 0
  }

  component InfoPair: Item {
    property string label: ""
    property string value: ""
    width: parent ? parent.width : 0
    implicitHeight: Math.max(pairLabel.implicitHeight, pairValue.implicitHeight)

    PlainText {
      id: pairLabel
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      text: parent.label
      opacity: 0.6
      font.pixelSize: Style.font.bodySmall
    }
    PlainText {
      id: pairValue
      anchors.right: parent.right
      anchors.left: pairLabel.right
      anchors.leftMargin: Style.space(12)
      anchors.verticalCenter: parent.verticalCenter
      horizontalAlignment: Text.AlignRight
      text: parent.value
      elide: Text.ElideLeft
      font.pixelSize: Style.font.bodySmall
    }
  }

  component SettingRow: Item {
    id: settingRow
    property string title: ""
    property bool checked: false
    property bool busy: false
    signal toggled()
    width: parent ? parent.width : 0
    implicitHeight: Math.max(settingTitle.implicitHeight, settingSwitch.implicitHeight)

    PanelSectionHeader {
      id: settingTitle
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      text: settingRow.title
      foreground: root.bar.foreground
      fontFamily: root.bar.fontFamily
    }
    ToggleSwitch {
      id: settingSwitch
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      checked: settingRow.checked
      busy: settingRow.busy
      interactive: root.busy === ""
      foreground: root.bar.foreground
      onToggled: settingRow.toggled()
    }
  }

  component LabeledChoice: Item {
    id: choice
    property string label: ""
    property var options: []
    property string value: ""
    signal picked(string value)
    width: parent ? parent.width : 0
    implicitHeight: Math.max(choiceLabel.implicitHeight, choiceGroup.implicitHeight)

    PlainText {
      id: choiceLabel
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      text: choice.label
      opacity: 0.6
      font.pixelSize: Style.font.bodySmall
    }
    ButtonGroup {
      id: choiceGroup
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      options: choice.options
      value: choice.value
      focusable: false
      enabled: root.busy === ""
      foreground: root.bar.foreground
      fontFamily: root.bar.fontFamily
      fontSize: Style.font.bodySmall
      onChanged: function(v) { if (v !== choice.value) choice.picked(v) }
    }
  }
}
