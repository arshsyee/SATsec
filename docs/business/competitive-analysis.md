# Competitive Analysis

---

## Direct Competitors

### Google Lighthouse / PageSpeed Insights
| | Lighthouse | SATsec |
|---|---|---|
| Price | Free | Free + paid |
| Monitoring | One-time only | Continuous |
| Alerts | None | Email + webhook |
| Accessibility | Basic | WCAG AA (12+ checks) |
| Security headers | None | 8 headers checked |
| SSL expiry | None | Yes — alerts at 60/30/14 days |
| History/trends | None | Full chart history |
| Scheduling | None | 6h / daily / weekly |

**Verdict:** Lighthouse is the benchmark tool everyone knows. SATsec is the monitoring layer on top of it. Positioning: "Lighthouse tells you what's wrong once. SATsec tells you when it breaks."

---

### GTMetrix
| | GTMetrix | SATsec |
|---|---|---|
| Price | Free / $14.95-$41.25/mo | Free / $29-99/mo |
| Focus | Performance only | Performance + SEO + Accessibility + Security |
| Monitoring | Yes (paid) | Yes (free tier limited) |
| Accessibility | None | WCAG AA focused |
| Security | None | 10+ security checks |
| AI summaries | None | Yes (Pro/Business) |

**Verdict:** GTMetrix owns the performance monitoring space. SATsec's advantage is breadth (4 categories vs. 1) and the accessibility/security angle which is increasingly important for legal compliance.

---

### Semrush Site Audit
| | Semrush | SATsec |
|---|---|---|
| Price | $139-499/mo | $29-99/mo |
| Focus | SEO (200+ checks) | SEO + Performance + Accessibility + Security |
| Accessibility | None | Yes |
| Security headers | None | Yes |
| Learning curve | High | Low |
| Target user | SEO professionals | Developers, agencies, SMBs |

**Verdict:** Semrush is overkill for most users and 5-15x the price. SATsec targets users who don't need keyword research — just "is my site healthy?"

---

### Ahrefs Site Audit
Same story as Semrush — SEO-focused, expensive, complex. Not a direct competitor.

---

### WAVE (WebAIM Accessibility Checker)
| | WAVE | SATsec |
|---|---|---|
| Price | Free / $4/mo per URL | Free / $29-99/mo |
| Focus | Accessibility only | Accessibility + 3 other categories |
| Monitoring | Limited | Yes |
| WCAG version | WCAG 2.1 | WCAG 2.1 AA |

**Verdict:** WAVE is the accessibility specialist. SATsec checks accessibility as part of a holistic score. For teams who need deep accessibility auditing, WAVE wins. For teams who need accessibility awareness alongside other metrics, SATsec is simpler.

---

## SATsec's Defensible Advantages

1. **Breadth** — 4 categories in one tool, one score, one dashboard
2. **Price** — 3-10x cheaper than Semrush/GTMetrix for what it does
3. **Accessibility focus** — 30% weight on accessibility is a legal compliance angle competitors ignore
4. **Developer-friendly** — API keys, webhooks, CI/CD integration (Phase 3)
5. **AI summaries** — Plain-English "what to fix and why" — none of the competitors have this

---

## Opportunities Competitors Miss

- **ADA compliance reporting** — Accessibility lawsuits against SMBs are rising. None of the affordable tools position around legal risk.
- **SSL expiry alerts** — A surprisingly common way sites go down. GTMetrix and Semrush don't check this.
- **Consolidated score** — Lighthouse gives you 4 separate audits with no combined view. SATsec's overall score is the headline metric.

---

## See also

- [live-monitoring-positioning.md](live-monitoring-positioning.md) — the continuous-monitoring wedge, sales pitch, buyer personas, and cost model that turn this analysis into revenue.
