from __future__ import annotations

import json
import os
import re
from datetime import datetime

from google import genai

from ..config import DEFAULT_MODEL
from ..models import GrantDetails

_MONEY = re.compile(r"\$\s*([\d,]+)")
_DATE = re.compile(
    r"(?:deadline|due|apply by)\s*[:\-]?\s*"
    r"([A-Z][a-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})",
    re.IGNORECASE,
)


def _heuristic_parse(url: str, text: str) -> GrantDetails:
    lines = [line for line in text.splitlines() if line.strip()]
    title = lines[0][:200] if lines else "Untitled grant opportunity"
    money_match = _MONEY.search(text)
    date_match = _DATE.search(text)
    deadline = None
    if date_match:
        for fmt in ("%B %d, %Y", "%B %d %Y", "%Y-%m-%d"):
            try:
                deadline = datetime.strptime(date_match.group(1), fmt).date()
                break
            except ValueError:
                pass
    return GrantDetails(
        title=title,
        url=url,
        funding_amount=int(money_match.group(1).replace(",", "")) if money_match else None,
        deadline=deadline,
        eligibility_summary=_matching_excerpt(text, "eligib"),
        geographic_restrictions=_matching_excerpt(text, "location"),
        nonprofit_for_profit_requirements=_matching_excerpt(text, "nonprofit"),
        extraction_notes=[
            "Heuristic extraction used. Verify all fields before making an eligibility decision."
        ],
    )


def _matching_excerpt(text: str, keyword: str) -> str | None:
    for line in text.splitlines():
        if keyword.lower() in line.lower():
            return line[:500]
    return None


def parse_grant(url: str, text: str, model: str = DEFAULT_MODEL) -> GrantDetails:
    """Use Gemini structured output when configured; otherwise use conservative heuristics."""
    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GENAI_USE_VERTEXAI")):
        return _heuristic_parse(url, text)

    try:
        client = genai.Client()
        prompt = f"""Extract the grant page into the provided schema.
Do not infer missing facts. Use empty lists or null for unknown fields.
The source URL is {url}.

PAGE TEXT:
{text[:100_000]}"""
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": GrantDetails},
        )
        payload = json.loads(response.text)
        payload["url"] = url
        return GrantDetails.model_validate(payload)
    except Exception as error:
        grant = _heuristic_parse(url, text)
        grant.extraction_notes.append(
            f"AI extraction failed, so heuristic extraction was used: {type(error).__name__}."
        )
        return grant
