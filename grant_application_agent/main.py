from pathlib import Path
from typing import Annotated

import typer

import json

from .config import DEFAULT_OUTPUT_DIR, DEFAULT_PROFILE_PATH, SEARCH_KEYWORDS
from .discovery.search_grants import search_grants
from .workflow import run_url

app = typer.Typer(help="Find, score, route, and draft grants with founder-controlled data.")


@app.command()
def discover(
    output_dir: Annotated[Path, typer.Option()] = DEFAULT_OUTPUT_DIR / "discovery",
    limit: Annotated[int, typer.Option(help="Results per search keyword.")] = 5,
) -> None:
    """Discover opportunities from configured search keywords."""
    opportunities = search_grants(SEARCH_KEYWORDS, output_dir / "raw", limit)
    path = output_dir / "opportunities.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(opportunities, indent=2), encoding="utf-8")
    typer.echo(f"Saved {len(opportunities)} opportunities to {path}")


@app.command()
def run(
    url: Annotated[str, typer.Option(help="Founder-supplied grant URL.")],
    profile: Annotated[Path, typer.Option()] = DEFAULT_PROFILE_PATH,
    output_dir: Annotated[Path, typer.Option()] = DEFAULT_OUTPUT_DIR,
) -> None:
    result = run_url(url, profile, output_dir)
    typer.echo(result.model_dump_json(indent=2))


if __name__ == "__main__":
    app()
