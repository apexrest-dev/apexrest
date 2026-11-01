# Cross-vendor peer review

Use when `apexrest.json` sets `peerReview.mode` to `advisory` or `required`, or when the user asks for a second-agent review.

1. Create a saved plan with `apexrest_ship mode:plan`.
2. Call `apexrest_peer_review action:review` with that `planPath` and `vendor` set to the other vendor: `codex` when you are Claude Code, `claude` when you are Codex. It runs that CLI read-only under the user's own sign-in and records a verdict bound to the plan digest. Wait with `apexrest_job action:status` when it is still running; peer reviews take minutes.
3. Report every finding to the user with its severity. On `changes_requested`, fix the sources, plan again and review the new plan. Never edit the review record.
4. Apply the reviewed saved plan with `apexrest_ship mode:apply plan:<planPath>`. `required` blocks apply without an approving review of that exact digest; `advisory` reports the review state.

Local-only work with no Oracle target: omit `planPath` to review the current sources. That source-bound verdict is advisory and never unlocks a `required` apply.

`action:status` checks that the peer CLI is installed and signed in. When it is not, tell the user the login command (`codex login` or `claude auth login`); never request or relay credentials. The peer never deploys and has no database access. Peer runs use the other vendor's subscription limits or API billing.
