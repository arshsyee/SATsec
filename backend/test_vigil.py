"""
Unit tests for Vigil backend.
- No real HTTP requests (mocked)
- No Anthropic API calls
- Tests pure logic in audit.py, alerts.py, and FastAPI routes
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from fastapi.testclient import TestClient


# ─────────────────────────────────────────
# alerts.py tests
# ─────────────────────────────────────────

from alerts import should_alert


class TestShouldAlert:
    def test_all_scores_above_threshold(self):
        scores = {"performance": 80, "seo": 90, "accessibility": 85, "security": 75, "overall": 83}
        assert should_alert(scores, 70.0) is False

    def test_one_score_below_threshold(self):
        scores = {"performance": 60, "seo": 90, "accessibility": 85, "security": 75, "overall": 77}
        assert should_alert(scores, 70.0) is True

    def test_overall_score_ignored(self):
        scores = {"performance": 80, "seo": 80, "accessibility": 80, "security": 80, "overall": 50}
        assert should_alert(scores, 70.0) is False

    def test_all_scores_at_threshold(self):
        scores = {"performance": 70, "seo": 70, "accessibility": 70, "security": 70, "overall": 70}
        assert should_alert(scores, 70.0) is False

    def test_score_just_below_threshold(self):
        scores = {"performance": 69.9, "seo": 80, "accessibility": 80, "security": 80, "overall": 77}
        assert should_alert(scores, 70.0) is True


# ─────────────────────────────────────────
# audit.py — pure logic tests
# ─────────────────────────────────────────

from audit import audit_seo, audit_accessibility, audit_security, audit_performance, error_result


def make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def make_mock_response(headers: dict = None, text: str = "") -> MagicMock:
    """Helper to build a mock HTTP response for audit_performance/audit_security."""
    h = headers or {}
    r = MagicMock()
    r.headers = MagicMock()
    r.headers.get = lambda k, default="": h.get(k, default)
    r.text = text
    return r


# ── Mock for sitemap/robots requests inside audit_seo ──
def mock_requests_get(url, **kwargs):
    """Return 200 for sitemap and robots so they don't penalise the score."""
    r = MagicMock()
    r.status_code = 200
    return r


class TestAuditSeo:
    def test_perfect_page(self):
        html = """
        <html><head>
          <title>Short Title</title>
          <meta name="description" content="A good meta description that is between fifty and one sixty chars long ok.">
          <link rel="canonical" href="https://example.com">
          <meta property="og:title" content="Test">
          <meta property="og:description" content="Test description for social sharing">
          <meta property="og:image" content="https://example.com/og.png">
          <meta name="twitter:card" content="summary">
          <script type="application/ld+json">{"@type":"WebPage"}</script>
        </head><body>
          <h1>Main Heading</h1>
          <img src="img.png" alt="An image">
        </body></html>
        """
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert result["score"] == 100
        assert result["issues"] == []

    def test_missing_title(self):
        html = "<html><head></head><body><h1>Heading</h1></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert result["score"] < 100
        assert any("title" in i.lower() for i in result["issues"])

    def test_missing_meta_description(self):
        html = "<html><head><title>Title</title></head><body><h1>Heading</h1></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert any("meta description" in i.lower() for i in result["issues"])

    def test_no_h1(self):
        html = "<html><head><title>Title</title></head><body><h2>Sub</h2></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert any("h1" in i.lower() for i in result["issues"])

    def test_multiple_h1(self):
        html = "<html><head><title>Title</title></head><body><h1>One</h1><h1>Two</h1></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert any("multiple" in i.lower() for i in result["issues"])

    def test_images_missing_alt(self):
        html = "<html><head><title>Title</title></head><body><h1>H</h1><img src='a.png'><img src='b.png'></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert any("alt text" in i.lower() for i in result["issues"])

    def test_missing_sitemap_penalizes(self):
        html = "<html><head><title>Title</title></head><body><h1>H</h1></body></html>"
        def no_sitemap(url, **kwargs):
            r = MagicMock()
            r.status_code = 404
            return r
        with patch("audit.requests.get", side_effect=no_sitemap), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert any("sitemap" in i.lower() for i in result["issues"])

    def test_score_never_below_zero(self):
        html = "<html><head></head><body></body></html>"
        with patch("audit.requests.get", side_effect=mock_requests_get), \
             patch("audit.requests.head"):
            result = audit_seo(make_soup(html), "https://example.com")
        assert result["score"] >= 0


class TestAuditAccessibility:
    def test_perfect_page(self):
        html = """
        <html lang="en"><head></head><body>
          <header><a href="#main">Skip to content</a></header>
          <nav><a href="/home">Home</a></nav>
          <main id="main">
            <img src="a.png" alt="desc">
            <form>
              <label for="name">Name</label>
              <input id="name" type="text">
            </form>
            <button>Submit</button>
            <a href="/about">About us</a>
          </main>
          <footer>Footer</footer>
        </body></html>
        """
        result = audit_accessibility(make_soup(html))
        assert result["score"] == 100
        assert result["issues"] == []

    def test_missing_lang(self):
        html = "<html><head></head><body><main><a href='#main'>Skip</a></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("lang" in i.lower() for i in result["issues"])

    def test_images_no_alt(self):
        html = "<html lang='en'><head></head><body><main><a href='#main'>Skip</a><img src='x.png'></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("alt text" in i.lower() for i in result["issues"])

    def test_unlabeled_inputs(self):
        html = "<html lang='en'><head></head><body><main><a href='#main'>Skip</a><form><input type='text'></form></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("label" in i.lower() for i in result["issues"])

    def test_empty_button(self):
        html = "<html lang='en'><head></head><body><main><a href='#main'>Skip</a><button></button></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("button" in i.lower() for i in result["issues"])

    def test_vague_links(self):
        html = "<html lang='en'><head></head><body><main><a href='#main'>Skip</a><a href='/x'>click here</a></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("non-descriptive" in i.lower() for i in result["issues"])

    def test_missing_aria_landmarks(self):
        html = "<html lang='en'><head></head><body><a href='#main'>Skip</a></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("landmark" in i.lower() for i in result["issues"])

    def test_iframe_missing_title(self):
        html = "<html lang='en'><head></head><body><main><a href='#main'>Skip</a><iframe src='x'></iframe></main></body></html>"
        result = audit_accessibility(make_soup(html))
        assert any("iframe" in i.lower() for i in result["issues"])

    def test_score_never_below_zero(self):
        html = "<html><head></head><body></body></html>"
        result = audit_accessibility(make_soup(html))
        assert result["score"] >= 0


class TestAuditSecurity:
    def _run(self, headers: dict, url: str = "https://example.com", text: str = ""):
        response = make_mock_response(headers, text)
        with patch("audit.ssl.create_default_context"), \
             patch("audit.socket.socket"):
            return audit_security(url, response)

    def test_perfect_headers(self):
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
        }
        result = self._run(headers)
        assert result["score"] == 100
        assert result["issues"] == []

    def test_http_url_penalized(self):
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
        }
        result = self._run(headers, url="http://example.com")
        assert result["score"] < 100
        assert any("https" in i.lower() for i in result["issues"])

    def test_missing_x_frame_options(self):
        headers = {
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
        }
        result = self._run(headers)
        assert any("x-frame-options" in i.lower() for i in result["issues"])

    def test_missing_permissions_policy(self):
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
        }
        result = self._run(headers)
        assert any("permissions-policy" in i.lower() for i in result["issues"])

    def test_server_header_exposes_stack(self):
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
            "Server": "Apache/2.4.54",
        }
        result = self._run(headers)
        assert any("server header" in i.lower() for i in result["issues"])

    def test_cookie_missing_httponly(self):
        headers = {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Strict-Transport-Security": "max-age=31536000",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
            "Set-Cookie": "session=abc; Secure; SameSite=Strict",
        }
        result = self._run(headers)
        assert any("httponly" in i.lower() for i in result["issues"])

    def test_score_never_below_zero(self):
        result = self._run({}, url="http://bad.com")
        assert result["score"] >= 0


class TestAuditPerformance:
    def _run(self, html: str, load_time: float, headers: dict = None):
        soup = make_soup(html)
        response = make_mock_response(headers or {})
        return audit_performance(soup, html, load_time, response)

    def test_fast_clean_page(self):
        html = """
        <html><head>
          <meta name="viewport" content="width=device-width">
        </head><body>
          <img src="a.png" width="100" height="100">
        </body></html>
        """
        result = self._run(html, 0.5)
        assert result["score"] == 100
        assert result["issues"] == []

    def test_slow_load_time(self):
        html = "<html><head><meta name='viewport' content='width=device-width'></head><body></body></html>"
        result = self._run(html, 4.0)
        assert result["score"] < 100
        assert any("slow load" in i.lower() for i in result["issues"])

    def test_blocking_scripts(self):
        html = "<html><head><meta name='viewport' content='width=device-width'><script src='a.js'></script></head><body></body></html>"
        result = self._run(html, 0.5)
        assert any("render-blocking" in i.lower() for i in result["issues"])

    def test_async_script_not_blocking(self):
        html = "<html><head><meta name='viewport' content='width=device-width'><script src='a.js' async></script></head><body></body></html>"
        result = self._run(html, 0.5)
        assert not any("render-blocking" in i.lower() for i in result["issues"])

    def test_missing_viewport(self):
        html = "<html><head></head><body></body></html>"
        result = self._run(html, 0.5)
        assert any("viewport" in i.lower() for i in result["issues"])

    def test_unsized_images(self):
        imgs = "".join([f"<img src='img{i}.png'>" for i in range(6)])
        html = f"<html><head><meta name='viewport' content='width=device-width'></head><body>{imgs}</body></html>"
        result = self._run(html, 0.5)
        assert any("width/height" in i.lower() for i in result["issues"])

    def test_large_uncompressed_html(self):
        # Simulate >500KB uncompressed with no Content-Encoding
        html = "<html><head><meta name='viewport' content='width=device-width'></head><body>" + ("x" * 600000) + "</body></html>"
        result = self._run(html, 0.5, headers={})
        assert any("compress" in i.lower() or "html" in i.lower() for i in result["issues"])

    def test_score_never_below_zero(self):
        imgs = "".join([f"<img src='img{i}.png'>" for i in range(10)])
        scripts = "".join([f"<script src='s{i}.js'></script>" for i in range(10)])
        html = f"<html><head>{scripts}</head><body>{imgs}</body></html>"
        result = self._run(html, 6.0)
        assert result["score"] >= 0


class TestErrorResult:
    def test_structure(self):
        result = error_result("https://bad.com", "Could not fetch")
        assert result["url"] == "https://bad.com"
        assert result["error"] == "Could not fetch"
        assert result["scores"]["overall"] == 0
        assert "Could not fetch" in result["issues"]


# ─────────────────────────────────────────
# FastAPI route tests (no real HTTP, no AI)
# ─────────────────────────────────────────

MOCK_AUDIT_RESULT = {
    "url": "https://example.com",
    "scores": {
        "performance": 80,
        "seo": 75,
        "accessibility": 90,
        "security": 85,
        "overall": 82.5,
    },
    "issues": {
        "performance": [],
        "seo": ["Missing canonical tag"],
        "accessibility": [],
        "security": [],
    },
    "issues_flat": ["Missing canonical tag"],
    "ai_summary": None,
    "error": None,
}


@pytest.fixture(scope="module")
def client():
    with patch("audit.fetch_page"), \
         patch("main.run_audit", return_value=MOCK_AUDIT_RESULT), \
         patch("main.generate_ai_summary", return_value="Mocked AI summary."), \
         patch("main.start_scheduler"), \
         patch("main.add_scheduled_audit"):
        from main import app
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


class TestRootRoute:
    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["message"] == "Vigil is running"


class TestAuditRoute:
    def test_audit_adds_https(self, client):
        with patch("main.run_audit", return_value=MOCK_AUDIT_RESULT), \
             patch("main.generate_ai_summary", return_value="AI summary"):
            response = client.post("/audit", json={"url": "example.com"})
            assert response.status_code == 200

    def test_audit_returns_scores(self, client):
        with patch("main.run_audit", return_value=MOCK_AUDIT_RESULT), \
             patch("main.generate_ai_summary", return_value="AI summary"):
            response = client.post("/audit", json={"url": "https://example.com"})
            assert response.status_code == 200
            data = response.json()
            assert "scores" in data
            assert "issues" in data
            assert "ai_summary" in data

    def test_audit_error_returns_400(self, client):
        error_mock = {**MOCK_AUDIT_RESULT, "error": "Could not fetch the page"}
        with patch("main.run_audit", return_value=error_mock):
            response = client.post("/audit", json={"url": "https://unreachable.invalid"})
            assert response.status_code == 400


class TestSchedulesRoute:
    def test_list_schedules_requires_auth(self, client):
        response = client.get("/schedules")
        assert response.status_code == 401

    def test_list_schedules_with_auth(self, client):
        # Sign up a user and use their token
        signup = client.post("/auth/signup", json={
            "username": "scheduser", "email": "sched@test.com", "password": "testpass123"
        })
        token = signup.json()["token"]
        response = client.get("/schedules", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert isinstance(response.json(), list)
