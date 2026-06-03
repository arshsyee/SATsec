# Live Monitoring — Positioning & Sales

This document captures *why* continuous monitoring is SATsec's wedge into the market, how to explain it, and how to sell it. It complements [competitive-analysis.md](competitive-analysis.md) and [go-to-market.md](go-to-market.md).

---

## The competitive gap

No competitor monitors all four dimensions **continuously** in one place. They each own one slice, mostly as one-time scans.

| Tool | Performance | SEO | Accessibility | Security | Continuous? |
|---|:---:|:---:|:---:|:---:|---|
| Google Lighthouse | ✓ | ✓ | ✓ | partial | ✗ one-time |
| GTmetrix | ✓ | | | | paid plans only |
| Ahrefs / Semrush | | ✓ | | | ✓ but $99–$500/mo |
| WAVE / axe | | | ✓ | | ✗ one-time |
| SecurityHeaders.io | | | | ✓ | ✗ one-time |
| **SATsec** | ✓ | ✓ | ✓ | ✓ | **✓** |

**The moat is the combination, not any single check.** Anyone can build an SEO checker. The defensible product is *post-deploy regression detection across all four dimensions, on a continuous schedule, with one alert pipeline.*

---

## The one-line pitch

> "Every time you ship code, SATsec tells you within hours if you broke your SEO, tanked your accessibility score, or introduced a security hole — before Google or your users notice."

Variant for non-technical buyers:

> "We watch your website like a security camera. Any regression in speed, search ranking, accessibility, or security triggers an alert within minutes."

---

## Three buyer angles (ranked by willingness to pay)

### 1. ADA / accessibility liability — highest urgency
Website accessibility lawsuits have climbed sharply since 2018. Companies get sued for non-compliant sites and settle fast. Legal and compliance teams write checks when the message is:

> "We monitor your WCAG compliance continuously and alert you the moment a deploy breaks it — before you're exposed."

This is the angle with the shortest sales cycle because the cost of *not* buying is a concrete legal risk, not a vague optimization.

### 2. Agencies — volume play, first real revenue
An agency managing 20+ client sites needs this across every site. One dashboard, monthly report card per client, regression alerts they can act on before the client notices.

- Sell to the agency, not the end client.
- One agency account = 20 monitored sites = 20× the value of a single end user.
- The monthly per-client report is a tangible deliverable they can bill against.

### 3. Post-deploy regression detection — the developer story
The relatable failure mode:

> Dev ships at 11pm Friday. A meta title tag disappears. Nobody notices until Monday when rankings drop. SATsec catches it at 11:15pm Friday.

This is the demo that lands with technical buyers. It reframes SATsec from "another audit tool I run occasionally" to "the safety net that runs itself."

---

## Why both uptime ping *and* full audit

"Live monitoring" splits into two products with very different costs and value. We ship both — they reinforce each other.

| | Uptime ping | Full audit |
|---|---|---|
| Frequency | every 1–5 min | every 6 / 12 / 24 h |
| Cost per check | 1 HEAD request, <1s | ~20 requests, 10–80s |
| Answers | "Is my site up right now?" | "Did my site quietly regress?" |
| Buyer feeling | real-time peace of mind | proactive depth |

The uptime ping is the **hook** — cheap, real-time, the thing buyers check obsessively. The full audit is the **depth** — the four-dimensional regression detection nobody else combines. Together they're a product with no direct competitor.

See the feature spec: [../feature-plans/live-monitoring.md](../feature-plans/live-monitoring.md).

---

## What NOT to say

- Don't pitch "we run audits more often." More-frequent full audits are wasteful (SEO/accessibility don't change minute-to-minute) and expensive. The frequency story is the *uptime ping*, not the full audit.
- Don't lead with feature breadth ("four categories!"). Lead with the *outcome* — caught regressions, avoided lawsuits, protected rankings.
