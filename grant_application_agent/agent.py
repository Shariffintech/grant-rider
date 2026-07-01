"""Google ADK 2.0 graph workflow entrypoint."""

import json

from google.adk import Event, Workflow

from .workflow import run_url_json


def process_grant_url(node_input: str) -> dict:
    return json.loads(run_url_json(node_input.strip()))


def route_by_score(node_input: dict) -> Event:
    return Event(route=node_input["score"]["next_step"], output=node_input)


def draft_complete(node_input: dict) -> Event:
    return Event(message=f"Draft created for review: {node_input['draft_path']}", output=node_input)


def founder_review_required(node_input: dict) -> Event:
    return Event(message="Grant requires founder review before drafting.", output=node_input)


def archived(node_input: dict) -> Event:
    return Event(message="Grant archived by deterministic routing rules.", output=node_input)


root_agent = Workflow(
    name="grant_application_workflow",
    edges=[
        ("START", process_grant_url, route_by_score),
        (
            route_by_score,
            {
                "draft_application": draft_complete,
                "needs_founder_review": founder_review_required,
                "archive_opportunity": archived,
            },
        ),
    ],
)

