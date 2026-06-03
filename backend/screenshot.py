"""
Headless-browser screenshots of audited sites.

Used by the in-app "Quick preview" — unlike an iframe, a server-rendered
screenshot works on every site regardless of X-Frame-Options / CSP.

Includes an SSRF guard: only public http(s) hosts may be captured, so the
endpoint can't be abused to reach internal/cloud-metadata addresses.
"""
import ipaddress
import socket
from urllib.parse import urlparse

from playwright.async_api import async_playwright

VIEWPORT = {"width": 1366, "height": 900}
NAV_TIMEOUT_MS = 15000


def is_safe_url(url: str) -> bool:
    """Allow only public http(s) URLs — blocks private/loopback/metadata hosts."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.hostname
    if not host:
        return False
    try:
        # Resolve every address the host maps to; reject if any is non-public.
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False
    return True


async def capture(url: str) -> bytes:
    """Render the page in headless Chromium and return a PNG of the viewport."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        try:
            page = await browser.new_page(
                viewport=VIEWPORT,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            await page.goto(url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
            return await page.screenshot(type="png")
        finally:
            await browser.close()
