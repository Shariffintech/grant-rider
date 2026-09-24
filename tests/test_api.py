from pathlib import Path

from fastapi.testclient import TestClient

from grant_application_agent.api import app
from grant_application_agent.models import GrantDetails


def test_run_endpoint_returns_workflow_result(tmp_path: Path, monkeypatch) -> None:
    profile_path = tmp_path / "profile.yaml"
    profile_path.write_text(
        """
name: Test Co
founder_name: Founder
industry: Education Technology
entity_type: for-profit
focus_areas:
  - special education
business_stage: pre-seed
eligible_locations:
  - Pennsylvania
target_customers:
  - school districts
funding_needs:
  - product development
minimum_score_to_draft: 80
""".strip(),
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
    monkeypatch.setattr("grant_application_agent.api.DEFAULT_PROFILE_PATH", profile_path)
    monkeypatch.setattr("grant_application_agent.api.OUTPUT_DIR", tmp_path / "outputs")
    monkeypatch.setattr("grant_application_agent.workflow.scrape_page", lambda _url: "page")
    monkeypatch.setattr("grant_application_agent.workflow.parse_grant", lambda _url, _text: grant)

    response = TestClient(app).post(
        "/run",
        json={
            "url": "https://example.com/grant",
            "profile": {
                "name": "Visitor Co",
                "founder_name": "Visitor",
                "industry": "Education Technology",
                "entity_type": "for-profit",
                "focus_areas": ["special education"],
                "business_stage": "pre-seed",
                "eligible_locations": ["Pennsylvania"],
                "target_customers": ["school districts"],
                "funding_needs": ["product development"],
                "excluded_grants": [],
                "minimum_score_to_draft": 80,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["grant"]["title"] == "High Fit Grant"
    assert payload["score"]["total"] == 100

    draft_response = TestClient(app).post("/draft", json={"draftPath": payload["draft_path"]})

    assert draft_response.status_code == 200
    assert "High Fit Grant" in draft_response.json()["content"]
    assert "Visitor Co" in draft_response.json()["content"]

    reports_response = TestClient(app).get("/reports")
    assert reports_response.status_code == 200
    assert reports_response.json()[0]["grant"]["title"] == "High Fit Grant"

    archive_response = TestClient(app).post(
        "/archive", json={"reportPath": payload["report_path"]}
    )
    assert archive_response.status_code == 200
    archived = archive_response.json()
    assert archived["grant"]["status"] == "archived"
    assert archived["score"]["next_step"] == "archive_opportunity"
    assert "Archived manually after founder review." in archived["score"]["disqualifiers"]


def test_run_endpoint_accepts_pre_scraped_page_text(tmp_path: Path, monkeypatch) -> None:
    profile_path = tmp_path / "profile.yaml"
    profile_path.write_text(
        """
name: Test Co
founder_name: Founder
industry: Education Technology
entity_type: for-profit
focus_areas:
  - special education
business_stage: pre-seed
eligible_locations:
  - Pennsylvania
target_customers:
  - school districts
funding_needs:
  - product development
minimum_score_to_draft: 80
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setattr("grant_application_agent.api.DEFAULT_PROFILE_PATH", profile_path)
    monkeypatch.setattr("grant_application_agent.api.OUTPUT_DIR", tmp_path / "outputs")

    response = TestClient(app).post(
        "/run",
        json={
            "url": "https://example.com/grant",
            "pageText": "Education Innovation Grant\nDeadline: August 15, 2026\nAwards up to $50,000",
        },
    )

    assert response.status_code == 200
    assert response.json()["grant"]["title"] == "Education Innovation Grant"
