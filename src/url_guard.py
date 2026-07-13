"""
SSRF guard for server-side fetches.

Anything the server fetches on behalf of a caller (a scraped website, a
logo image, a linked sub-page) must go through here first. Without it, a
caller can point us at internal addresses -- cloud metadata (169.254.169.254),
localhost admin ports, private RFC1918 ranges -- or use us as an anonymizing
proxy, and (because we summarize what we fetch) read the response back.

The check: only http(s), resolve the hostname, and refuse if *any* resolved
address is non-public. Redirects are followed manually so each hop is
re-validated -- otherwise a public URL could 302 to an internal one.

Known residual gap: DNS rebinding. We validate the resolved IP, then
requests re-resolves when it connects, so a hostile resolver could return a
public IP to us and a private IP to the actual connection. Closing that
fully means pinning the connection to the validated IP; for this app's
threat model (cost/infra probing of a public demo API, not a hardened
multi-tenant service) the resolve-then-fetch check is the proportionate fix.
"""
from __future__ import annotations

import ipaddress
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests

USER_AGENT = "GBPLanderBot/0.1 (+https://example.com/bot-info)"

_ALLOWED_SCHEMES = {"http", "https"}
_MAX_REDIRECTS = 5


class UnsafeURLError(RuntimeError):
    """Raised when a URL is not safe for the server to fetch."""


def _ip_is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def assert_public_url(url: str) -> None:
    """Raise UnsafeURLError unless `url` is http(s) and every address its
    host resolves to is a public, routable IP.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeURLError(f"Refusing to fetch non-http(s) URL: {url!r}")

    host = parsed.hostname
    if not host:
        raise UnsafeURLError(f"URL has no host: {url!r}")

    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise UnsafeURLError(f"Could not resolve host {host!r}: {e}")

    if not infos:
        raise UnsafeURLError(f"Host {host!r} resolved to no addresses")

    for info in infos:
        ip = info[4][0]
        if not _ip_is_public(ip):
            raise UnsafeURLError(
                f"Refusing to fetch URL resolving to non-public IP {ip} ({host})"
            )


def safe_get(
    url: str,
    *,
    timeout: int = 12,
    stream: bool = False,
    headers: Optional[dict] = None,
    session: Optional[requests.Session] = None,
    max_redirects: int = _MAX_REDIRECTS,
) -> requests.Response:
    """Like requests.get, but validates the URL (and every redirect hop)
    against assert_public_url first. Raises UnsafeURLError if any hop is
    unsafe or if the redirect chain is too long.
    """
    getter = session or requests
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)

    current = url
    for _ in range(max_redirects + 1):
        assert_public_url(current)
        resp = getter.get(
            current,
            headers=hdrs,
            timeout=timeout,
            stream=stream,
            allow_redirects=False,
        )
        if resp.is_redirect or resp.is_permanent_redirect:
            location = resp.headers.get("Location")
            if not location:
                return resp
            # Drop the intermediate response's connection before the next hop.
            resp.close()
            current = urljoin(current, location)
            continue
        return resp

    raise UnsafeURLError(f"Too many redirects while fetching {url!r}")
