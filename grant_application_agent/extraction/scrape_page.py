from __future__ import annotations

import os

import requests
from bs4 import BeautifulSoup


def scrape_page(url: str, timeout_seconds: int = 30) -> str:
    firecrawl_error = None
    if os.getenv("FIRECRAWL_API_KEY"):
        try:
            return scrape_with_firecrawl(url, timeout_seconds)
        except Exception as error:
            firecrawl_error = error

    response = requests.get(
        url,
        timeout=timeout_seconds,
        headers={"User-Agent": "GrantRider/0.1 (+human-reviewed grant research)"},
    )
    try:
        response.raise_for_status()
    except Exception as error:
        if firecrawl_error:
            raise RuntimeError(
                f"Firecrawl scrape failed with {type(firecrawl_error).__name__}; "
                f"direct scrape failed with {type(error).__name__}: {error}"
            ) from error
        raise

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()
    return "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())


def scrape_with_firecrawl(url: str, timeout_seconds: int = 30) -> str:
    response = requests.post(
        "https://api.firecrawl.dev/v2/scrape",
        timeout=timeout_seconds,
        headers={
            "authorization": f"Bearer {os.environ['FIRECRAWL_API_KEY']}",
            "content-type": "application/json",
        },
        json={
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True,
            "timeout": timeout_seconds * 1000,
        },
    )
    payload = response.json()
    if not response.ok or payload.get("success") is False:
        raise RuntimeError(payload.get("error") or "Firecrawl scrape failed.")

    data = payload.get("data") or {}
    text = data.get("markdown") or data.get("html") or ""
    if not text.strip():
        raise RuntimeError("Firecrawl did not return page content.")
    return text
