#!/usr/bin/env python3
"""Offline tests for the APEXREST Omarchy widget helper and model.

Run: python3 -I integrations/omarchy/test_apexrest_omarchy.py
Uses a fake APEXREST CLI and a temporary APEXREST_HOME; touches no real state.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.join(HERE, "apexrest")
HELPER = os.path.join(PLUGIN, "bin", "apexrest-omarchy")
MODEL = os.path.join(PLUGIN, "Model.js")

def write(path, content):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


FAKE_CLI = r'''#!/usr/bin/env python3
import json, os, sys
args = [a for a in sys.argv[1:] if a != "--json"]
def out(data, ok=True):
    print(json.dumps({"ok": ok, "data": data} if ok else {"ok": False, "summary": data}))
cmd = " ".join(args[:2])
project = args[args.index("--project") + 1] if "--project" in args else ""
if cmd == "version x" or args[:1] == ["version"]:
    out({"version": "9.9.9"})
elif cmd == "preview status":
    out({"assetsInstalled": True, "running": [
        {"pid": 1, "port": 4100, "url": "http://127.0.0.1:4100/", "owner": "cli",
         "sourceDir": os.environ["FAKE_PROJECT"] + "/src/apex/app", "startedAt": "2026-01-01T00:00:00Z"}]})
elif cmd == "panel status":
    if project.endswith("broken"):
        out("panel exploded", ok=False)
    else:
        out({"version": "9.9.9", "configuration": {"projectId": "<b>demo</b>",
             "environments": {"dev": {"kind": "dev", "applicationId": 100}}},
             "changes": {"status": "available", "files": [" M a", " M b"]},
             "jobs": [], "sync": [{"environment": "dev", "blocked": False}],
             "deployments": [{"id": "d1", "status": os.environ.get("FAKE_DEPLOY", "succeeded"),
                              "at": "2026-01-01T00:00:00Z"}]})
elif cmd == "preview comments":
    out({"count": 2, "comments": [{"id": "rc-1", "page": {"id": "1"}, "text": "<img src=x> bigger title"},
                                  {"id": "rc-2", "page": {"id": "2"}, "text": "rename"}]})
else:
    out("unknown", ok=False)
'''


class HelperTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="apexrest-omarchy-test-")
        self.home = os.path.join(self.tmp, "home")
        self.project = os.path.join(self.tmp, "work", "demo")
        self.broken = os.path.join(self.tmp, "work", "broken")
        for p in (self.project, self.broken):
            os.makedirs(p)
            write(os.path.join(p, "apexrest.json"), "{}")
        os.makedirs(os.path.join(self.tmp, "work", "not-a-project"))
        os.makedirs(self.home)
        cli = os.path.join(self.tmp, "fake-apexrest")
        write(cli, FAKE_CLI)
        os.chmod(cli, 0o755)
        write(os.path.join(self.home, "recent-projects.json"), json.dumps({"projects": [
            {"path": self.project, "at": "2026-01-02"},
            {"path": self.broken, "at": "2026-01-01"},
            {"path": os.path.join(self.tmp, "work", "not-a-project"), "at": "2026-01-03"},
            {"path": "relative/path", "at": "2026-01-04"},
        ]}))
        self.env = dict(os.environ, APEXREST_HOME=self.home, APEXREST_CLI=cli,
                        XDG_STATE_HOME=os.path.join(self.tmp, "state"), FAKE_PROJECT=self.project,
                        PATH="/usr/bin:/bin")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_helper(self, *args, env=None):
        p = subprocess.run([sys.executable, "-I", HELPER] + list(args), capture_output=True, text=True,
                           env=env or self.env, timeout=60)
        return json.loads(p.stdout.strip().splitlines()[-1])

    def test_snapshot(self):
        # /tmp projects are hidden by default, so the temp-dir fixtures need --include-temp.
        s = self.run_helper("snapshot", "--include-temp")
        self.assertTrue(s["ok"])
        self.assertEqual(s["version"], "9.9.9")
        names = [p["path"] for p in s["projects"]]
        self.assertEqual(names, [self.project, self.broken])
        demo, broken = s["projects"]
        self.assertEqual(demo["changes"], 2)
        self.assertEqual(demo["comments"], 2)
        self.assertEqual(demo["status"], "warn")
        self.assertEqual(demo["previews"], [4100])
        self.assertEqual(s["previews"][0]["project"], demo["name"])
        self.assertEqual(broken["status"], "error")
        self.assertEqual(s["state"], "error")

    def test_temp_projects_hidden_by_default(self):
        if not self.tmp.startswith("/tmp/"):
            self.skipTest("temporary directory is not under /tmp")
        s = self.run_helper("snapshot")
        self.assertEqual(s["projects"], [])
        pinned = self.run_helper("snapshot", "--pin", self.project)
        self.assertEqual([p["path"] for p in pinned["projects"]], [self.project])

    def test_failed_deployment_is_critical(self):
        env = dict(self.env, FAKE_DEPLOY="unknown")
        s = self.run_helper("snapshot", "--include-temp", env=env)
        self.assertEqual(s["projects"][0]["status"], "crit")
        self.assertIn("unknown", s["projects"][0]["issues"][0])

    def test_missing_cli(self):
        env = dict(self.env, APEXREST_CLI="", APEXREST_HOME=os.path.join(self.tmp, "nowhere"))
        s = self.run_helper("snapshot", env=env)
        self.assertIn("not found", s["error"])
        self.assertEqual(s["state"], "error")

    def test_actions_refuse_unknown_targets(self):
        self.run_helper("snapshot", "--include-temp")
        self.assertFalse(self.run_helper("open", "https://example.com/")["ok"])
        self.assertFalse(self.run_helper("open", "file:///etc/passwd")["ok"])
        self.assertFalse(self.run_helper("terminal", "/etc")["ok"])
        self.assertFalse(self.run_helper("start", os.path.join(self.tmp, "work", "not-a-project"))["ok"])
        self.assertFalse(self.run_helper("terminal", self.project, "rm")["ok"])
        self.assertFalse(self.run_helper("terminal", "/etc", "pair")["ok"])
        self.assertFalse(self.run_helper("stop", "9999")["ok"])
        self.assertFalse(self.run_helper("bogus")["ok"])


PAIR = os.path.join(PLUGIN, "bin", "apexrest-pair")
FAKE_CODEX = r'''#!/bin/bash
for i in 1 2 3 4; do printf '\r• Working (%ss • esc to interrupt)' $i; sleep 1; done
printf '\r%-40s\n' "Done"; echo "› Ask Codex to do anything"
read -r line; echo "GOT: $line"
printf '  Would you like to run the following command?\n  › 1. Yes, proceed   2. No\n'
sleep 120
'''


class PairTest(unittest.TestCase):
    """apexrest-pair against a fake Codex in a detached tmux pane."""

    def setUp(self):
        if not shutil.which("tmux"):
            self.skipTest("tmux not installed")
        self.tmp = tempfile.mkdtemp(prefix="apexrest-pair-test-")
        fake = os.path.join(self.tmp, "fake-codex")
        write(fake, FAKE_CODEX)
        os.chmod(fake, 0o755)
        self.session = "apexrest-pair-test-%d" % os.getpid()
        subprocess.run(["tmux", "new-session", "-d", "-s", self.session, "-x", "100", "-y", "20", fake], check=True)
        pane = subprocess.run(["tmux", "display-message", "-p", "-t", self.session + ":0.0", "#{pane_id}"],
                              capture_output=True, text=True, check=True).stdout.strip()
        self.env = dict(os.environ, APEXREST_PAIR_PANE=pane)

    def tearDown(self):
        subprocess.run(["tmux", "kill-session", "-t", self.session], capture_output=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def pair(self, *args):
        return subprocess.run([PAIR] + list(args), capture_output=True, text=True, env=self.env, timeout=60).stdout

    def test_turn_say_and_approval(self):
        out = self.pair("wait", "--max", "30", "--lines", "3")
        self.assertIn("event: turn-finished", out)
        self.assertIn("Done", out)
        self.assertIn("sent to Codex: fix p2", self.pair("say", "fix\np2"))
        out = self.pair("wait", "--max", "20")
        self.assertIn("event: needs-approval", out)
        self.assertIn("GOT: fix p2", out)

    def test_exited_pane(self):
        subprocess.run(["tmux", "kill-session", "-t", self.session], capture_output=True)
        self.assertIn("event: exited", self.pair("wait"))


class ModelTest(unittest.TestCase):
    """Runs Model.js under Node (when available) with markup-shaped input."""

    def setUp(self):
        self.node = shutil.which("node")
        if not self.node:
            self.skipTest("node not installed")

    def run_model(self, expr):
        with open(MODEL, encoding="utf-8") as fh:
            src = fh.read().replace(".pragma library", "")
        script = src + "\nprocess.stdout.write(JSON.stringify(" + expr + "))"
        p = subprocess.run([self.node, "-e", script], capture_output=True, text=True, timeout=30)
        self.assertEqual(p.returncode, 0, p.stderr)
        return json.loads(p.stdout)

    def test_snapshot_bounds_and_plain_text(self):
        raw = json.dumps({"ok": True, "state": "evil", "previews": [
            {"port": 4100, "url": "https://example.com/", "owner": "root"},
            {"port": 99999}, {"port": "x"}],
            "projects": [{"path": "/p", "name": "x" * 500, "comments": 3,
                          "commentItems": [{"page": "1", "text": "<img src=x>\u0000hi"}]},
                         {"path": "relative"}]})
        s = self.run_model("snapshot(%s)" % json.dumps(raw))
        self.assertEqual(s["state"], "ok")
        self.assertEqual(len(s["previews"]), 1)
        self.assertEqual(s["previews"][0]["url"], "")
        self.assertEqual(s["previews"][0]["owner"], "host")
        self.assertEqual(len(s["projects"]), 1)
        self.assertLessEqual(len(s["projects"][0]["name"]), 64)
        self.assertNotIn("\u0000", s["projects"][0]["commentItems"][0]["text"])

    def test_no_markup(self):
        self.assertNotIn("<", self.run_model('noMarkup("<b>APEX</b>")'))

    def test_local_url(self):
        self.assertEqual(self.run_model('localUrl("http://127.0.0.1:4100/f?p=1")'), "http://127.0.0.1:4100/f?p=1")
        self.assertEqual(self.run_model('localUrl("http://127.0.0.1.evil.com/")'), "")

    def test_garbage(self):
        s = self.run_model('snapshot("not json")')
        self.assertTrue(s["loaded"])
        self.assertNotEqual(s["error"], "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
