from pathlib import Path

import yaml

from grant_application_agent.models import GrantDetails
from grant_application_agent.workflow import run_url


def test_high_fit_workflow_creates_reviewable_draft(tmp_path: Path, monkeypatch) -> None:
    profile_path = tmp_path / "profile.yaml"
    profile_path.write_text(
        yaml.safe_dump(
            {
                "name": "Test Co",
                "founder_name": "Founder",
                "industry": "Education Technology",
                "entity_type": "for-profit",
                "focus_areas": ["special education"],
                "business_stage": "pre-seed",
                "eligible_locations": ["Pennsylvania"],
                "target_customers": ["school districts"],
                "funding_needs": ["product development"],
                "minimum_score_to_draft": 80,
            }
        ),
        encoding="utf-8",
    )
    grant = GrantDetails(
        title="High Fit Grant",
        url="https://example.com/grant",
        eligible_entity_types=["for-profit"],
        eligible_locations=["Pennsylvania"],
        eligible_stages=["pre-seed"],
        focus_areas=["special education"],
        allowed_uses=["product development"],
        estimated_effort="low",
    )
    monkeypatch.setattr("grant_application_agent.workflow.scrape_page", lambda _url: "page")
    monkeypatch.setattr("grant_application_agent.workflow.parse_grant", lambda _url, _text: grant)

    result = run_url("https://example.com/grant", profile_path, tmp_path / "outputs")

    assert result.score.total == 100
    assert result.draft_path is not None
    assert Path(result.draft_path).exists()
    assert Path(result.report_path).exists()
    assert result.grant.status == "draft_created"


def test_workflow_writes_report_when_grant_page_cannot_be_fetched(
    tmp_path: Path, monkeypatch
) -> None:
    profile_path = tmp_path / "profile.yaml"
    profile_path.write_text(
        yaml.safe_dump(
            {
                "name": "Test Co",
                "founder_name": "Founder",
                "industry": "Education Technology",
                "entity_type": "for-profit",
                "focus_areas": ["special education"],
                "business_stage": "pre-seed",
                "eligible_locations": ["Pennsylvania"],
                "target_customers": ["school districts"],
                "funding_needs": ["product development"],
                "minimum_score_to_draft": 80,
            }
        ),
        encoding="utf-8",
    )

    def fail_scrape(_url: str) -> str:
        raise RuntimeError("blocked by remote site")

    monkeypatch.setattr("grant_application_agent.workflow.scrape_page", fail_scrape)

    result = run_url("https://example.com/grant", profile_path, tmp_path / "outputs")

    assert result.draft_path is None
    assert Path(result.report_path).exists()
    assert result.grant.status == "archived"
    assert "could not be fetched" in result.grant.extraction_notes[0]
