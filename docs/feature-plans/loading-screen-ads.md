# Feature Plan: Loading-Screen Ads (Free-Tier Monetization)

**Effort:** 3-4 days
**Phase:** 2 (Business Features)
**Dependencies:** Ad network account (Google AdSense or Carbon Ads), `/pricing` page (for upsell CTA), cookie/consent banner for GDPR

---

## Problem
The audit runs free for guests and the scan takes ~5-15s, during which `Scanning.jsx`
shows a radar dial doing nothing commercial. That idle attention is wasted inventory.
We want a second revenue stream alongside Stripe subscriptions: after a visitor uses
their **one free audit**, every subsequent scan shows an ad on the loading screen.

Goals:
1. Earn ad revenue from high-intent free traffic.
2. Make the paid plan more attractive — Pro/Business scans are ad-free.
3. Keep the first-ever scan clean (no ad) so first impression stays premium.

Non-goals: ads anywhere except the loading screen; ads for logged-in paying users.

---

## How It Works

Gating runs entirely client-side off the existing guest-audit history.

1. Guest runs first audit → `guestStorage.js` already saves it to `localStorage`
   (`satsec_guest_audits`). Scan count = `getGuestAudits().length`.
2. **First scan** (count 0 when scan starts): no ad. Clean loading screen.
3. **Second scan onward** (count ≥ 1): `Scanning.jsx` renders an ad slot below the
   radar dial while the audit streams.
4. Logged-in users with `plan !== "free"`: never see ads (checked via `useAuth`).
5. Logged-in Free users: see ads same as guests (count from backend audit history,
   not localStorage).

```
guest, scan #1 ........... no ad   (free try)
guest, scan #2+ .......... AD
free user, scan #1 ....... no ad   (free try)
free user, scan #2+ ...... AD
pro/business user ........ no ad   (ever)
```

The scan itself never blocks on the ad — `runAuditStream` runs unchanged. The ad
only fills the visual dead space. If the ad fails to load, the loading screen
degrades gracefully to its current layout.

---

## Free-Try Counter

Reuse what exists. `getGuestAudits()` returns the saved array; its length **before**
the current scan saves is the "tries used" count.

Edge case: the current scan hasn't saved yet when `Scanning.jsx` mounts
(`saveGuestAudit` runs *after* the result lands, line 72). So at mount time
`getGuestAudits().length` is the count of *prior completed* scans — exactly the
gate we want. `length >= 1` → show ad.

```js
// frontend/src/utils/adGate.js  (new)
import { getGuestAudits } from './guestStorage'

// Returns true if the loading screen should show an ad for this scan.
// freeTry = the very first scan is always ad-free.
export function shouldShowLoadingAd({ isLoggedIn, plan, guestAuditCount }) {
  if (isLoggedIn && plan && plan !== 'free') return false   // paid = no ads
  const priorScans = isLoggedIn
    ? guestAuditCount            // from backend history for logged-in free users
    : getGuestAudits().length    // from localStorage for guests
  return priorScans >= 1         // ad on 2nd scan onward
}
```

---

## Frontend Changes

### 1. New `AdSlot` component (`frontend/src/components/AdSlot.jsx`)
Wraps the ad-network embed. Self-contained so the network can be swapped without
touching `Scanning.jsx`.

```jsx
import { useEffect, useRef } from 'react'

// Renders one responsive ad unit. No-op (renders nothing) if the network
// script failed to load — never breaks the loading screen.
export default function AdSlot({ slot }) {
  const ref = useRef(null)
  useEffect(() => {
    try {
      // AdSense: push the slot once mounted
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch { /* network blocked / adblock — fail silent */ }
  }, [])

  return (
    <ins
      ref={ref}
      className="adsbygoogle block"
      style={{ display: 'block', minHeight: 90 }}
      data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
```

### 2. Wire into `Scanning.jsx`
Add below the radar dial / above or below the stage checklist. Gate with `adGate`.

```jsx
import AdSlot from '../components/AdSlot'
import { shouldShowLoadingAd } from '../utils/adGate'
import { useAuth } from '../contexts/AuthContext'

// inside component:
const { isLoggedIn, user } = useAuth()
const showAd = shouldShowLoadingAd({
  isLoggedIn,
  plan: user?.plan,
  guestAuditCount: user?.audit_count ?? 0,
})

// in JSX, after the radar dial block (~line 118):
{showAd && (
  <div className="my-6 w-full rounded-xl border border-white/[0.06] bg-surface/40 p-3">
    <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wide text-ink-ghost">
      Advertisement · <a href="/pricing" className="text-accent hover:underline">remove ads with Pro</a>
    </div>
    <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_LOADING} />
  </div>
)}
```

### 3. Load the network script once (`frontend/index.html`)
```html
<script async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX"
  crossorigin="anonymous"></script>
```

### 4. Consent banner (GDPR/ePrivacy)
Personalized ads need consent in the EU. Add a lightweight cookie-consent banner
(e.g. `vanilla-cookieconsent`) and pass non-personalized fallback when declined:
`data-npa="1"` on the ad request until consent is given.

---

## Backend Changes (minimal)

Loading ads are client-gated, so backend work is small.

### 1. Expose plan + audit count to the frontend
`/auth/me` (or wherever `useAuth` hydrates `user`) must return:
```python
{ "plan": user.plan, "audit_count": user.total_audits }
```
`total_audits` — count of the user's completed audits (for the logged-in Free
free-try gate). Add as a column or a `COUNT(*)` on the audits table.

### 2. No ad serving on the backend
Ads are served by the network's JS directly to the browser. The backend never
proxies ad content.

---

## Ad Network Choice

| | Google AdSense | Carbon Ads | EthicalAds |
|---|---|---|---|
| Approval | Easy, needs traffic | Curated, dev-focused | Dev-focused |
| Fill rate | High | Low (single sponsor) | Medium |
| Aesthetic | Generic | Clean, one tasteful ad | Clean |
| Revenue model | CPC/CPM | Fixed CPM | CPM |
| Fit for a dev tool | OK | **Best fit** | Good |

**Recommendation:** start with AdSense for fill rate + fast approval; A/B against
Carbon Ads once traffic justifies a curated network (Carbon's single tasteful ad
matches the monochrome aesthetic far better than AdSense banners).

---

## Setup Steps
1. Apply for AdSense at adsense.google.com — needs a live domain with traffic.
2. After approval, create one ad unit ("SATsec Loading — Responsive").
3. Add to frontend `.env`:
   ```
   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
   VITE_ADSENSE_SLOT_LOADING=XXXXXXXXXX
   ```
4. Add the `adsbygoogle.js` script tag to `index.html`.
5. Add the consent banner before serving personalized ads in the EU.
6. Test with adblock on (must degrade silently) and off (must render).

---

## Revenue Model (rough)

Assumptions: loading-screen ad shows ~3-5s per qualifying scan.

| Metric | Estimate |
|---|---|
| Qualifying scans/month | depends on traffic — e.g. 10,000 |
| Avg display CPM (AdSense, dev niche) | $2–5 |
| Monthly ad revenue | ~$20–50 per 10k scans |

Ads are **supplemental**, not primary. The bigger lever is conversion: a visible
"remove ads with Pro" link turns the ad itself into an upsell for the $29/mo plan.
Track click-through on that link as a funnel into `/pricing`.

---

## Risk

| Risk | Mitigation |
|---|---|
| Ads cheapen a security/audit brand | Use one tasteful unit (Carbon) not banner spam; ad-free for paid |
| Adblock kills fill rate | `AdSlot` fails silent; revenue is bonus, not core |
| GDPR/ePrivacy fines for tracking | Consent banner + non-personalized fallback before any EU personalized ad |
| AdSense rejects/ bans the account | Keep Carbon/EthicalAds as backup; don't depend on ad revenue for runway |
| Ad slows perceived load | Ad never blocks `runAuditStream`; loads async in dead space only |
| Free-try count gamed via cleared localStorage | Acceptable — guests clearing storage to dodge one ad is low-value abuse |

---

## Open Questions
- Show ad on **every** post-free scan, or cap frequency (e.g. every other scan) to
  reduce annoyance? Start with every scan, measure bounce.
- Ad placement: below radar dial vs. below stage checklist? A/B for CTR vs. perceived
  intrusiveness.
- Should logged-in Free users get more free tries than guests (e.g. 3) as a signup
  incentive? Ties into `pricing-tiers.md` Free tier (5/day).
