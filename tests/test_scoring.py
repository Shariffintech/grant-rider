from grant_application_agent.models import FounderProfile, GrantDetails
from grant_application_agent.scoring.score_grant import score_grant


def profile() -> FounderProfile:
    return FounderProfile(
        name="Test Co",
        founder_name="Founder",
        industry="Education Technology",
        entity_type="for-profit",
        focus_areas=["special education", "AI"],
        business_stage="pre-seed",
        eligible_locations=["Pennsylvania", "New Jersey"],
        target_customers=["school districts"],
        funding_needs=["product development", "pilot programs"],
        minimum_score_to_draft=80,
    )


def test_high_fit_grant_routes_to_draft() -> None:
    grant = GrantDetails(
        title="Education AI Grant",
        url="https://example.com/grant",
        eligible_entity_types=["for-profit"],
        eligible_locations=["Pennsylvania"],
        eligible_stages=["pre-seed"],
        focus_areas=["special education", "AI"],
        allowed_uses=["product development", "pilot programs"],
        estimated_effort="low",
    )
    result = score_grant(profile(), grant)
    assert result.total == 100
    assert result.next_step == "draft_application"


def test_nonprofit_only_is_disqualifying() -> None:
    grant = GrantDetails(
        title="Nonprofit Grant",
        url="https://example.com/grant",
        eligible_entity_types=["nonprofit"],
        focus_areas=["special education"],
    )
    result = score_grant(profile(), grant)
    assert result.next_step == "archive_opportunity"
    assert "Entity type is not eligible." in result.disqualifiers


def test_unknown_fields_do_not_receive_full_credit() -> None:
    grant = GrantDetails(title="Unknown Grant", url="https://example.com/grant")
    result = score_grant(profile(), grant)
    assert result.total == 25
    assert result.next_step == "archive_opportunity"
