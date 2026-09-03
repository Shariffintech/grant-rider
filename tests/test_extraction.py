from grant_application_agent.extraction.parse_grant import _heuristic_parse, parse_grant
from grant_application_agent.extraction.scrape_page import scrape_page


def test_heuristic_parser_extracts_basic_fields() -> None:
    grant = _heuristic_parse(
        "https://example.com/grant",
        "Education Innovation Grant\nDeadline: August 15, 2026\nAwards up to $50,000",
    )
    assert grant.title == "Education Innovation Grant"
    assert grant.deadline.isoformat() == "2026-08-15"
    assert grant.funding_amount == 50_000


def test_parse_grant_falls_back_when_ai_extraction_fails(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    class BrokenClient:
        def __init__(self) -> None:
            raise RuntimeError("client unavailable")

    monkeypatch.setattr("grant_application_agent.extraction.parse_grant.genai.Client", BrokenClient)

    grant = parse_grant(
        "https://example.com/grant",
        "Education Innovation Grant\nDeadline: August 15, 2026\nAwards up to $50,000",
    )

    assert grant.title == "Education Innovation Grant"
    assert any("AI extraction failed" in note for note in grant.extraction_notes)


def test_scrape_page_uses_firecrawl_when_configured(monkeypatch) -> None:
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-key")

    class Response:
        ok = True

        def json(self):
            return {"success": True, "data": {"markdown": "Grant page markdown"}}

    def post(url, **kwargs):
        assert url == "https://api.firecrawl.dev/v2/scrape"
        assert kwargs["headers"]["authorization"] == "Bearer test-key"
        return Response()

    monkeypatch.setattr("grant_application_agent.extraction.scrape_page.requests.post", post)

    assert scrape_page("https://example.com/grant") == "Grant page markdown"


def test_scrape_page_falls_back_when_firecrawl_fails(monkeypatch) -> None:
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-key")

    class Response:
        text = "<html><main>Fallback grant content</main></html>"

        def raise_for_status(self):
            return None

    monkeypatch.setattr(
        "grant_application_agent.extraction.scrape_page.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("firecrawl unavailable")),
    )
    monkeypatch.setattr(
        "grant_application_agent.extraction.scrape_page.requests.get",
        lambda *args, **kwargs: Response(),
    )

    assert scrape_page("https://example.com/grant") == "Fallback grant content"
