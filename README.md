# Granted

Granted is a Python-only grant application workflow built around Google ADK 2.0
graph workflows. AI extracts and drafts; deterministic Python rules score and route;
the founder controls the source profile and every submission decision.

```text
Founder Profile -> Extract -> Score -> Route -> Draft -> Human Review
```
![Granted Workflow](image.png)


## Setup

```bash
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

Set `GOOGLE_API_KEY` for Gemini structured extraction and drafting. Without credentials,
the CLI uses conservative extraction and creates a draft template with explicit
`[NEEDS FOUNDER INPUT]` markers.

## Run the CLI

```bash
grant-rider run --url "https://example.com/grant"
# or
python -m grant_application_agent.main run --url "https://example.com/grant"
```

Discover candidate opportunities with the configured keywords:

```bash
grant-rider discover
```

Reports are saved under `outputs/reports/`. Drafts are created under `outputs/drafts/`
only when the deterministic score reaches `minimum_score_to_draft`.

## Run with ADK 2.0

ADK discovers `root_agent` in `grant_application_agent/agent.py`:

```bash
adk web
```

The ADK graph runs `process_grant_url`, then routes on the deterministic
`score.next_step` value to draft-complete, founder-review, or archive nodes. It never
submits an application.

## Scoring

| Category | Points |
| --- | ---: |
| Mission fit | 25 |
| Eligibility fit | 25 |
| Funding use fit | 20 |
| Geographic fit | 10 |
| Stage fit | 10 |
| Application effort | 10 |

Unknown facts receive partial or zero credit and are surfaced for human review.
