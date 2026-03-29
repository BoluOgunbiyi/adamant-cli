# Adamant Vision: The 20-Star Roadmap

> A PM describes what they want. Adamant ships it. At the far end of this roadmap, the loop closes completely.

This document maps where Adamant is going — from a smarter Jira ticket to a fully autonomous product-engineering partner. Each star represents a meaningful leap in what a PM can do without writing a line of code.

---

## Stars 1–10: The Near-Term Roadmap

*From "better tickets" to "no tickets at all."*

### ⭐ Star 1 — The Smart Ticket
A PM writes a wish and gets back a Jira-quality ticket: user story, acceptance criteria, edge cases. Adamant does the translation from rough idea to structured spec. Still needs an engineer to build it.

### ⭐⭐ Star 2 — Wish-to-PR (Scaffolded)
Adamant opens a PR for simple, well-understood changes — copy updates, config tweaks, style fixes. Works reliably on shallow changes. Requires explicit, precise wishes.

### ⭐⭐⭐ Star 3 — One Sentence Gets a PR *(where we are today)*
A single plain-English sentence becomes a pull request in under 60 seconds. Adamant reads the codebase, finds the right files, writes the fix, and opens a draft PR. The PM reviews and merges. No ticket. No engineer handoff.

### ⭐⭐⭐⭐ Star 4 — Wish Refinement Loop
Adamant asks clarifying questions before acting when the wish is ambiguous. "Did you mean the checkout page or the cart summary?" Fewer wrong-direction PRs, higher first-try success rate.

### ⭐⭐⭐⭐⭐ Star 5 — Multi-File, Multi-Step Wishes
Complex wishes that span multiple files, components, and systems — a full feature, not just a fix. Adamant plans the change sequence, makes coordinated edits, and explains what it did and why.

### ⭐⭐⭐⭐⭐⭐ Star 6 — Proactive UX Friction Scan
`adamant scan` runs across the entire codebase and surfaces problems before users hit them: slow pages, broken mobile layouts, confusing error states, inaccessible components. Adamant finds friction you didn't know to look for and proposes fixes unprompted.

### ⭐⭐⭐⭐⭐⭐⭐ Star 7 — Browser Extension + CLI
The Adamant Chrome extension watches what users actually experience — screenshots, rage clicks, dead ends, error states. When a PM spots a problem in the browser, they click "wish" and the CLI automatically generates and opens the PR. No copy-paste, no ticket. The signal flows directly from what the user sees to a code fix on GitHub.

### ⭐⭐⭐⭐⭐⭐⭐⭐ Star 8 — Always-On Daemon
Adamant runs continuously in the background. It watches your error logs, your analytics events, your support queue. When it sees a pattern — a spike in 500s, a broken funnel, a surge in confusion on one page — it opens a draft PR without being asked. A PM wakes up to fixes, not alerts.

### ⭐⭐⭐⭐⭐⭐⭐⭐⭐ Star 9 — End-to-End Ownership
Adamant handles the full wish lifecycle: wish → PR → review comments → revisions → merge-ready. It responds to engineer feedback on PRs, updates the code, and keeps iterating until the PR ships. PMs stay in the loop; engineers stay out of the weeds.

### ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐ Star 10 — The PM Never Opens a Ticket Again
The Jira board is empty. Not because work stopped, but because Adamant handles the translation from product intent to shipped code end-to-end. PMs describe outcomes. Engineers review and merge. The ticket, the spec, the handoff — gone.

---

## Stars 11–20: The Long-Term Vision

*From "no tickets" to "no limits."*

### ⭐×11 — Engineers Want PM PRs
The quality of Adamant-generated PRs rivals what engineers write themselves. Clean diffs, good commit messages, sensible abstractions, no shortcuts. Engineers stop treating PM PRs as cleanup work and start treating them as trusted contributions. The stigma around "AI-generated code" disappears.

### ⭐×12 — PRs Ship With Tests
Every PR Adamant opens includes tests — unit, integration, or end-to-end depending on what changed. Engineers don't have to add coverage after the fact. QA doesn't have to regression-test manually. Adamant writes the code and proves it works.

> **Risk Scoring.** At this star, every PR also gets a risk label — Low, Medium, or High — based on which files were touched. Adamant knows the difference. A CSS change on a marketing page is Low: ship it. A change to the auth flow, a database schema migration, or a payment handler is High: flag it, slow it down, require explicit approval. The label appears in the PR title and description, so reviewers can calibrate their attention before they read a single line of code. High-risk PRs get extra context: what could go wrong, what to test manually, and which other files might be affected.

### ⭐×13 — Understands Product Roadmap, Prioritizes by Business Impact
Adamant knows what your company is trying to do. It reads your roadmap, your OKRs, your north star metrics. When multiple wishes are in queue, it sequences them by expected business impact — not order received. It flags when a wish conflicts with a strategic priority and suggests alternatives.

> **Where the moat gets real: Star 13.** At this level, Adamant isn't just a faster engineer — it's a thinking partner. Generic AI tools can write code. Only Adamant knows *your* roadmap, *your* metrics, *your* business priorities. Every team that uses Adamant trains it on their strategic context, and that context compounds. The product becomes irreplaceable because it knows things about your business that no off-the-shelf tool ever will.

### ⭐×14 — Customers Make Wishes Directly
No PM in the loop. A customer submits feedback — in a support widget, a Slack message, a survey — and Adamant triages it, decides if it's worth a code change, and opens a PR if so. The feedback-to-fix cycle collapses from weeks to hours. PMs shift from managing requests to reviewing outcomes.

### ⭐×15 — Watches Production Metrics and Auto-Fixes Revenue Drops
Adamant monitors live dashboards — conversion rates, revenue per session, funnel drop-off, retention curves. When a metric moves in the wrong direction, it diagnoses the cause, writes a fix, and opens a PR before anyone notices the problem. The on-call engineer becomes optional for a class of issues that used to page them at 2am.

> **Outcome Tracking.** Every PR Adamant opens at this star gets linked to a specific PostHog metric — the one it was trying to move. Seven days after merge, Adamant checks back automatically: did the conversion rate go up? Did the drop-off on that step decrease? The result gets posted as a comment on the original PR: "This fix improved checkout completion by 4.2%" or "No measurable change detected — may need a different approach." The wish-to-PR loop becomes the wish-to-PR-to-outcome loop. Every change has a verdict.

### ⭐×16 — Runs A/B Tests on Its Own PRs and Rolls Back if Metrics Don't Improve
Adamant doesn't just ship changes — it validates them. It wraps each PR in a feature flag, runs a controlled experiment, monitors the metric it was trying to improve, and either promotes the change or rolls it back. No human needs to design the experiment. Adamant closes the loop between "shipped" and "worked."

> **Closing the loop.** Building on the outcome tracking from Star 15, this star makes the loop fully automated. Adamant doesn't just report what happened — it acts on it. If the PostHog data shows the metric didn't move after 7 days, Adamant opens a follow-up PR with a revised approach. If it moved in the wrong direction, it rolls back. The PM's job shifts from "did that fix work?" to reviewing Adamant's own retrospectives on what it shipped.

### ⭐×17 — Multi-Repo Coordinated PRs
A single wish spans multiple repositories: the frontend, the API, the mobile app, the data pipeline. Adamant understands the dependency graph, sequences the changes correctly, and opens coordinated PRs across repos. What used to require a tech lead to orchestrate happens in seconds.

### ⭐×18 — Generates PRD + Spec + Design Mockup + Test Plan From a Wish
A PM describes a new feature in one sentence. Adamant produces the full artifact stack: product requirements document, engineering spec, wireframe-quality design mockup, and test plan — before writing a line of code. Review it, approve it, and Adamant builds it. The discovery-to-delivery process compresses by an order of magnitude.

### ⭐×19 — Trains on Your Company Codebase and Thinks Like Your PM
Adamant has absorbed everything: your codebase patterns, your team's naming conventions, your past decisions and the reasoning behind them, your PM's instincts about what users want. It doesn't just execute wishes — it anticipates them. It proposes changes you hadn't thought to ask for, in the style your team would have written, aligned with what your customers care about.

> **Where the moat gets real again: Star 19.** This is the flywheel. Every wish Adamant fulfills teaches it more about your codebase. Every PR it opens teaches it more about your team's standards. Every outcome it measures teaches it more about your users. A competitor can copy the product. They cannot copy the training data your company has built by using it. The longer you use Adamant, the smarter it gets about *your specific world* — and the wider the gap grows between Adamant-on-your-codebase and any generic alternative. This is the moat.

### ⭐×20 — PM Describes Quarter Goals. Adamant Does the Rest.
A PM writes three sentences: what the company is trying to achieve this quarter, what success looks like, and what users are asking for. Adamant breaks the quarter into wishes, sequences the work by dependencies and impact, ships PRs week by week, measures outcomes against the goals, and adjusts the plan when reality diverges from the model. The PM's job becomes setting direction and reviewing results. Everything in between is Adamant.

---

## The Two Places the Moat Gets Real

Most AI coding tools are commodity — the same model, the same context window, the same generic output. Adamant's defensibility comes from two specific moments where context compounds into something a competitor can't replicate:

**Star 13: Strategic context.** When Adamant understands your roadmap and can sequence work by business impact, it stops being a tool and starts being a decision-maker. That requires deep, specific knowledge of what your company is trying to do and why — knowledge that accumulates over time and can't be transferred to a blank-slate competitor.

**Star 19: Organizational memory.** When Adamant has trained on your codebase, your PRs, your PM's past decisions, and your customers' behavior, it has internalized something that took your team years to build. A new tool starting from scratch has none of that. Every wish you make is training data. Every PR you merge is signal. The flywheel spins faster the longer you use it, and slower for anyone who starts over.

The vision isn't a smarter command-line tool. It's a system that gets better the more you use it, knows your business better than any new hire, and compounds that knowledge into product velocity that compounds quarter over quarter.

---

## THE MOAT: Adamant as the Ledger of Why Code Exists

Most AI coding tools answer the question *what does this code do?* Adamant answers a harder question: *why does this code exist?*

Every wish is a record of intent. A PM typed a sentence, Adamant scoped it to specific files, opened a PR, measured the outcome. That chain — intent → scope → risk → outcome → accuracy — is logged, versioned, and accumulated over time. No other tool has it, because no other tool sits at the moment the intent is formed.

This is the moat. Not code generation — anyone can generate code. The moat is the causal chain from business intent to scoped change to risk profile to measured outcome, repeated thousands of times across every team that uses Adamant. Over time, Adamant becomes the institutional memory of *why your product looks the way it does*. New engineers can read the wish history and understand decisions that would otherwise be lost in Slack threads and faded memory. Auditors can trace a change back to the business intent that drove it. PMs can see which wishes actually moved metrics and which didn't.

The compounding effect: every wish that gets measured and validated makes the next wish more accurate. Every outcome that gets logged makes the risk scoring smarter. Every pattern across teams makes the intent-to-scope translation more reliable. A competitor starting today starts with zero of this signal. A team that has used Adamant for a year has built something that cannot be replicated by switching tools.

**The ledger is the product. The code is a side effect.**

---

## THE GROWTH TEAM WEDGE: The Sharpest Go-to-Market Angle

The team most immediately primed for Adamant is not engineering. It's growth.

Growth and conversion teams live and die by a loop: form a hypothesis, run an experiment, measure the delta, ship the winner, repeat. Every part of that loop except "measure the delta" currently requires an engineer. A PM on a growth team has a hypothesis about why users are dropping off on step 3 of checkout. Writing the fix, scoping it, opening the PR, deploying it, watching the metrics — all of that sits in an engineering queue that moves at engineering speed, not growth speed.

Adamant collapses that queue. The loop becomes:

**Hypothesis → wish → scoped PR → merge → PostHog delta → next hypothesis.**

No ticket. No sprint planning. No "we'll get to it next cycle." A growth PM can run three experiments in the time it used to take to get one into the queue. The ROI is direct and revenue-linked: faster experimentation velocity means more winners shipped per quarter, which means more conversion, more retention, more revenue.

This is why growth teams are the wedge. They already think in hypotheses and metrics. They already have PostHog or Mixpanel or Amplitude open all day. They already know the number they're trying to move. Adamant just removes the friction between the hypothesis and the shipped test.

The pitch to a growth team is not "save engineering time." It's: **"Run twice as many experiments this quarter. Each one comes with a measured outcome. Your roadmap becomes a ranked list of what actually worked."**

That's a pitch with a number attached. Growth teams buy on numbers.

---

*Current status: ⭐⭐⭐ Star 3. One sentence. One PR. 60 seconds.*
