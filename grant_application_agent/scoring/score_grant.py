from __future__ import annotations

from datetime import date

from ..models import FounderProfile, GrantDetails, GrantScore, ScoreBreakdown


def _norm(values: list[str]) -> set[str]:
    return {value.strip().lower() for value in values if value.strip()}


def _overlaps(left: list[str], right: list[str]) -> list[str]:
    matches = []
    for a in _norm(left):
        for b in _norm(right):
            if a in b or b in a:
                matches.append(a)
    return sorted(set(matches))


def score_grant(profile: FounderProfile, grant: GrantDetails) -> GrantScore:
    reasons: list[str] = []
    disqualifiers: list[str] = []

    mission_matches = _overlaps(profile.focus_areas + [profile.industry], grant.focus_areas)
    mission = 25 if mission_matches else 0
    reasons.append(f"Mission fit: {mission}/25; matches: {mission_matches or ['none verified']}.")

    entity_types = _norm(grant.eligible_entity_types)
    eligibility = 10 if not entity_types else (25 if profile.entity_type.lower() in entity_types else 0)
    if "nonprofit" in entity_types and profile.entity_type.lower() != "nonprofit":
        disqualifiers.append("Entity type is not eligible.")
    reasons.append(f"Eligibility fit: {eligibility}/25 based on verified entity requirements.")

    use_matches = _overlaps(profile.funding_needs, grant.allowed_uses)
    funding_use = 20 if use_matches else 0
    reasons.append(f"Funding use fit: {funding_use}/20; matches: {use_matches or ['none verified']}.")

    location_matches = _overlaps(profile.eligible_locations, grant.eligible_locations)
    geography = 5 if not grant.eligible_locations else (10 if location_matches else 0)
    if grant.eligible_locations and not location_matches:
        disqualifiers.append("No verified eligible location matches the founder profile.")
    reasons.append(f"Geographic fit: {geography}/10.")

    stages = _norm(grant.eligible_stages)
    stage = 5 if not stages else (10 if profile.business_stage.lower() in stages else 0)
    if stages and profile.business_stage.lower() not in stages:
        disqualifiers.append("Business stage is not listed as eligible.")
    reasons.append(f"Stage fit: {stage}/10.")

    effort_map = {"low": 10, "medium": 7, "high": 3, "unknown": 5}
    effort = effort_map.get(grant.estimated_effort.lower(), 5)
    if grant.deadline and grant.deadline < date.today():
        effort = 0
        disqualifiers.append("Application deadline has passed.")
    reasons.append(f"Application effort: {effort}/10.")

    breakdown = ScoreBreakdown(
        mission_fit=mission,
        eligibility_fit=eligibility,
        funding_use_fit=funding_use,
        geographic_fit=geography,
        stage_fit=stage,
        application_effort=effort,
    )
    total = sum(breakdown.model_dump().values())
    if disqualifiers:
        next_step = "archive_opportunity"
    elif total >= profile.minimum_score_to_draft:
        next_step = "draft_application"
    elif total >= 60:
        next_step = "needs_founder_review"
    else:
        next_step = "archive_opportunity"
    return GrantScore(
        total=total,
        breakdown=breakdown,
        reasons=reasons,
        disqualifiers=disqualifiers,
        next_step=next_step,
    )
