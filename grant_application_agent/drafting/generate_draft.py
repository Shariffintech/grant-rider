from __future__ import annotations

import os

from google import genai

from ..config import DEFAULT_MODEL
from ..models import FounderProfile, GrantDetails, GrantScore

SECTIONS = [
    "Executive Summary",
    "Founder and Company Bio",
    "Problem Statement",
    "Solution Overview",
    "Target Population",
    "Use of Funds",
    "Implementation Plan",
    "Expected Outcomes",
    "Budget Narrative",
    "Alignment with Grant Criteria",
]


def generate_draft(
    profile: FounderProfile, grant: GrantDetails, score: GrantScore, model: str = DEFAULT_MODEL
) -> str:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GENAI_USE_VERTEXAI"):
        client = genai.Client()
        prompt = f"""Draft a grant application packet for human review.
Use only the verified JSON data below. Never invent founder details, metrics, partners,
budgets, or commitments. Mark every missing fact as [NEEDS FOUNDER INPUT: ...].
Include these sections: {", ".join(SECTIONS)}.

FOUNDER PROFILE:
{profile.model_dump_json(indent=2)}

GRANT DETAILS:
{grant.model_dump_json(indent=2)}

DETERMINISTIC SCORE:
{score.model_dump_json(indent=2)}
"""
        return client.models.generate_content(model=model, contents=prompt).text

    verified = (
        f"{profile.name}, founded by {profile.founder_name}, is a "
        f"{profile.business_stage} {profile.industry} company."
    )
    blocks = [f"# {grant.title} - Draft Application Packet", "", "> Status: needs_review", ""]
    for section in SECTIONS:
        blocks.extend([f"## {section}", verified if section == "Founder and Company Bio" else (
            f"[NEEDS FOUNDER INPUT: Draft and verify {section.lower()} against the grant criteria.]"
        ), ""])
    blocks.extend(["## Human Review Checklist", "- [ ] Accuracy and tone", "- [ ] Eligibility",
                   "- [ ] Budget and legal commitments", "- [ ] Required attachments"])
    return "\n".join(blocks)

