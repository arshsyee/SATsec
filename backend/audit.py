import requests
from bs4 import BeautifulSoup
import time
import ssl
import socket
from datetime import datetime
from urllib.parse import urlparse


# -----------------------------------------
# MAIN AUDIT FUNCTION
# -----------------------------------------
def run_audit(url: str) -> dict:
    print(f"[Vigil] Starting audit for {url}")

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

    overall = round(
        (performance["score"] * 0.25) +
        (seo["score"] * 0.25) +
        (accessibility["score"] * 0.30) +
        (security["score"] * 0.20),
        1
    )

    result = {
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
        "ai_summary": None,
        "error": None
    }

    print(f"[Vigil] Audit complete for {url} — Overall: {overall}")
    return result


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
    print(f"[Vigil] Starting staged audit for {url}")
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
    overall = round(
        (performance["score"] * 0.25) +
        (seo["score"] * 0.25) +
        (accessibility["score"] * 0.30) +
        (security["score"] * 0.20),
        1
    )
    result = {
        "url": url,
        "scores": {
            "performance": performance["score"],
            "seo": seo["score"],
            "accessibility": accessibility["score"],
            "security": security["score"],
            "overall": overall
        },
        "issues": {
            "performance": performance["issues"],
            "seo": seo["issues"],
            "accessibility": accessibility["issues"],
            "security": security["issues"]
        },
        "issues_flat": (
            performance["issues"] +
            seo["issues"] +
            accessibility["issues"] +
            security["issues"]
        ),
        "ai_summary": None,
        "error": None
    }
    yield {"type": "stage", "id": "compile", "status": "done"}

    print(f"[Vigil] Staged audit complete for {url} — Overall: {overall}")
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
        print(f"[Vigil] Fetch error: {e}")
        return None


# --------------------------------------------
# PERFORMANCE AUDIT
# --------------------------------------------
def audit_performance(soup, html: str, load_time: float, response) -> dict:
    issues = []
    score = 100

    # Load time — tiered penalties
    if load_time > 5:
        issues.append(f"Very slow load time: {load_time}s (target: under 1.5s)")
        score -= 40
    elif load_time > 3:
        issues.append(f"Slow load time: {load_time}s (target: under 3s)")
        score -= 30
    elif load_time > 2:
        issues.append(f"Moderate load time: {load_time}s (target: under 2s)")
        score -= 20
    elif load_time > 1.5:
        issues.append(f"Slightly slow load time: {load_time}s (target: under 1.5s)")
        score -= 10

    # Page size — only penalize if serving uncompressed
    # Sites using gzip/brotli serve much smaller payloads over the wire
    html_size_kb = len(html.encode("utf-8")) / 1024
    encoding = response.headers.get("Content-Encoding", "")
    is_compressed = any(enc in encoding.lower() for enc in ["gzip", "br", "deflate"])
    if html_size_kb > 2000:
        issues.append(f"Very large HTML size: {round(html_size_kb)}KB — even compressed this is excessive")
        score -= 20
    elif html_size_kb > 1000 and not is_compressed:
        issues.append(f"Large uncompressed HTML: {round(html_size_kb)}KB — enable gzip/brotli compression")
        score -= 15
    elif html_size_kb > 500 and not is_compressed:
        issues.append(f"HTML not compressed: {round(html_size_kb)}KB — enable gzip/brotli to improve load time")
        score -= 8
    elif html_size_kb > 500 and is_compressed:
        issues.append(f"Note: Raw HTML is {round(html_size_kb)}KB but served compressed — monitor if growing")

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
        issues.append(f"{blocking_scripts} render-blocking scripts in <head> (critical)")
        score -= min(blocking_scripts * 5, 40)  # capped at -40
    elif blocking_scripts > 0:
        issues.append(f"{blocking_scripts} render-blocking script(s) found in <head>")
        score -= blocking_scripts * 5

    # Images without width/height
    unsized_images = sum(
        1 for img in soup.find_all("img")
        if not img.get("width") or not img.get("height")
    )
    if unsized_images > 5:
        issues.append(f"{unsized_images} images missing width/height (causes layout shift)")
        score -= 15
    elif unsized_images > 2:
        issues.append(f"{unsized_images} images missing width/height (causes layout shift)")
        score -= 8

    # Inline styles
    inline_styles = len(soup.find_all(style=True))
    if inline_styles > 20:
        issues.append(f"{inline_styles} elements using inline styles (hurts render performance)")
        score -= 5

    # Mobile viewport tag
    viewport = soup.find("meta", {"name": "viewport"})
    if not viewport:
        issues.append("Missing viewport meta tag — page is not mobile optimized")
        score -= 10

    return {"score": max(score, 0), "issues": issues}


# --------------------------------------------
# SEO AUDIT
# --------------------------------------------
def audit_seo(soup, url: str) -> dict:
    issues = []
    score = 100

    # Title tag
    title = soup.find("title")
    if not title or not title.text.strip():
        issues.append("Missing <title> tag")
        score -= 20
    elif len(title.text.strip()) > 60:
        issues.append(f"Title tag too long: {len(title.text.strip())} chars (target: under 60)")
        score -= 5
    elif len(title.text.strip()) < 10:
        issues.append(f"Title tag too short: {len(title.text.strip())} chars (target: 10-60)")
        score -= 5

    # Meta description
    meta_desc = soup.find("meta", {"name": "description"})
    if not meta_desc or not meta_desc.get("content", "").strip():
        issues.append("Missing meta description")
        score -= 15
    elif len(meta_desc.get("content", "")) > 160:
        issues.append("Meta description too long (target: under 160 chars)")
        score -= 5
    elif len(meta_desc.get("content", "")) < 50:
        issues.append("Meta description too short (target: 50-160 chars)")
        score -= 5

    # H1 tag
    h1_tags = soup.find_all("h1")
    if len(h1_tags) == 0:
        issues.append("No <h1> tag found on page")
        score -= 15
    elif len(h1_tags) > 1:
        issues.append(f"Multiple <h1> tags found ({len(h1_tags)}) — should only have one")
        score -= 10

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
        issues.append(f"{len(images_no_alt)} image(s) missing alt text")
        score -= min(len(images_no_alt) * 3, 15)

    # Canonical tag
    canonical = soup.find("link", {"rel": "canonical"})
    if not canonical:
        issues.append("No canonical tag found")
        score -= 5

    # Open Graph tags
    og_title = soup.find("meta", {"property": "og:title"})
    if not og_title:
        issues.append("Missing Open Graph tags (og:title) — affects social sharing")
        score -= 5

    # Robots noindex check
    robots = soup.find("meta", {"name": "robots"})
    if robots and "noindex" in robots.get("content", "").lower():
        issues.append("Page has noindex meta tag — search engines will not index this page")
        score -= 20

    # Heading hierarchy
    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    if headings and headings[0].name != "h1":
        issues.append("Heading hierarchy starts with non-H1 tag — poor SEO structure")
        score -= 5

    # Structured data (JSON-LD)
    json_ld = soup.find("script", {"type": "application/ld+json"})
    if not json_ld:
        issues.append("No structured data (JSON-LD) found — missing rich result eligibility")
        score -= 5

    # Sitemap check
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    try:
        sitemap_res = requests.get(f"{base_url}/sitemap.xml", timeout=5)
        if sitemap_res.status_code != 200:
            issues.append("No sitemap.xml found — search engines may miss pages")
            score -= 5
    except Exception:
        issues.append("Could not check for sitemap.xml")
        score -= 3

    # Robots.txt check
    try:
        robots_res = requests.get(f"{base_url}/robots.txt", timeout=5)
        if robots_res.status_code != 200:
            issues.append("No robots.txt found")
            score -= 3
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
        issues.append(f"{len(broken_links)} broken link(s) found (404): {', '.join(broken_links[:3])}")
        score -= min(len(broken_links) * 5, 20)

    return {"score": max(score, 0), "issues": issues}


# --------------------------------------------
# ACCESSIBILITY AUDIT (WCAG AA)
# --------------------------------------------
def audit_accessibility(soup) -> dict:
    issues = []
    score = 100

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
        issues.append(
            f"ADA: {len(images_no_alt)} of {len(real_images)} image(s) missing alt text (WCAG 1.1.1)"
        )
        score -= min(len(images_no_alt) * 5, 25)

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
        issues.append(f"ADA: {unlabeled} form input(s) missing accessible labels (WCAG 1.3.1)")
        score -= min(unlabeled * 8, 20)

    # Buttons with no accessible name
    empty_buttons = [
        btn for btn in soup.find_all("button")
        if not btn.text.strip()
        and not btn.get("aria-label")
        and not btn.get("aria-labelledby")
        and not btn.get("title")
    ]
    if empty_buttons:
        issues.append(f"ADA: {len(empty_buttons)} button(s) with no accessible name (WCAG 4.1.2)")
        score -= min(len(empty_buttons) * 5, 15)

    # Links with non-descriptive text
    vague_links = [
        a for a in soup.find_all("a")
        if a.text.strip().lower() in [
            "click here", "here", "read more", "more",
            "link", "learn more", "details"
        ]
    ]
    if vague_links:
        issues.append(f"ADA: {len(vague_links)} link(s) with non-descriptive text (WCAG 2.4.4)")
        score -= min(len(vague_links) * 3, 10)

    # Missing lang attribute on <html>
    html_tag = soup.find("html")
    if html_tag and not html_tag.get("lang"):
        issues.append("ADA: <html> tag missing lang attribute (WCAG 3.1.1)")
        score -= 10

    # Missing skip navigation link
    skip_link = (
        soup.find("a", href="#main") or
        soup.find("a", href="#content") or
        soup.find("a", href="#main-content") or
        soup.find("a", string=lambda t: t and "skip" in t.lower())
    )
    if not skip_link:
        issues.append("ADA: No skip navigation link found (WCAG 2.4.1)")
        score -= 5

    # Links opening in new tab without warning
    new_tab_links = [
        a for a in soup.find_all("a", target="_blank")
        if not a.get("aria-label") and "new" not in (a.text or "").lower()
    ]
    if len(new_tab_links) > 3:
        issues.append(f"ADA: {len(new_tab_links)} link(s) open in new tab without user warning (WCAG 3.2.2)")
        score -= 5

    # Tables missing headers
    tables_no_headers = [t for t in soup.find_all("table") if not t.find("th")]
    if tables_no_headers:
        issues.append(f"ADA: {len(tables_no_headers)} table(s) missing header cells <th> (WCAG 1.3.1)")
        score -= min(len(tables_no_headers) * 5, 10)

    # ── NEW: ARIA landmark regions ──────────────────────────────────────
    landmarks = {
        "main":   soup.find("main")   or soup.find(attrs={"role": "main"}),
        "nav":    soup.find("nav")    or soup.find(attrs={"role": "navigation"}),
        "header": soup.find("header") or soup.find(attrs={"role": "banner"}),
        "footer": soup.find("footer") or soup.find(attrs={"role": "contentinfo"}),
    }
    missing_landmarks = [k for k, v in landmarks.items() if not v]
    if missing_landmarks:
        issues.append(
            f"ADA: Missing ARIA landmark region(s): {', '.join(f'<{l}>' for l in missing_landmarks)} "
            f"— screen readers cannot navigate page structure (WCAG 1.3.6)"
        )
        score -= len(missing_landmarks) * 5

    # ── NEW: Video captions check ───────────────────────────────────────
    videos_no_captions = [
        v for v in soup.find_all("video")
        if not v.find("track", {"kind": "captions"}) and
           not v.find("track", {"kind": "subtitles"})
    ]
    if videos_no_captions:
        issues.append(
            f"ADA: {len(videos_no_captions)} video(s) missing captions/subtitles (WCAG 1.2.2) "
            f"— major ADA liability"
        )
        score -= min(len(videos_no_captions) * 10, 20)

    # ── NEW: iframes missing title ──────────────────────────────────────
    iframes_no_title = [
        f for f in soup.find_all("iframe")
        if not f.get("title") and not f.get("aria-label")
    ]
    if iframes_no_title:
        issues.append(
            f"ADA: {len(iframes_no_title)} iframe(s) missing title attribute (WCAG 4.1.2)"
        )
        score -= min(len(iframes_no_title) * 5, 10)

    return {"score": max(score, 0), "issues": issues}


# --------------------------------------------
# SECURITY AUDIT
# --------------------------------------------
def audit_security(url: str, response) -> dict:
    issues = []
    score = 100
    headers = response.headers

    # HTTPS check
    if not url.startswith("https://"):
        issues.append("Site is not using HTTPS — data is transmitted insecurely")
        score -= 40

    # Security headers
    if not headers.get("X-Frame-Options"):
        issues.append("Missing X-Frame-Options header (clickjacking risk)")
        score -= 10

    if not headers.get("X-Content-Type-Options"):
        issues.append("Missing X-Content-Type-Options header (MIME sniffing risk)")
        score -= 10

    if not headers.get("Strict-Transport-Security"):
        issues.append("Missing Strict-Transport-Security (HSTS) header")
        score -= 10

    if not headers.get("Content-Security-Policy"):
        issues.append("Missing Content-Security-Policy header (XSS risk)")
        score -= 15

    if not headers.get("Referrer-Policy"):
        issues.append("Missing Referrer-Policy header")
        score -= 5

    if not headers.get("Permissions-Policy"):
        issues.append("Missing Permissions-Policy header (controls browser feature access)")
        score -= 5

    # Server header exposes tech stack
    server = headers.get("Server", "")
    if server and any(v in server.lower() for v in ["apache", "nginx", "iis", "php"]):
        issues.append(f"Server header exposes technology stack: '{server}'")
        score -= 5

    # X-Powered-By exposes backend
    powered_by = headers.get("X-Powered-By", "")
    if powered_by:
        issues.append(f"X-Powered-By header exposes backend technology: '{powered_by}'")
        score -= 5

    # Mixed content
    if url.startswith("https://") and response.text:
        soup = BeautifulSoup(response.text, "html.parser")
        mixed = [
            tag.get("src") or tag.get("href")
            for tag in soup.find_all(["script", "link", "img", "iframe"])
            if (tag.get("src") or tag.get("href") or "").startswith("http://")
        ]
        if mixed:
            issues.append(f"Mixed content: {len(mixed)} resource(s) loaded over HTTP on HTTPS page")
            score -= min(len(mixed) * 5, 15)

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
                    issues.append("SSL certificate has EXPIRED — site will show security warnings")
                    score -= 40
                elif days_left < 14:
                    issues.append(f"SSL certificate expires in {days_left} days — CRITICAL, renew immediately")
                    score -= 30
                elif days_left < 30:
                    issues.append(f"SSL certificate expires in {days_left} days — renew urgently")
                    score -= 20
                elif days_left < 60:
                    issues.append(f"SSL certificate expires in {days_left} days — schedule renewal soon")
                    score -= 10
        except ssl.SSLError as e:
            issues.append(f"SSL certificate error: {str(e)}")
            score -= 20
        except Exception as e:
            print(f"[Vigil] SSL check failed: {e}")

    # ── NEW: Cookie security flags ──────────────────────────────────────
    set_cookie = headers.get("Set-Cookie", "")
    if set_cookie:
        if "httponly" not in set_cookie.lower():
            issues.append("Cookie missing HttpOnly flag — vulnerable to XSS cookie theft")
            score -= 5
        if "secure" not in set_cookie.lower():
            issues.append("Cookie missing Secure flag — can be transmitted over HTTP")
            score -= 5
        if "samesite" not in set_cookie.lower():
            issues.append("Cookie missing SameSite flag — vulnerable to CSRF attacks")
            score -= 5

    return {"score": max(score, 0), "issues": issues}


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