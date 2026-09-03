from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from .drafting.generate_draft import generate_draft
from .extraction.parse_grant import parse_grant
from .extraction.scrape_page import scrape_page
from .models import GrantDetails, GrantStatus, WorkflowResult
from .profile import load_profile
from .scoring.score_grant import score_grant


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:80] or "grant"


def _grant_from_scrape_failure(url: str, error: Exception) -> GrantDetails:
    host = urlparse(url).netloc or url
    return GrantDetails(
        title=f"Grant page unavailable: {host}",
        url=url,
        extraction_notes=[
            "The grant page could not be fetched. Open the source URL manually and verify details.",
            f"Fetch error: {type(error).__name__}: {error}",
        ],
    )


def run_url(url: str, profile_path: Path, output_dir: Path) -> WorkflowResult:
    try:
        page_text = scrape_page(url)
    except Exception as error:
        grant = _grant_from_scrape_failure(url, error)
    else:
        grant = parse_grant(url, page_text)

    return run_grant(grant, profile_path, output_dir)


def run_url_with_text(url: str, text: str, profile_path: Path, output_dir: Path) -> WorkflowResult:
    grant = parse_grant(url, text)
    return run_grant(grant, profile_path, output_dir)


def run_grant(grant: GrantDetails, profile_path: Path, output_dir: Path) -> WorkflowResult:
    profile = load_profile(profile_path)

    score = score_grant(profile, grant)
    slug = _slug(grant.title)
    reports = output_dir / "reports"
    drafts = output_dir / "drafts"
    reports.mkdir(parents=True, exist_ok=True)

    draft_path = None
    if score.next_step == "draft_application":
        drafts.mkdir(parents=True, exist_ok=True)
        path = drafts / f"{slug}.md"
        path.write_text(generate_draft(profile, grant, score), encoding="utf-8")
        draft_path = str(path)
        grant.status = GrantStatus.DRAFT_CREATED
    elif score.next_step == "needs_founder_review":
        grant.status = GrantStatus.NEEDS_REVIEW
    else:
        grant.status = GrantStatus.ARCHIVED

    report_path = reports / f"{slug}.json"
    result = WorkflowResult(
        grant=grant, score=score, draft_path=draft_path, report_path=str(report_path)
    )
    report_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    return result


def run_url_json(url: str, profile_path: str = "founder_profile.yaml", output_dir: str = "outputs") -> str:
    """Run the controlled grant workflow for one founder-supplied URL."""
    return json.dumps(
        run_url(url, Path(profile_path), Path(output_dir)).model_dump(mode="json"), indent=2
    )
