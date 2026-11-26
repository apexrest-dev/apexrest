#!/usr/bin/env python3
"""Offline tests for the APEXREST Omarchy widget helper and model.

Run: python3 -I integrations/omarchy/test_apexrest_omarchy.py
Uses a fake APEXREST CLI and a temporary APEXREST_HOME; touches no real state.
"""

import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

# Tests get their own tmux server, never the user's (sessions there are visible to the bar widget).
os.environ.pop("TMUX", None)
TMUX_DIR = tempfile.mkdtemp(prefix="apexrest-tmux-")
os.environ["TMUX_TMPDIR"] = TMUX_DIR

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
             "environments": {"dev": {"kind": "dev", "applicationId": 100, "baseUrl": "http://localhost:8080/ords/"},
                              "prod": {"kind": "production", "applicationId": 200, "baseUrl": "https://p.example/ords"},
                              "bad": {"kind": "test", "applicationId": 300, "baseUrl": "javascript:alert(1)"}}},
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
        # DEV is preferred over other environments; a non-http base URL is never offered.
        self.assertEqual(demo["run"], {"environment": "dev", "applicationId": 100,
                                       "url": "http://localhost:8080/ords/f?p=100"})
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
        self.assertFalse(self.run_helper("run", "/etc")["ok"])
        self.assertFalse(self.run_helper("run", self.project, "bad")["ok"])
        self.assertFalse(self.run_helper("run", self.project, "nope")["ok"])
        self.assertFalse(self.run_helper("bogus")["ok"])


PAIR = os.path.join(PLUGIN, "bin", "apexrest-pair")
# Stands in for `codex exec`: records the prompt, answers from $FAKE_VERDICT.
FAKE_CODEX = r"""#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
prompt = sys.stdin.read()
with open(os.environ["FAKE_PROMPTS"], "a") as fh:
    fh.write(" ".join(args) + "\n" + prompt + "\n=====\n")
verdict = os.environ.get("FAKE_VERDICT", "comment")
notes = ["app.js:3 divides by zero\nwhen the list is empty"] if verdict == "comment" else []
with open(args[args.index("-o") + 1], "w") as fh:
    json.dump({"verdict": verdict, "notes": notes}, fh)
"""


def load_pair():
    sys.dont_write_bytecode = True
    import importlib.machinery
    import importlib.util
    loader = importlib.machinery.SourceFileLoader("apexrest_pair", PAIR)
    mod = importlib.util.module_from_spec(importlib.util.spec_from_loader("apexrest_pair", loader))
    loader.exec_module(mod)
    return mod


def transcript_lines():
    return [
        {"type": "user", "message": {"role": "user", "content": "old request"}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "old answer"}]}},
        {"type": "user", "message": {"role": "user", "content": "add an average function"}},
        {"type": "user", "isMeta": True, "message": {"content": [{"type": "text", "text": "skill body"}]}},
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": "secret plan"},
                                                     {"type": "tool_use", "name": "Edit",
                                                      "input": {"file_path": "app.js", "new_string": "a/b"}}]}},
        {"type": "user", "message": {"content": [{"type": "tool_result", "content": "edited"}]}},
        {"type": "assistant", "isSidechain": True, "message": {"content": [{"type": "text", "text": "subagent"}]}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "Done, average added."}]}},
    ]


class PairUnitTest(unittest.TestCase):
    def setUp(self):
        self.mod = load_pair()
        self.tmp = tempfile.mkdtemp(prefix="apexrest-pair-unit-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_digest_takes_the_turn_since_your_last_prompt(self):
        path = os.path.join(self.tmp, "t.jsonl")
        write(path, "\n".join(json.dumps(x) for x in transcript_lines()) + "\nnot json\n")
        text = self.mod.digest(path)
        self.assertTrue(text.startswith("USER: add an average function"))
        self.assertIn("tool Edit:", text)
        self.assertIn("result: edited", text)
        self.assertIn("CLAUDE: Done, average added.", text)
        for hidden in ("old request", "skill body", "secret plan", "subagent"):
            self.assertNotIn(hidden, text)
        # A Codex message does not start a new turn: the user's request stays in view.
        extra = [{"type": "user", "message": {"content": "[Request interrupted by user]"}},
                 {"type": "user", "message": {"content": "<bash-input>git status</bash-input>"}},
                 {"type": "user", "message": {"content": "[Codex review] (1) check b"}},
                 {"type": "assistant", "message": {"content": [{"type": "text", "text": "fixed"}]}}]
        write(path, "\n".join(json.dumps(x) for x in transcript_lines() + extra))
        text = self.mod.digest(path)
        self.assertTrue(text.startswith("USER: add an average function"))
        self.assertIn("CODEX REVIEW (earlier, sent to Claude): [Codex review] (1) check b", text)

    def test_composer_text_ignores_suggestions(self):
        rule = "\x1b[38;5;244m" + "─" * 40 + "\x1b[39m"
        empty = [rule, "\x1b[39m❯\u00a0", rule, "  \x1b[38;5;220m⏵⏵ auto mode on\x1b[39m"]
        ghost = [rule, "\x1b[39m❯\u00a0\x1b[2mcommit this\x1b[22m", rule]
        grey = [rule, "\x1b[39m❯\u00a0\x1b[38;5;246mTry \"fix lint\"\x1b[39m", rule]
        draft = [rule, "\x1b[39m❯\u00a0half a thought", "  that wraps", rule]
        history = ["\x1b[39m❯ an old prompt", rule, "\x1b[39m❯\u00a0", rule]
        self.assertEqual(self.mod.composer_text(empty), "")
        self.assertEqual(self.mod.composer_text(ghost), "")
        self.assertEqual(self.mod.composer_text(grey), "")
        self.assertEqual(self.mod.composer_text(draft), "half a thought  that wraps")
        self.assertEqual(self.mod.composer_text(history), "")
        self.assertIsNone(self.mod.composer_text(["plain output"]))

    def test_review_message_is_one_bounded_line(self):
        msg = self.mod.review_message(["first\nline\x1b[31m", "", "x" * 900, "c", "d", "e"])
        self.assertTrue(msg.startswith("[Codex review] (1) first line"))
        self.assertNotIn("\n", msg)
        self.assertNotIn("\x1b", msg)
        self.assertLessEqual(len(msg), 1000)
        self.assertEqual(self.mod.review_message([]), "")
        self.assertTrue(self.mod.review_message(["see @src/app.js"]).endswith("@src/app.js ."))
        self.assertFalse(self.mod.review_message(["ends with a backslash \\"]).endswith("\\"))

    def test_due(self):
        due, cfg = self.mod.due, {"every": 150}
        self.assertIsNone(due({}, cfg, 1000))
        self.assertEqual(due({"phase": "idle", "stopped_turn": 2, "reviewed_turn": 1}, cfg, 1000), "end")
        self.assertIsNone(due({"phase": "idle", "stopped_turn": 2, "reviewed_turn": 2}, cfg, 1000))
        working = {"phase": "working", "edits": 1, "last_review_at": 0, "last_tool": 990}
        self.assertEqual(due(working, cfg, 1000), "checkpoint")
        self.assertIsNone(due(dict(working, last_tool=999), cfg, 1000))
        self.assertIsNone(due(dict(working, edits=0), cfg, 1000))
        self.assertEqual(due({"requested": True}, cfg, 1000), "manual")


class PairTest(unittest.TestCase):
    """Hooks, reviewer loop and delivery into a real (detached) tmux pane."""

    def setUp(self):
        if not shutil.which("tmux"):
            self.skipTest("tmux not installed")
        self.tmp = tempfile.mkdtemp(prefix="apexrest-pair-test-")
        self.state = os.path.join(self.tmp, "state")
        os.makedirs(self.state)
        codex = os.path.join(self.tmp, "fake-codex")
        write(codex, FAKE_CODEX)
        os.chmod(codex, 0o755)
        self.prompts = os.path.join(self.tmp, "prompts.txt")
        self.transcript = os.path.join(self.tmp, "t.jsonl")
        write(self.transcript, "\n".join(json.dumps(x) for x in transcript_lines()))
        self.session = "apexrest-pair-test-%d" % os.getpid()
        # `cat >/dev/null` stands in for Claude's console: whatever is typed into it shows up on screen.
        subprocess.run(["tmux", "new-session", "-d", "-s", self.session, "-x", "200", "-y", "20", "cat >/dev/null"], check=True)
        self.pane = subprocess.run(["tmux", "display-message", "-p", "-t", self.session, "#{pane_id}"],
                                   capture_output=True, text=True, check=True).stdout.strip()
        write(os.path.join(self.state, "config.json"), json.dumps(
            {"project": self.tmp, "pane": self.pane, "every": 150, "rounds": 1, "mode": "all"}))
        self.env = dict(os.environ, APEXREST_PAIR_STATE=self.state, APEXREST_PAIR_CODEX=codex,
                        FAKE_PROMPTS=self.prompts)
        self.loop = None

    def tearDown(self):
        if self.loop:
            self.loop.kill()
            self.loop.wait()
        subprocess.run(["tmux", "kill-session", "-t", self.session], capture_output=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def pair(self, *args, stdin=None, env=None):
        return subprocess.run([sys.executable, "-I", PAIR] + list(args), input=stdin, capture_output=True,
                              text=True, env=env or self.env, timeout=60)

    def hook(self, event, **data):
        data.setdefault("transcript_path", self.transcript)
        self.assertEqual(self.pair("hook", event, stdin=json.dumps(data)).returncode, 0)

    def state_json(self):
        with open(os.path.join(self.state, "state.json"), encoding="utf-8") as fh:
            return json.load(fh)

    def screen(self):
        return subprocess.run(["tmux", "capture-pane", "-p", "-J", "-t", self.pane],
                              capture_output=True, text=True).stdout

    def wait_for(self, check, seconds=20):
        end = time.time() + seconds
        while time.time() < end:
            if check():
                return True
            time.sleep(0.25)
        return False

    def start_loop(self):
        self.loop = subprocess.Popen([sys.executable, "-I", PAIR, "review-loop"], env=self.env,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    def test_hooks_track_turns_and_rounds(self):
        self.hook("prompt", prompt="add an average function")
        self.hook("tool", tool_name="Read")
        self.hook("tool", tool_name="Edit")
        s = self.state_json()
        self.assertEqual((s["turn"], s["phase"], s["source"], s["rounds"], s["edits"]), (1, "working", "user", 0, 1))
        self.hook("notify", message="Claude needs your permission to use Bash")
        self.assertTrue(self.state_json()["awaiting"])
        self.hook("stop")
        s = self.state_json()
        self.assertEqual((s["phase"], s["stopped_turn"], s["awaiting"]), ("idle", 1, False))
        self.hook("prompt", prompt="[Codex review] (1) fix it")
        self.assertEqual((self.state_json()["source"], self.state_json()["rounds"]), ("codex", 1))
        self.hook("prompt", prompt="thanks, next")
        self.assertEqual(self.state_json()["rounds"], 0)
        # A queued checkpoint note reaches Claude through the next tool call, as hook context.
        write(os.path.join(self.state, "inject.txt"), "[Codex review] (1) mid-turn note")
        out = self.pair("hook", "tool", stdin=json.dumps({"tool_name": "Read"})).stdout
        self.assertEqual(json.loads(out)["hookSpecificOutput"]["additionalContext"], "[Codex review] (1) mid-turn note")
        self.assertFalse(os.path.exists(os.path.join(self.state, "inject.txt")))
        self.assertEqual(self.pair("hook", "tool", stdin="{}").stdout, "")
        # Outside a pair session the hook does nothing and never fails Claude.
        env = dict(self.env, APEXREST_PAIR_STATE="")
        self.assertEqual(self.pair("hook", "stop", stdin="garbage", env=env).returncode, 0)

    def test_review_is_typed_into_claudes_console_then_held_after_the_round_limit(self):
        self.start_loop()
        self.hook("prompt", prompt="add an average function")
        self.hook("tool", tool_name="Edit")
        self.hook("stop")
        self.assertTrue(self.wait_for(lambda: "[Codex review] (1) app.js:3 divides by zero when the list is empty"
                                      in self.screen()), self.screen())
        with open(self.prompts, encoding="utf-8") as fh:
            prompt = fh.read()
        self.assertIn("USER: add an average function", prompt)
        self.assertIn("Claude finished turn 1", prompt)
        self.assertIn('exec -m gpt-6.2-sol -c model_reasoning_effort="high" -s read-only', prompt)
        # Claude answers the Codex message: that turn is reviewed, but with rounds=1 the note is held.
        self.hook("prompt", prompt="[Codex review] (1) app.js:3 divides by zero")
        self.hook("stop")
        pending = os.path.join(self.state, "pending.txt")
        self.assertTrue(self.wait_for(lambda: os.path.exists(pending)))
        self.assertIn("already sent", open(self.prompts, encoding="utf-8").read())
        self.assertEqual(self.screen().count("[Codex review]"), 1)
        self.assertIn("held (send)", self.pair("status").stdout)

    def test_checkpoint_notes_are_queued_not_typed(self):
        self.start_loop()
        self.hook("prompt", prompt="add an average function")
        self.hook("tool", tool_name="Edit")
        old = time.time() - 400
        with open(os.path.join(self.state, "state.lock"), "a"):
            st = self.state_json()
            st.update(last_review_at=0, last_tool=time.time() - 5)
            write(os.path.join(self.state, "state.json"), json.dumps(st))
        inject = os.path.join(self.state, "inject.txt")
        self.assertTrue(self.wait_for(lambda: os.path.exists(inject)))
        self.assertIn("checkpoint while Claude is still working", open(self.prompts, encoding="utf-8").read())
        self.assertNotIn("[Codex review]", self.screen())
        self.assertLess(old, time.time())

    def test_an_interrupted_turn_does_not_stay_working(self):
        st = {"turn": 2, "phase": "working", "awaiting": True, "last_tool": time.time() - 60,
              "turn_started": time.time() - 90, "transcript": self.transcript}
        write(os.path.join(self.state, "state.json"), json.dumps(st))
        self.start_loop()
        self.assertTrue(self.wait_for(lambda: self.state_json().get("phase") == "idle"))
        self.assertFalse(self.state_json()["awaiting"])

    def test_no_notes_types_nothing(self):
        self.env["FAKE_VERDICT"] = "ok"
        self.start_loop()
        self.hook("prompt", prompt="what does this do?")
        self.hook("stop")
        self.assertTrue(self.wait_for(lambda: os.path.exists(self.prompts)))
        self.assertTrue(self.wait_for(lambda: self.state_json().get("reviewed_turn") == 1))
        time.sleep(1)
        self.assertNotIn("[Codex review]", self.screen())

    def test_paused_and_manual_review(self):
        self.pair("pause")
        self.start_loop()
        self.hook("prompt", prompt="add an average function")
        self.hook("stop")
        time.sleep(3)
        self.assertFalse(os.path.exists(self.prompts))
        self.pair("review")
        self.assertTrue(self.wait_for(lambda: "[Codex review]" in self.screen()), self.screen())

    def show(self, *lines):
        """Replace the stand-in console with a screen that prints the given lines."""
        script = os.path.join(self.tmp, "screen.sh")
        write(script, "clear\n" + "".join("printf '%%s\\n' %s\n" % shlex.quote(ln) for ln in lines) + "sleep 60\n")
        subprocess.run(["tmux", "respawn-pane", "-k", "-t", self.pane, "bash " + script], check=True)
        self.pane = subprocess.run(["tmux", "display-message", "-p", "-t", self.session + ":", "#{pane_id}"],
                                   capture_output=True, text=True, check=True).stdout.strip()
        self.assertTrue(self.wait_for(lambda: lines[-1] in self.screen()))

    def test_claudes_prose_is_not_a_dialog_but_working_is_not_idle(self):
        mod = load_pair()
        self.show("Would you like me to also add tests? Do you want to keep the old API?", "  auto mode on")
        self.assertEqual(mod.can_type(self.pane, {}), (True, ""))
        self.show("✻ Thinking…", "  auto mode on (shift+tab to cycle) · esc to interrupt")
        self.assertEqual(mod.can_type(self.pane, {})[1], "Claude is working")

    def test_never_types_into_a_dialog(self):
        mod = load_pair()
        self.show(" Do you want to proceed?", " ❯ 1. Yes", "   2. No", " Enter to confirm · Esc to cancel")
        os.environ["APEXREST_PAIR_STATE"] = self.state
        try:
            ok, why = mod.can_type(self.pane, {})
            self.assertFalse(ok)
            self.assertIn("dialog", why)
            self.assertFalse(mod.deliver(self.state, self.pane, "[Codex review] x", wait=2)[0])
            with open(os.path.join(self.state, "status"), encoding="utf-8") as fh:
                self.assertIn("notes wait: a menu or dialog is open", fh.read())
        finally:
            del os.environ["APEXREST_PAIR_STATE"]

    def test_start_will_not_reattach_a_busy_older_session(self):
        if not (shutil.which("claude") and shutil.which("codex")):
            self.skipTest("claude and codex are needed for start's checks")
        project = os.path.join(self.tmp, "legacyproj%d" % os.getpid())
        os.makedirs(project)
        legacy = "pair-" + os.path.basename(project)
        subprocess.run(["tmux", "new-session", "-d", "-s", legacy, "sleep 60"], check=True)
        try:
            env = dict(self.env, XDG_STATE_HOME=os.path.join(self.tmp, "xdg"))
            env.pop("APEXREST_PAIR_STATE")
            p = subprocess.run([sys.executable, "-I", PAIR, "start", "--detach", project], capture_output=True,
                               text=True, env=env, timeout=30, stdin=subprocess.DEVNULL)
            self.assertEqual(p.returncode, 1)
            self.assertIn("older pair mode", p.stderr)
            self.assertIn("sleep", p.stderr)
        finally:
            subprocess.run(["tmux", "kill-session", "-t", "=" + legacy], capture_output=True)

    def test_session_shows_both_agents_and_codex_state(self):
        mod = load_pair()
        mod.style_session(self.session, self.state)
        opts = subprocess.run(["tmux", "show-options", "-t", self.session], capture_output=True, text=True).stdout
        self.assertIn("Claude works", opts)
        self.assertIn(os.path.join(self.state, "status"), opts)
        wopts = subprocess.run(["tmux", "show-options", "-w", "-t", self.pane], capture_output=True, text=True).stdout
        self.assertRegex(wopts, r"window-status-format (''|\"\")")

    def test_log_command(self):
        self.env["FAKE_VERDICT"] = "ok"
        self.start_loop()
        self.hook("prompt", prompt="hi")
        self.hook("stop")
        self.assertTrue(self.wait_for(lambda: "no notes" in self.pair("log").stdout))

    def test_reviewer_stops_when_claude_is_gone(self):
        subprocess.run(["tmux", "kill-session", "-t", self.session], capture_output=True)
        self.start_loop()
        out, _ = self.loop.communicate(timeout=20)
        self.assertIn("reviewer stopped", out)


class WidgetPairTest(unittest.TestCase):
    """The widget helper lists live pair sessions and controls them."""

    def setUp(self):
        if not shutil.which("tmux"):
            self.skipTest("tmux not installed")
        self.tmp = tempfile.mkdtemp(prefix="apexrest-widget-pair-")
        self.session = "pair-widgettest%d" % os.getpid()
        self.state = os.path.join(self.tmp, "state", "apexrest-omarchy", "pair", self.session)
        os.makedirs(self.state)
        subprocess.run(["tmux", "new-session", "-d", "-s", self.session, "-x", "100", "-y", "20", "cat >/dev/null"],
                       check=True)
        pane = subprocess.run(["tmux", "display-message", "-p", "-t", "=%s:" % self.session, "#{pane_id}"],
                              capture_output=True, text=True, check=True).stdout.strip()
        write(os.path.join(self.state, "config.json"), json.dumps(
            {"project": "/work/demo", "pane": pane, "session": self.session}))
        write(os.path.join(self.state, "state.json"), json.dumps(
            {"turn": 3, "phase": "working", "history": ["a<b> note\nsplit"]}))
        write(os.path.join(self.state, "reviewer.json"), json.dumps({"kind": "held", "text": "x"}))
        write(os.path.join(self.state, "pending.txt"), "[Codex review] (1) a")
        # A dead session's state is ignored.
        os.makedirs(os.path.join(self.tmp, "state", "apexrest-omarchy", "pair", "pair-gone"))
        write(os.path.join(self.tmp, "state", "apexrest-omarchy", "pair", "pair-gone", "config.json"),
              json.dumps({"project": "/x", "pane": "%999", "session": "pair-gone"}))
        self.env = dict(os.environ, XDG_STATE_HOME=os.path.join(self.tmp, "state"))

    def tearDown(self):
        subprocess.run(["tmux", "kill-session", "-t", "=" + self.session], capture_output=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def helper(self, *args):
        p = subprocess.run([sys.executable, "-I", HELPER] + list(args), capture_output=True, text=True,
                           env=self.env, timeout=60)
        return json.loads(p.stdout.strip().splitlines()[-1])

    def test_lists_and_controls_a_live_session(self):
        rows = self.helper("pairs")["pairs"]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual((row["session"], row["name"], row["turn"], row["phase"], row["held"], row["reviewer"]),
                         (self.session, "demo", 3, "working", True, "held"))
        self.assertEqual(row["notes"], ["a<b> note split"])
        self.assertTrue(self.helper("pair", "pause", self.session)["ok"])
        with open(os.path.join(self.state, "state.json"), encoding="utf-8") as fh:
            self.assertTrue(json.load(fh)["paused"])
        self.assertTrue(self.helper("pairs")["pairs"][0]["paused"])
        self.assertTrue(self.helper("pair", "review", self.session)["ok"])
        self.assertFalse(self.helper("pair", "bogus", self.session)["ok"])
        self.assertFalse(self.helper("pair", "pause", "pair-gone")["ok"])
        self.assertFalse(self.helper("pair", "stop", "not-a-pair")["ok"])
        self.assertTrue(self.helper("pair", "stop", self.session)["ok"])
        self.assertEqual(self.helper("pairs")["pairs"], [])

    def test_notifies_only_new_held_or_failed_reviews(self):
        import importlib.machinery
        import importlib.util
        sys.dont_write_bytecode = True
        loader = importlib.machinery.SourceFileLoader("apexrest_omarchy", HELPER)
        mod = importlib.util.module_from_spec(importlib.util.spec_from_loader("apexrest_omarchy", loader))
        loader.exec_module(mod)
        prod = {"name": "prod", "kind": "production", "applicationId": 1, "baseUrl": "https://p.example/ords/"}
        self.assertIsNone(mod.run_target([prod]))
        sent = []
        mod.notify = lambda title, body, urgency="normal": sent.append(title)
        row = {"session": "pair-a", "name": "demo", "held": True, "reviewer": "held", "notes": ["n"]}
        mod.notify_pairs([], [row])
        mod.notify_pairs([row], [row])
        mod.notify_pairs([row], [dict(row, held=False, reviewer="failed")])
        self.assertEqual(sent, ["demo · Codex review held", "demo · Codex review failed"])


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

    def test_run_target(self):
        self.assertEqual(self.run_model('runTarget({environment: "dev", applicationId: 100, url: "http://h:8080/ords/f?p=100"})')["url"],
                         "http://h:8080/ords/f?p=100")
        self.assertIsNone(self.run_model('runTarget({url: "javascript:alert(1)//f?p=1"})'))
        self.assertIsNone(self.run_model('runTarget({url: "http://h/ords/f?p=1&x=<b>"})'))
        self.assertIsNone(self.run_model('runTarget(null)'))

    def test_no_markup(self):
        self.assertNotIn("<", self.run_model('noMarkup("<b>APEX</b>")'))

    def test_local_url(self):
        self.assertEqual(self.run_model('localUrl("http://127.0.0.1:4100/f?p=1")'), "http://127.0.0.1:4100/f?p=1")
        self.assertEqual(self.run_model('localUrl("http://127.0.0.1.evil.com/")'), "")

    def test_pairs(self):
        raw = json.dumps({"ok": True, "pairs": [
            {"session": "pair-demo", "name": "demo", "phase": "working", "reviewer": "evil", "turn": 2,
             "notes": ["a", "", "b\u0000c", "d"], "held": "yes"},
            {"session": "../etc"}, {"session": "pair-x y"}]})
        p = self.run_model("pairs(%s)" % json.dumps(raw))
        self.assertEqual([x["session"] for x in p], ["pair-demo"])
        self.assertEqual((p[0]["reviewer"], p[0]["held"], p[0]["turn"]), ("watching", False, 2))
        self.assertNotIn("\u0000", "".join(p[0]["notes"]))
        self.assertEqual(self.run_model('pairState([{phase: "working"}])'), "active")
        self.assertEqual(self.run_model('pairState([{phase: "working"}, {held: true}])'), "warn")
        self.assertEqual(self.run_model('pairState([])'), "")
        self.assertIsNone(self.run_model('pairs("nope")'))

    def test_garbage(self):
        s = self.run_model('snapshot("not json")')
        self.assertTrue(s["loaded"])
        self.assertNotEqual(s["error"], "")


def tearDownModule():
    subprocess.run(["tmux", "kill-server"], capture_output=True)
    shutil.rmtree(TMUX_DIR, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
