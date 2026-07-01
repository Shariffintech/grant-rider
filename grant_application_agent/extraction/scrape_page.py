from __future__ import annotations

import requests
from bs4 import BeautifulSoup


def scrape_page(url: str, timeout_seconds: int = 30) -> str:
    response = requests.get(
        url,
        timeout=timeout_seconds,
        headers={"User-Agent": "GrantRider/0.1 (+human-reviewed grant research)"},
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()
    return "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())

