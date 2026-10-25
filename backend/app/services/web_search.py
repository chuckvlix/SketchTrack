import ipaddress
import re
import socket
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS

BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),       # includes 169.254.169.254 (cloud metadata)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),             # IPv6 loopback
    ipaddress.ip_network("::ffff:0:0/96"),       # IPv4-mapped IPv6
    ipaddress.ip_network("100::/64"),
    ipaddress.ip_network("2001:db8::/32"),
    ipaddress.ip_network("fc00::/7"),            # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),           # IPv6 link-local
    ipaddress.ip_network("64:ff9b::/96"),        # IPv4/IPv6 translation
    ipaddress.ip_network("64:ff9b:1::/48"),      # Local-Use IPv4/IPv6 translation
]

DANGEROUS_PORTS = {
    21, 22, 23, 25, 53, 110, 135, 137, 138, 139,
    143, 445, 1433, 1521, 3306, 5432, 6379, 11211, 27017, 28017
}

def is_safe_url(url: str) -> bool:
    """
    Validates that a URL uses http/https and resolves to safe, non-private,
    non-loopback, and non-metadata IP addresses to mitigate SSRF.
    """
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        # Disallow non-web / internal service ports (e.g. SSH, SMTP, Redis)
        if parsed.port and parsed.port in DANGEROUS_PORTS:
            return False

        lower_host = hostname.lower().rstrip(".")
        if lower_host == "localhost" or lower_host.endswith(".localhost") or lower_host.endswith(".local"):
            return False

        try:
            addr_info = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
        except (socket.gaierror, socket.herror):
            return False

        if not addr_info:
            return False

        for entry in addr_info:
            sockaddr = entry[4]
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)

            if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
                ip = ip.ipv4_mapped

            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
                return False

            for net in BLOCKED_NETWORKS:
                if ip in net:
                    return False

        return True
    except Exception:
        return False

def infer_platform_from_url(url: str) -> str:
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    if "developer.mozilla.org" in url_lower or "docs." in url_lower or "/docs/" in url_lower or "learn." in url_lower or "wiki" in url_lower:
        return "docs"
    if "coursera.org" in url_lower or "udemy.com" in url_lower or "edx.org" in url_lower or "platzi.com" in url_lower or "udacity.com" in url_lower:
        return "course"
    if "github.com" in url_lower:
        return "docs"
    if "oreilly.com" in url_lower or "manning.com" in url_lower or "amazon." in url_lower or "goodreads.com" in url_lower:
        return "book"
    return "article"

def search_resources_for_topic(topic: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """
    Performs live search on YouTube and web via DuckDuckGo (zero API key)
    to retrieve verified URLs, titles, and platforms for the AI Copilot.
    """
    max_results = max(1, min(int(max_results), 10))
    clean_topic = (topic or "").strip()[:200]
    if not clean_topic:
        return []

    results: List[Dict[str, Any]] = []
    seen_urls = set()

    try:
        with DDGS() as ddgs:
            # 1. Search for video tutorials on YouTube (primary courses)
            video_query = f"{topic} tutorial curso español youtube"
            try:
                videos = list(ddgs.videos(video_query, max_results=max(3, max_results // 2)))
                for v in videos:
                    url = v.get("content") or v.get("embed_url") or ""
                    if url and url not in seen_urls and "youtube.com" in url:
                        seen_urls.add(url)
                        results.append({
                            "title": v.get("title", f"Tutorial de {topic}"),
                            "url": url,
                            "platform": "youtube",
                            "duration": v.get("duration", "N/A"),
                            "snippet": v.get("description", "")[:200],
                            "type": "video"
                        })
            except Exception as e:
                # Video search error fallback
                pass

            # 2. Search for official documentation, guides, or interactive courses
            text_query = f"{topic} tutorial guia documentacion oficial"
            try:
                texts = list(ddgs.text(text_query, max_results=max_results))
                for t in texts:
                    url = t.get("href", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        platform = infer_platform_from_url(url)
                        results.append({
                            "title": t.get("title", f"Recurso de {topic}"),
                            "url": url,
                            "platform": platform,
                            "duration": None,
                            "snippet": t.get("body", "")[:200],
                            "type": "text"
                        })
            except Exception:
                pass
    except Exception:
        pass

    # If search returned fewer than 3 items (e.g. rate limit), provide robust verified fallbacks
    if len(results) < 3:
        clean_topic = urllib.parse.quote(topic)
        results.append({
            "title": f"Búsqueda de tutoriales para {topic} en YouTube",
            "url": f"https://www.youtube.com/results?search_query={clean_topic}+tutorial+completo",
            "platform": "youtube",
            "duration": None,
            "snippet": f"Colección de tutoriales en video actualizados sobre {topic}.",
            "type": "video"
        })
        results.append({
            "title": f"Documentación y Guías para {topic}",
            "url": f"https://duckduckgo.com/?q={clean_topic}+documentacion+oficial",
            "platform": "docs",
            "duration": None,
            "snippet": f"Documentación técnica y guías de referencia para {topic}.",
            "type": "text"
        })

    return results[:max_results]

async def scrape_url_metadata(url: str) -> Dict[str, Any]:
    """
    Extracts title, description, and platform from a user-supplied URL for Icebox capture.
    Validates DNS resolution to mitigate SSRF and safely restricts redirects.
    """
    platform = infer_platform_from_url(url)
    default_title = urllib.parse.urlsplit(url).netloc or url

    # Block unsafe/private/metadata URLs immediately
    if not is_safe_url(url):
        return {
            "title": default_title,
            "url": url,
            "platform": platform,
            "description": ""
        }

    # Fast path for known YouTube URLs
    parsed_initial = urllib.parse.urlsplit(url)
    init_host = (parsed_initial.hostname or "").lower()
    is_youtube = (
        (init_host in ("youtube.com", "www.youtube.com", "m.youtube.com") and "/watch" in parsed_initial.path)
        or (init_host == "youtu.be" and len(parsed_initial.path.strip("/")) > 0)
    )
    if is_youtube:
        video_id_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
        if video_id_match:
            video_id = video_id_match.group(1)
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            if is_safe_url(oembed_url):
                try:
                    async with httpx.AsyncClient(timeout=4.0, follow_redirects=False) as client:
                        resp = await client.get(oembed_url)
                        if resp.status_code == 200:
                            data = resp.json()
                            return {
                                "title": data.get("title", default_title),
                                "url": url,
                                "platform": "youtube",
                                "author": data.get("author_name"),
                                "description": ""
                            }
                except Exception:
                    pass

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    current_url = url
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False, headers=headers) as client:
            # Safely follow up to 5 redirects, validating target at each hop
            for _ in range(5):
                if not is_safe_url(current_url):
                    return {
                        "title": default_title,
                        "url": url,
                        "platform": platform,
                        "description": ""
                    }

                resp = await client.get(current_url)

                if resp.is_redirect and "location" in resp.headers:
                    target = resp.headers["location"]
                    current_url = urllib.parse.urljoin(current_url, target)
                    continue

                if resp.status_code == 200:
                    content_type = resp.headers.get("content-type", "").lower()
                    if content_type and not any(t in content_type for t in ("text/html", "application/xhtml", "text/plain")):
                        return {
                            "title": default_title,
                            "url": str(resp.url),
                            "platform": platform,
                            "description": ""
                        }

                    soup = BeautifulSoup(resp.text[:500000], "html.parser")
                    title_tag = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"}) or soup.find("title")
                    title = title_tag.get("content", "").strip() if hasattr(title_tag, "get") else (title_tag.text.strip() if title_tag else "")
                    
                    desc_tag = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "description"})
                    desc = desc_tag.get("content", "").strip() if desc_tag and hasattr(desc_tag, "get") else ""

                    return {
                        "title": title or default_title,
                        "url": str(resp.url),
                        "platform": platform,
                        "description": desc[:300]
                    }
                break
    except Exception:
        pass

    return {
        "title": default_title,
        "url": url,
        "platform": platform,
        "description": ""
    }
