from grant_application_agent.extraction.parse_grant import _heuristic_parse


def test_heuristic_parser_extracts_basic_fields() -> None:
    grant = _heuristic_parse(
        "https://example.com/grant",
        "Education Innovation Grant\nDeadline: August 15, 2026\nAwards up to $50,000",
    )
    assert grant.title == "Education Innovation Grant"
    assert grant.deadline.isoformat() == "2026-08-15"
    assert grant.funding_amount == 50_000
