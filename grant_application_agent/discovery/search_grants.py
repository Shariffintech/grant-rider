from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any


def search_grants(keywords: list[str], output_dir: Path, limit: int = 5) -> list[dict[str, Any]]:
    """Search configurable keywords with the authenticated Firecrawl CLI."""
    output_dir.mkdir(parents=True, exist_ok=True)
    opportunities: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for index, keyword in enumerate(keywords):
        search_path = output_dir / f"search-{index:02d}.json"
        subprocess.run(
            [
                "firecrawl",
                "search",
                keyword,
                "--limit",
                str(limit),
                "--json",
                "-o",
                str(search_path),
            ],
            check=True,
        )
        payload = json.loads(search_path.read_text(encoding="utf-8"))
        for item in (payload.get("data") or {}).get("web", []):
            url = item.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            opportunities.append(
                {
                    "title": item.get("title") or "Untitled opportunity",
                    "url": url,
                    "source": "automated_search",
                    "eligibility_summary": item.get("description"),
                    "status": "discovered",
                    "search_keyword": keyword,
                }
            )

    return opportunities
