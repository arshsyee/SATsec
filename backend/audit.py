import requests
from bs4 import BeautifulSoup
import time
import ssl
import socket
import re
import math
from collections import Counter
from datetime import datetime
from urllib.parse import urlparse


# --------------------------------------------
# COLOR / STYLE HELPERS (WCAG contrast support)
# --------------------------------------------
def _parse_inline_style(style: str) -> dict:
    """Split an inline style attribute into a {property: value} dict (lowercased keys)."""
    decls = {}
    for part in (style or "").split(";"):
        if ":" in part:
            key, _, value = part.partition(":")
            decls[key.strip().lower()] = value.strip()
    return decls


def _parse_color(value: str):
    """Parse a CSS hex or rgb()/rgba() color into an (r, g, b) tuple, or None if unparseable."""
    if not value:
        return None
    value = value.strip().lower()
    if value.startswith("#"):
        hex_part = value[1:]
        if len(hex_part) == 3:
            try:
                return tuple(int(c * 2, 16) for c in hex_part)
            except ValueError:
                return None
        if len(hex_part) == 6:
            try:
                return tuple(int(hex_part[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                return None
        return None
    if value.startswith("rgb"):
        nums = re.findall(r"[\d.]+", value)
        if len(nums) >= 3:
            try:
                return tuple(max(0, min(255, int(float(n)))) for n in nums[:3])
            except ValueError:
                return None
    return None


def _relative_luminance(rgb) -> float:
    """WCAG relative luminance of an (r, g, b) tuple (0-255 channels)."""
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def _contrast_ratio(c1, c2) -> float:
    """WCAG contrast ratio between two (r, g, b) colors (always >= 1.0)."""
    l1 = _relative_luminance(c1)
    l2 = _relative_luminance(c2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# --------------------------------------------
# SCORING ENGINE (multiplicative retention model)
# --------------------------------------------
# Each category score = 100 * product of per-finding retention factors.
# A finding multiplies the running score by a severity-based factor in (0, 1].
# This is bounded to (0, 100], never clamps to 0, and needs no hard caps:
# many small issues compound gently, one critical issue dominates correctly.
SCORING_VERSION = 2

# How much of the score a single finding RETAINS, by severity tier.
# Lower = harsher. Tunable.
TIER_RETENTION = {
    "critical": 0.55,
    "serious": 0.80,
    "moderate": 0.92,
    "minor": 0.97,
}

# Category weights for the overall (must sum to 1.0).
CATEGORY_WEIGHTS = {
    "performance": 0.25,
    "seo": 0.25,
    "accessibility": 0.30,
    "security": 0.20,
}

# A critical security finding caps the headline overall at this ceiling,
# so a single catastrophic hole (e.g. no HTTPS) can't be averaged away.
CRITICAL_OVERALL_CAP = 59.0


class Findings:
    """Accumulates audit findings and computes a multiplicative retention score.

    Repeated violations of the same finding compound sub-linearly via a
    1 + ln(count) exponent: count=1 applies the tier factor once, larger
    counts keep lowering the score (so 4 vs 40 violations still differ) but
    never collapse it to exactly 0.

    Backward compatible: result() still exposes {"score", "issues"}; it also
    adds {"tiers", "has_critical"} which downstream callers may ignore.
    """

    def __init__(self):
        self.issues = []      # message strings, in order (existing contract)
        self.tiers = []       # parallel severity tier per issue
        self._factors = []    # retention factor per scored finding
        self.has_critical = False

    def add(self, message: str, tier: str, count: int = 1):
        """Record a scored finding. `count` scales severity sub-linearly."""
        self.issues.append(message)
        self.tiers.append(tier)
        base = TIER_RETENTION[tier]
        exponent = 1.0 + math.log(count) if count and count > 1 else 1.0
        self._factors.append(base ** exponent)
        if tier == "critical":
            self.has_critical = True

    def note(self, message: str):
        """Surface an informational message without affecting the score."""
        self.issues.append(message)
        self.tiers.append("info")

    def result(self) -> dict:
        score = 100.0
        for factor in self._factors:
            score *= factor
        return {
            "score": round(max(score, 0.0), 1),
            "issues": self.issues,
            "tiers": self.tiers,
            "has_critical": self.has_critical,
        }


def _letter_grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


# -----------------------------------------
# MAIN AUDIT FUNCTION
# -----------------------------------------
def run_audit(url: str) -> dict:
    print(f"[SATsec] Starting audit for {url}")

    page = fetch_page(url)
    if page is None:
        return error_result(url, "Could not fetch the page. Check the URL and try again.")

    html = page["html"]
    load_time = page["load_time"]
    response = page["response"]
    soup = BeautifulSoup(html, "html.parser")

    performance = audit_performance(soup, html, load_time, response)
    seo = audit_seo(soup, url)
    accessibility = audit_accessibility(soup)
    security = audit_security(url, response)

    result = _assemble_result(url, performance, seo, accessibility, security)
    print(f"[SATsec] Audit complete for {url} — Overall: {result['scores']['overall']} ({result['grade']})")
    return result


def _assemble_result(url, performance, seo, accessibility, security) -> dict:
    """Combine the four category audits into the final scored result.
    Shared by run_audit and run_audit_staged so both produce identical output."""
    categories = {
        "performance": performance,
        "seo": seo,
        "accessibility": accessibility,
        "security": security,
    }

    # Overall = weighted GEOMETRIC mean of category scores. Unlike an
    # arithmetic mean, a single weak category drags the overall down hard —
    # it can't be averaged away by strong categories. Scores are floored at
    # 1.0 before the log so a 0 category yields a low (not undefined) overall.
    log_sum = sum(
        weight * math.log(max(categories[name]["score"], 1.0))
        for name, weight in CATEGORY_WEIGHTS.items()
    )
    overall = math.exp(log_sum)

    # Critical gate: a critical SECURITY finding (e.g. no HTTPS, expired cert)
    # caps the headline so it can never read as a passing grade.
    if security.get("has_critical"):
        overall = min(overall, CRITICAL_OVERALL_CAP)
    overall = round(overall, 1)

    # Aggregate severity tier counts across all categories (skip "info").
    tier_counts = Counter()
    for cat in categories.values():
        tier_counts.update(t for t in cat.get("tiers", []) if t != "info")

    return {
        "url": url,
        "scores": {
            "performance": performance["score"],
            "seo": seo["score"],
            "accessibility": accessibility["score"],
            "security": security["score"],
            "overall": overall
        },
        # Grouped by sector — used by frontend for sectioned display
        "issues": {
            "performance": performance["issues"],
            "seo": seo["issues"],
            "accessibility": accessibility["issues"],
            "security": security["issues"]
        },
        # Flat list — used internally for DB storage and AI summary
        "issues_flat": (
            performance["issues"] +
            seo["issues"] +
            accessibility["issues"] +
            security["issues"]
        ),
        # --- Additive scoring metadata (v2) — older consumers can ignore ---
        "grade": _letter_grade(overall),
        "tier_counts": {
            "critical": tier_counts.get("critical", 0),
            "serious": tier_counts.get("serious", 0),
            "moderate": tier_counts.get("moderate", 0),
            "minor": tier_counts.get("minor", 0),
        },
        "scoring_version": SCORING_VERSION,
        "ai_summary": None,
        "error": None
    }


# -----------------------------------------
# STAGED AUDIT (generator for streaming progress)
# -----------------------------------------
# Ordered stages exposed to the client. Single source of truth for labels so
# the loading UI shows exactly what the backend is really doing.
AUDIT_STAGES = [
    {"id": "fetch",         "label": "Fetching page"},
    {"id": "performance",   "label": "Auditing performance"},
    {"id": "seo",           "label": "Analyzing SEO & links"},
    {"id": "accessibility", "label": "Scanning accessibility (WCAG)"},
    {"id": "security",      "label": "Inspecting security & SSL"},
    {"id": "compile",       "label": "Compiling report"},
]


def run_audit_staged(url: str):
    """
    Generator version of run_audit. Yields progress events as each real stage
    runs, then the final result. Reuses the same stage functions as run_audit,
    so scores are identical — only the progress reporting is added.

    Event shapes:
      {"type": "init",   "url": str, "stages": [...]}
      {"type": "stage",  "id": str, "status": "running" | "done"}
      {"type": "result", "result": {...}}
      {"type": "error",  "message": str}
    """
    print(f"[SATsec] Starting staged audit for {url}")
    yield {"type": "init", "url": url, "stages": AUDIT_STAGES}

    # ── fetch ──
    yield {"type": "stage", "id": "fetch", "status": "running"}
    page = fetch_page(url)
    if page is None:
        yield {"type": "error", "message": "Could not fetch the page. Check the URL and try again."}
        return
    soup = BeautifulSoup(page["html"], "html.parser")
    yield {"type": "stage", "id": "fetch", "status": "done"}

    # ── performance ──
    yield {"type": "stage", "id": "performance", "status": "running"}
    performance = audit_performance(soup, page["html"], page["load_time"], page["response"])
    yield {"type": "stage", "id": "performance", "status": "done"}

    # ── seo ──
    yield {"type": "stage", "id": "seo", "status": "running"}
    seo = audit_seo(soup, url)
    yield {"type": "stage", "id": "seo", "status": "done"}

    # ── accessibility ──
    yield {"type": "stage", "id": "accessibility", "status": "running"}
    accessibility = audit_accessibility(soup)
    yield {"type": "stage", "id": "accessibility", "status": "done"}

    # ── security ──
    yield {"type": "stage", "id": "security", "status": "running"}
    security = audit_security(url, page["response"])
    yield {"type": "stage", "id": "security", "status": "done"}

    # ── compile ──
    yield {"type": "stage", "id": "compile", "status": "running"}
    result = _assemble_result(url, performance, seo, accessibility, security)
    yield {"type": "stage", "id": "compile", "status": "done"}

    print(f"[SATsec] Staged audit complete for {url} — Overall: {result['scores']['overall']} ({result['grade']})")
    yield {"type": "result", "result": result}


# --------------------------------------------
# PAGE FETCHER
# --------------------------------------------
def fetch_page(url: str) -> dict | None:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        start = time.time()
        response = requests.get(url, headers=headers, timeout=15)
        load_time = round(time.time() - start, 2)
        return {
            "html": response.text,
            "load_time": load_time,
            "response": response
        }
    except requests.exceptions.RequestException as e:
        print(f"[SATsec] Fetch error: {e}")
        return None


# --------------------------------------------
# PERFORMANCE AUDIT
# --------------------------------------------
def audit_performance(soup, html: str, load_time: float, response) -> dict:
    f = Findings()

    # Load time — tiered severity
    if load_time > 5:
        f.add(f"Very slow load time: {load_time}s (target: under 1.5s)", "serious")
    elif load_time > 3:
        f.add(f"Slow load time: {load_time}s (target: under 3s)", "serious")
    elif load_time > 2:
        f.add(f"Moderate load time: {load_time}s (target: under 2s)", "moderate")
    elif load_time > 1.5:
        f.add(f"Slightly slow load time: {load_time}s (target: under 1.5s)", "minor")

    # Page size — only penalize if serving uncompressed
    # Sites using gzip/brotli serve much smaller payloads over the wire
    html_size_kb = len(html.encode("utf-8")) / 1024
    encoding = response.headers.get("Content-Encoding", "")
    is_compressed = any(enc in encoding.lower() for enc in ["gzip", "br", "deflate"])
    if html_size_kb > 2000:
        f.add(f"Very large HTML size: {round(html_size_kb)}KB — even compressed this is excessive", "moderate")
    elif html_size_kb > 1000 and not is_compressed:
        f.add(f"Large uncompressed HTML: {round(html_size_kb)}KB — enable gzip/brotli compression", "moderate")
    elif html_size_kb > 500 and not is_compressed:
        f.add(f"HTML not compressed: {round(html_size_kb)}KB — enable gzip/brotli to improve load time", "minor")
    elif html_size_kb > 500 and is_compressed:
        f.note(f"Note: Raw HTML is {round(html_size_kb)}KB but served compressed — monitor if growing")

    # Render-blocking scripts in <head>
    # Check attrs dict directly — BeautifulSoup returns "" for valueless
    # attributes like <script async>, which is falsy and causes false positives
    head = soup.find("head")
    blocking_scripts = 0
    if head:
        for script in head.find_all("script", src=True):
            if "async" not in script.attrs and "defer" not in script.attrs:
                blocking_scripts += 1
    if blocking_scripts > 2:
        f.add(f"{blocking_scripts} render-blocking scripts in <head> (critical)", "serious", count=blocking_scripts)
    elif blocking_scripts > 0:
        f.add(f"{blocking_scripts} render-blocking script(s) found in <head>", "moderate", count=blocking_scripts)

    # Images without width/height
    unsized_images = sum(
        1 for img in soup.find_all("img")
        if not img.get("width") or not img.get("height")
    )
    if unsized_images > 5:
        f.add(f"{unsized_images} images missing width/height (causes layout shift)", "moderate", count=unsized_images)
    elif unsized_images > 2:
        f.add(f"{unsized_images} images missing width/height (causes layout shift)", "minor", count=unsized_images)

    # Inline styles
    inline_styles = len(soup.find_all(style=True))
    if inline_styles > 20:
        f.add(f"{inline_styles} elements using inline styles (hurts render performance)", "minor")

    # Mobile viewport tag
    viewport = soup.find("meta", {"name": "viewport"})
    if not viewport:
        f.add("Missing viewport meta tag — page is not mobile optimized", "serious")

    # Font preload hints — web fonts without preload can block rendering (LCP)
    # Count external font stylesheets (e.g. Google Fonts) and check for preload hints
    if head:
        font_preloads = head.find_all("link", attrs={"rel": "preload", "as": "font"})
    else:
        font_preloads = []
    font_stylesheets = [
        link for link in soup.find_all("link", rel="stylesheet")
        if "font" in (link.get("href") or "").lower()
    ]
    # Weight by the real measured load_time: missing preload only matters if the
    # page is actually slow. A fast page isn't penalised for a hint it doesn't need.
    if len(font_stylesheets) > 1 and not font_preloads:
        if load_time > 3:
            f.add("No font preload hints — web fonts likely blocking render on this slow page (LCP impact)", "serious")
        elif load_time > 1.5:
            f.add("No font preload hints found — web fonts may block rendering (LCP impact)", "moderate")
        else:
            f.note("No font preload hints, but page already loads fast — low priority")

    # Lazy loading — below-the-fold images (after the first 3) should defer loading
    # Heuristic (we can't measure the real fold) → minor tier
    all_imgs = soup.find_all("img")
    below_fold_no_lazy = [
        img for img in all_imgs[3:]
        if (img.get("loading") or "").lower() != "lazy"
    ]
    # Escalate only when the page is genuinely slow (missing lazy-load is a
    # plausible cause); on a fast page it's informational, not a penalty.
    if below_fold_no_lazy:
        n = len(below_fold_no_lazy)
        if load_time > 3:
            f.add(f"{n} below-the-fold image(s) missing loading='lazy' — likely slowing this page", "moderate", count=n)
        elif load_time > 1.5:
            f.add(f"{n} below-the-fold image(s) missing loading='lazy'", "minor", count=n)
        else:
            f.note(f"{n} below-the-fold image(s) missing loading='lazy' (page already fast — minor)")

    return f.result()


# --------------------------------------------
# SEO AUDIT
# --------------------------------------------
def audit_seo(soup, url: str) -> dict:
    f = Findings()

    # Title tag
    title = soup.find("title")
    if not title or not title.text.strip():
        f.add("Missing <title> tag", "serious")
    elif len(title.text.strip()) > 60:
        f.add(f"Title tag too long: {len(title.text.strip())} chars (target: under 60)", "minor")
    elif len(title.text.strip()) < 10:
        f.add(f"Title tag too short: {len(title.text.strip())} chars (target: 10-60)", "minor")

    # Meta description
    meta_desc = soup.find("meta", {"name": "description"})
    if not meta_desc or not meta_desc.get("content", "").strip():
        f.add("Missing meta description", "serious")
    elif len(meta_desc.get("content", "")) > 160:
        f.add("Meta description too long (target: under 160 chars)", "minor")
    elif len(meta_desc.get("content", "")) < 50:
        f.add("Meta description too short (target: 50-160 chars)", "minor")

    # H1 tag
    h1_tags = soup.find_all("h1")
    if len(h1_tags) == 0:
        f.add("No <h1> tag found on page", "serious")
    elif len(h1_tags) > 1:
        f.add(f"Multiple <h1> tags found ({len(h1_tags)}) — should only have one", "moderate")

    # Images missing alt text — same smart filter as accessibility checker
    def is_real_img(img):
        src = img.get("src", "")
        if not src or src.startswith("data:"):
            return False
        if any(img.get(a) for a in ["data-src", "data-lazy", "data-lazy-src", "data-original", "data-srcset"]):
            return False
        if img.get("width") == "1" and img.get("height") == "1":
            return False
        if img.get("role") == "presentation" or img.get("aria-hidden") == "true":
            return False
        if "/_next/image" in src and "blur" in src.lower():
            return False
        return True
    # alt="" is valid for decorative images — only flag truly missing alt attributes
    images_no_alt = [img for img in soup.find_all("img") if img.get("alt") is None and is_real_img(img)]
    if images_no_alt:
        f.add(f"{len(images_no_alt)} image(s) missing alt text", "moderate", count=len(images_no_alt))

    # Canonical tag
    canonical = soup.find("link", {"rel": "canonical"})
    if not canonical:
        f.add("No canonical tag found", "minor")

    # Open Graph tags
    og_title = soup.find("meta", {"property": "og:title"})
    if not og_title:
        f.add("Missing Open Graph tags (og:title) — affects social sharing", "minor")

    # Additional social sharing tags — flag each missing one separately
    # twitter:card uses the name= attribute; og:* use property=
    social_checks = [
        ("og:description", "property"),
        ("og:image", "property"),
        ("twitter:card", "name"),
    ]
    for tag_name, attr in social_checks:
        if not soup.find("meta", {attr: tag_name}):
            f.add(f"Missing {tag_name} tag — affects social sharing", "minor")

    # Robots noindex check — deindexing is catastrophic for SEO
    robots = soup.find("meta", {"name": "robots"})
    if robots and "noindex" in robots.get("content", "").lower():
        f.add("Page has noindex meta tag — search engines will not index this page", "critical")

    # Heading hierarchy
    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    if headings and headings[0].name != "h1":
        f.add("Heading hierarchy starts with non-H1 tag — poor SEO structure", "minor")

    # Structured data (JSON-LD)
    json_ld = soup.find("script", {"type": "application/ld+json"})
    if not json_ld:
        f.add("No structured data (JSON-LD) found — missing rich result eligibility", "minor")

    # Sitemap check
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    try:
        sitemap_res = requests.get(f"{base_url}/sitemap.xml", timeout=5)
        if sitemap_res.status_code != 200:
            f.add("No sitemap.xml found — search engines may miss pages", "minor")
    except Exception:
        f.note("Could not check for sitemap.xml")

    # Robots.txt check
    try:
        robots_res = requests.get(f"{base_url}/robots.txt", timeout=5)
        if robots_res.status_code != 200:
            f.add("No robots.txt found", "minor")
    except Exception:
        pass

    # Broken links check (internal links only, capped at 15)
    # Skips parameterized routes, anchors, and special links
    broken_links = []
    checked = 0
    skip_patterns = ["/search/", "/filter/", "/category/", "/tag/", "/page/", "?", "#", "javascript:", "mailto:", "tel:"]
    req_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    for a in soup.find_all("a", href=True):
        if checked >= 15:
            break
        href = a["href"]
        # Skip parameterized, anchor, and non-http links
        if any(p in href for p in skip_patterns):
            continue
        # Only check internal links
        if href.startswith("//"):
            # Protocol-relative URL e.g. //geo.craigslist.org
            full_url = "https:" + href
        elif href.startswith("/"):
            full_url = base_url + href
        elif href.startswith(base_url):
            full_url = href
        else:
            continue
        if True:
            try:
                r = requests.head(full_url, headers=req_headers, timeout=5, allow_redirects=True)
                if r.status_code == 404:
                    broken_links.append(full_url)
                checked += 1
            except Exception:
                pass

    if broken_links:
        f.add(
            f"{len(broken_links)} broken link(s) found (404): {', '.join(broken_links[:3])}",
            "serious", count=len(broken_links)
        )

    return f.result()


# --------------------------------------------
# ACCESSIBILITY AUDIT (WCAG AA)
# --------------------------------------------
def audit_accessibility(soup) -> dict:
    f = Findings()

    # Images missing alt text
    # Filters out: lazy-loaded placeholders, data URIs, 1x1 tracking pixels,
    # and images using common lazy-load data attributes
    all_images = soup.find_all("img")
    def is_real_image(img):
        src = img.get("src", "")
        if not src or src.startswith("data:"):
            return False
        # Skip lazy-loaded images — src will be populated by JS later
        if any(img.get(attr) for attr in [
            "data-src", "data-lazy", "data-lazy-src",
            "data-original", "data-srcset", "data-delayed-src"
        ]):
            return False
        # Skip 1x1 tracking pixels
        if img.get("width") == "1" and img.get("height") == "1":
            return False
        # Skip decorative images explicitly marked as such
        if img.get("role") == "presentation" or img.get("aria-hidden") == "true":
            return False
        # Skip Next.js/framework blurred placeholder images
        if "/_next/image" in src and "blur" in src.lower():
            return False
        return True

    # alt="" is valid HTML for decorative images — only flag truly missing alt attributes
    images_no_alt = [
        img for img in all_images
        if img.get("alt") is None and is_real_image(img)
    ]
    real_images = [img for img in all_images if is_real_image(img)]
    if images_no_alt:
        f.add(
            f"ADA: {len(images_no_alt)} of {len(real_images)} image(s) missing alt text (WCAG 1.1.1)",
            "moderate", count=len(images_no_alt)
        )

    # Form inputs missing labels
    unlabeled = 0
    for inp in soup.find_all("input"):
        if inp.get("type") in ["hidden", "submit", "button", "reset"]:
            continue
        input_id = inp.get("id")
        has_label = bool(soup.find("label", {"for": input_id})) if input_id else False
        has_aria = bool(inp.get("aria-label") or inp.get("aria-labelledby"))
        if not has_label and not has_aria:
            unlabeled += 1
    if unlabeled > 0:
        f.add(f"ADA: {unlabeled} form input(s) missing accessible labels (WCAG 1.3.1)", "serious", count=unlabeled)

    # Buttons with no accessible name
    empty_buttons = [
        btn for btn in soup.find_all("button")
        if not btn.text.strip()
        and not btn.get("aria-label")
        and not btn.get("aria-labelledby")
        and not btn.get("title")
    ]
    if empty_buttons:
        f.add(f"ADA: {len(empty_buttons)} button(s) with no accessible name (WCAG 4.1.2)", "serious", count=len(empty_buttons))

    # Links with non-descriptive text
    vague_links = [
        a for a in soup.find_all("a")
        if a.text.strip().lower() in [
            "click here", "here", "read more", "more",
            "link", "learn more", "details"
        ]
    ]
    if vague_links:
        f.add(f"ADA: {len(vague_links)} link(s) with non-descriptive text (WCAG 2.4.4)", "minor", count=len(vague_links))

    # Missing lang attribute on <html>
    html_tag = soup.find("html")
    if html_tag and not html_tag.get("lang"):
        f.add("ADA: <html> tag missing lang attribute (WCAG 3.1.1)", "serious")

    # Missing skip navigation link
    skip_link = (
        soup.find("a", href="#main") or
        soup.find("a", href="#content") or
        soup.find("a", href="#main-content") or
        soup.find("a", string=lambda t: t and "skip" in t.lower())
    )
    if not skip_link:
        f.add("ADA: No skip navigation link found (WCAG 2.4.1)", "minor")

    # Links opening in new tab without warning
    new_tab_links = [
        a for a in soup.find_all("a", target="_blank")
        if not a.get("aria-label") and "new" not in (a.text or "").lower()
    ]
    if len(new_tab_links) > 3:
        f.add(f"ADA: {len(new_tab_links)} link(s) open in new tab without user warning (WCAG 3.2.2)", "minor")

    # Tables missing headers
    tables_no_headers = [t for t in soup.find_all("table") if not t.find("th")]
    if tables_no_headers:
        f.add(f"ADA: {len(tables_no_headers)} table(s) missing header cells <th> (WCAG 1.3.1)", "moderate", count=len(tables_no_headers))

    # ── NEW: ARIA landmark regions ──────────────────────────────────────
    landmarks = {
        "main":   soup.find("main")   or soup.find(attrs={"role": "main"}),
        "nav":    soup.find("nav")    or soup.find(attrs={"role": "navigation"}),
        "header": soup.find("header") or soup.find(attrs={"role": "banner"}),
        "footer": soup.find("footer") or soup.find(attrs={"role": "contentinfo"}),
    }
    missing_landmarks = [k for k, v in landmarks.items() if not v]
    if missing_landmarks:
        f.add(
            f"ADA: Missing ARIA landmark region(s): {', '.join(f'<{l}>' for l in missing_landmarks)} "
            f"— screen readers cannot navigate page structure (WCAG 1.3.6)",
            "moderate", count=len(missing_landmarks)
        )

    # ── NEW: Video captions check ───────────────────────────────────────
    videos_no_captions = [
        v for v in soup.find_all("video")
        if not v.find("track", {"kind": "captions"}) and
           not v.find("track", {"kind": "subtitles"})
    ]
    if videos_no_captions:
        f.add(
            f"ADA: {len(videos_no_captions)} video(s) missing captions/subtitles (WCAG 1.2.2) "
            f"— major ADA liability",
            "serious", count=len(videos_no_captions)
        )

    # ── NEW: iframes missing title ──────────────────────────────────────
    iframes_no_title = [
        f for f in soup.find_all("iframe")
        if not f.get("title") and not f.get("aria-label")
    ]
    if iframes_no_title:
        f.add(
            f"ADA: {len(iframes_no_title)} iframe(s) missing title attribute (WCAG 4.1.2)",
            "moderate", count=len(iframes_no_title)
        )

    # ── NEW: Color contrast (WCAG 1.4.3) ────────────────────────────────
    # Only elements that set BOTH color and background-color inline can be
    # evaluated deterministically — we need two colors to compute a ratio.
    low_contrast = 0
    for el in soup.find_all(style=True):
        decls = _parse_inline_style(el["style"])
        if "color" not in decls or "background-color" not in decls:
            continue
        fg = _parse_color(decls.get("color"))
        bg = _parse_color(decls.get("background-color"))
        if not fg or not bg:
            continue
        ratio = _contrast_ratio(fg, bg)
        # Large text = font-size >= 18px, or >= 14px when bold
        font_size = None
        m = re.match(r"([\d.]+)px", decls.get("font-size", ""))
        if m:
            font_size = float(m.group(1))
        weight = decls.get("font-weight", "")
        is_bold = weight in ("bold", "bolder") or (weight.isdigit() and int(weight) >= 700)
        is_large = font_size is not None and (
            font_size >= 18 or (font_size >= 14 and is_bold)
        )
        threshold = 3.0 if is_large else 4.5
        if ratio < threshold:
            low_contrast += 1
    if low_contrast:
        f.add(f"ADA: Low color contrast on {low_contrast} element(s) (WCAG 1.4.3)", "serious", count=low_contrast)

    # ── NEW: Touch target size (WCAG 2.5.8) ─────────────────────────────
    # Flag <a>/<button> with an explicit inline width or height under 24px
    small_targets = 0
    for el in soup.find_all(["a", "button"], style=True):
        decls = _parse_inline_style(el["style"])
        too_small = False
        for prop in ("width", "height"):
            m = re.match(r"([\d.]+)px", decls.get(prop, ""))
            if m and float(m.group(1)) < 24:
                too_small = True
        if too_small:
            small_targets += 1
    if small_targets:
        f.add(
            f"ADA: {small_targets} interactive element(s) below 24x24px touch target size (WCAG 2.5.8)",
            "moderate", count=small_targets
        )

    return f.result()


# --------------------------------------------
# SECURITY AUDIT
# --------------------------------------------
def audit_security(url: str, response) -> dict:
    f = Findings()
    headers = response.headers

    # HTTPS check — no transport encryption is a critical, gating failure
    if not url.startswith("https://"):
        f.add("Site is not using HTTPS — data is transmitted insecurely", "critical")

    # Security headers
    if not headers.get("X-Frame-Options"):
        f.add("Missing X-Frame-Options header (clickjacking risk)", "moderate")

    if not headers.get("X-Content-Type-Options"):
        f.add("Missing X-Content-Type-Options header (MIME sniffing risk)", "moderate")

    if not headers.get("Strict-Transport-Security"):
        f.add("Missing Strict-Transport-Security (HSTS) header", "moderate")

    if not headers.get("Content-Security-Policy"):
        f.add("Missing Content-Security-Policy header (XSS risk)", "serious")

    if not headers.get("Referrer-Policy"):
        f.add("Missing Referrer-Policy header", "minor")

    if not headers.get("Permissions-Policy"):
        f.add("Missing Permissions-Policy header (controls browser feature access)", "minor")

    # Server header exposes tech stack
    server = headers.get("Server", "")
    if server and any(v in server.lower() for v in ["apache", "nginx", "iis", "php"]):
        f.add(f"Server header exposes technology stack: '{server}'", "minor")

    # X-Powered-By exposes backend
    powered_by = headers.get("X-Powered-By", "")
    if powered_by:
        f.add(f"X-Powered-By header exposes backend technology: '{powered_by}'", "minor")

    # Mixed content
    if url.startswith("https://") and response.text:
        soup = BeautifulSoup(response.text, "html.parser")
        mixed = [
            tag.get("src") or tag.get("href")
            for tag in soup.find_all(["script", "link", "img", "iframe"])
            if (tag.get("src") or tag.get("href") or "").startswith("http://")
        ]
        if mixed:
            f.add(f"Mixed content: {len(mixed)} resource(s) loaded over HTTP on HTTPS page", "serious", count=len(mixed))

    # ── NEW: SSL certificate expiry check ──────────────────────────────
    if url.startswith("https://"):
        try:
            hostname = urlparse(url).netloc.split(":")[0]
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
                s.settimeout(5)
                s.connect((hostname, 443))
                cert = s.getpeercert()
                expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                days_left = (expiry - datetime.utcnow()).days
                if days_left < 0:
                    f.add("SSL certificate has EXPIRED — site will show security warnings", "critical")
                elif days_left < 14:
                    f.add(f"SSL certificate expires in {days_left} days — CRITICAL, renew immediately", "serious")
                elif days_left < 30:
                    f.add(f"SSL certificate expires in {days_left} days — renew urgently", "moderate")
                elif days_left < 60:
                    f.add(f"SSL certificate expires in {days_left} days — schedule renewal soon", "minor")
        except ssl.SSLError as e:
            f.add(f"SSL certificate error: {str(e)}", "serious")
        except Exception as e:
            print(f"[SATsec] SSL check failed: {e}")

    # ── NEW: Cookie security flags ──────────────────────────────────────
    set_cookie = headers.get("Set-Cookie", "")
    if set_cookie:
        if "httponly" not in set_cookie.lower():
            f.add("Cookie missing HttpOnly flag — vulnerable to XSS cookie theft", "moderate")
        if "secure" not in set_cookie.lower():
            f.add("Cookie missing Secure flag — can be transmitted over HTTP", "moderate")
        if "samesite" not in set_cookie.lower():
            f.add("Cookie missing SameSite flag — vulnerable to CSRF attacks", "moderate")

    return f.result()


# --------------------------------------------
# ERROR RESULT HELPER
# --------------------------------------------
def error_result(url: str, message: str) -> dict:
    return {
        "url": url,
        "scores": {
            "performance": 0,
            "seo": 0,
            "accessibility": 0,
            "security": 0,
            "overall": 0
        },
        "issues": [message],
        "ai_summary": None,
        "error": message
    }