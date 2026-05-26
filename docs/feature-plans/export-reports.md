# Feature Plan: Export Audit Reports (PDF/CSV)

**Effort:** 2-3 days
**Phase:** 2 (Business Features)
**Dependencies:** Pro/Business plan gate

---

## Problem
Users want to share audit results with clients or stakeholders who don't have a SATsec account.
A downloadable PDF report makes SATsec part of agency deliverables.

---

## PDF Export

### Backend
Use `weasyprint` or `reportlab` to generate PDF server-side:
- New endpoint: `GET /results/{audit_id}/export/pdf`
- Renders: scores, issue list by category, timestamp, URL, SATsec branding
- Returns `Content-Type: application/pdf` with `Content-Disposition: attachment`

### PDF Layout
```
┌─────────────────────────────────┐
│  SATsec Audit Report            │
│  example.com | May 25, 2026     │
├─────────────────────────────────┤
│  Overall: 74/100                │
│  Performance 100 | SEO 62       │
│  Accessibility 72 | Security 35 │
├─────────────────────────────────┤
│  Issues Found (16 total)        │
│  [Performance] ...              │
│  [SEO] Missing meta description │
│  [Security] Missing HSTS header │
└─────────────────────────────────┘
```

---

## CSV Export

### Backend
- New endpoint: `GET /audits/export/csv`
- Returns all user's audits as CSV: url, date, performance, seo, accessibility, security, overall
- Useful for tracking trends in Excel / Google Sheets

### Response format
```
url,date,performance,seo,accessibility,security,overall
https://example.com,2026-05-25,100,62,72,35,69.1
```

---

## Frontend Changes
- "Export PDF" button on `/results` page (Pro/Business only — show upgrade prompt for Free)
- "Export CSV" button on `/dashboard` page
- Use `<a href="..." download>` with blob URL for client-side trigger

---

## Library Choice
- `weasyprint` — best HTML→PDF quality, but heavy dependency (~50MB)
- `reportlab` — lighter, more code to write layout manually
- **Recommendation:** weasyprint for MVP, revisit if Docker image size is a concern
