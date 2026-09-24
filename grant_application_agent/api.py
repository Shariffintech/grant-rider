from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, HttpUrl
import yaml

from google.cloud import storage

from .config import DEFAULT_PROFILE_PATH, SEARCH_KEYWORDS
from .discovery.search_grants import search_grants
from .models import FounderProfile
from .workflow import run_url, run_url_with_text

OUTPUT_DIR = Path(os.getenv("GRANT_RIDER_OUTPUT_DIR", "/tmp/grant-rider/outputs"))
STORAGE_BUCKET = os.getenv("GRANT_RIDER_STORAGE_BUCKET")
PROFILE_KEY = "profile/founder_profile.yaml"
REPORTS_PREFIX = "reports/"
DRAFTS_PREFIX = "drafts/"

app = FastAPI(title="Grant Rider API")


class RunRequest(BaseModel):
    url: HttpUrl
    pageText: str | None = None
    profile: FounderProfile | None = None


class DiscoverRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=10)


class DraftRequest(BaseModel):
    draftPath: str


class ArchiveRequest(BaseModel):
    reportPath: str


def storage_bucket():
    if not STORAGE_BUCKET:
        return None
    return storage.Client().bucket(STORAGE_BUCKET)


def gcs_uri(key: str) -> str:
    if not STORAGE_BUCKET:
        raise RuntimeError("GCS storage is not configured.")
    return f"gs://{STORAGE_BUCKET}/{key}"


def key_from_gcs_uri(uri: str, expected_prefix: str) -> str:
    expected = f"gs://{STORAGE_BUCKET}/{expected_prefix}"
    if not STORAGE_BUCKET or not uri.startswith(expected):
        raise HTTPException(status_code=400, detail=f"Path must be under {expected}.")
    return uri.removeprefix(f"gs://{STORAGE_BUCKET}/")


def read_json_blob(key: str) -> dict:
    bucket = storage_bucket()
    if not bucket:
        raise RuntimeError("GCS storage is not configured.")
    blob = bucket.blob(key)
    if not blob.exists():
        raise HTTPException(status_code=404, detail="Stored file was not found.")
    return json.loads(blob.download_as_text(encoding="utf-8"))


def write_json_blob(key: str, payload: dict) -> None:
    bucket = storage_bucket()
    if not bucket:
        raise RuntimeError("GCS storage is not configured.")
    bucket.blob(key).upload_from_string(
        json.dumps(payload, indent=2), content_type="application/json"
    )


def profile_path() -> Path:
    bucket = storage_bucket()
    if not bucket:
        return DEFAULT_PROFILE_PATH

    path = Path(tempfile.gettempdir()) / "grant-rider" / "profile" / "founder_profile.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    blob = bucket.blob(PROFILE_KEY)
    if blob.exists():
        path.write_text(blob.download_as_text(encoding="utf-8"), encoding="utf-8")
    else:
        source = DEFAULT_PROFILE_PATH.read_text(encoding="utf-8")
        path.write_text(source, encoding="utf-8")
        blob.upload_from_string(source, content_type="application/x-yaml")
    return path


def persist_result_artifacts(result):
    bucket = storage_bucket()
    if not bucket:
        return result

    report_path = Path(result.report_path)
    report_key = f"{REPORTS_PREFIX}{report_path.name}"
    bucket.blob(report_key).upload_from_filename(str(report_path), content_type="application/json")
    result.report_path = gcs_uri(report_key)

    if result.draft_path:
        draft_path = Path(result.draft_path)
        draft_key = f"{DRAFTS_PREFIX}{draft_path.name}"
        bucket.blob(draft_key).upload_from_filename(str(draft_path), content_type="text/markdown")
        result.draft_path = gcs_uri(draft_key)

    write_json_blob(report_key, result.model_dump(mode="json"))
    return result


def local_path_under(path_value: str, root: Path, label: str) -> Path:
    resolved = Path(path_value).resolve()
    allowed_root = root.resolve()

    try:
        resolved.relative_to(allowed_root)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{label} path is outside the allowed directory.")

    return resolved


def verify_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("GRANT_RIDER_API_KEY")
    if not expected:
        return

    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid API key.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run", dependencies=[Depends(verify_api_key)])
def run_grant(request: RunRequest) -> dict:
    request_profile_path = profile_path()
    temporary_profile_path: Path | None = None

    if request.profile is not None:
        temporary_profile_path = (
            Path(tempfile.mkdtemp(prefix="grant-rider-profile-")) / "founder_profile.yaml"
        )
        temporary_profile_path.write_text(
            yaml.safe_dump(request.profile.model_dump(mode="json"), sort_keys=False),
            encoding="utf-8",
        )
        request_profile_path = temporary_profile_path

    try:
        if request.pageText:
            result = run_url_with_text(
                str(request.url), request.pageText, request_profile_path, OUTPUT_DIR
            )
        else:
            result = run_url(str(request.url), request_profile_path, OUTPUT_DIR)
    finally:
        if temporary_profile_path is not None:
            temporary_profile_path.unlink(missing_ok=True)
            temporary_profile_path.parent.rmdir()

    result = persist_result_artifacts(result)
    return result.model_dump(mode="json")


@app.post("/discover", dependencies=[Depends(verify_api_key)])
def discover_grants(request: DiscoverRequest) -> dict:
    opportunities = search_grants(SEARCH_KEYWORDS, OUTPUT_DIR / "discovery" / "raw", request.limit)
    return {"opportunities": opportunities}


@app.get("/reports", dependencies=[Depends(verify_api_key)])
def list_reports() -> list[dict]:
    bucket = storage_bucket()
    if bucket:
        reports = []
        for blob in bucket.list_blobs(prefix=REPORTS_PREFIX):
            if not blob.name.endswith(".json"):
                continue
            reports.append((blob.updated, json.loads(blob.download_as_text(encoding="utf-8"))))
        return [report for _, report in sorted(reports, key=lambda item: item[0], reverse=True)]

    reports_dir = OUTPUT_DIR / "reports"
    try:
        reports = []
        for path in reports_dir.glob("*.json"):
            report = json.loads(path.read_text(encoding="utf-8"))
            reports.append((path.stat().st_mtime, report))
    except FileNotFoundError:
        return []

    return [report for _, report in sorted(reports, key=lambda item: item[0], reverse=True)]


@app.post("/draft", dependencies=[Depends(verify_api_key)])
def read_draft(request: DraftRequest) -> dict[str, str]:
    bucket = storage_bucket()
    if bucket:
        key = key_from_gcs_uri(request.draftPath, DRAFTS_PREFIX)
        blob = bucket.blob(key)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="Draft file was not found.")
        return {"content": blob.download_as_text(encoding="utf-8")}

    resolved = local_path_under(request.draftPath, OUTPUT_DIR / "drafts", "Draft")

    try:
        return {"content": resolved.read_text(encoding="utf-8")}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Draft file was not found.") from None


@app.post("/archive", dependencies=[Depends(verify_api_key)])
def archive_grant(request: ArchiveRequest) -> dict:
    bucket = storage_bucket()
    if bucket:
        report_key = key_from_gcs_uri(request.reportPath, REPORTS_PREFIX)
        report = read_json_blob(report_key)
    else:
        resolved = local_path_under(request.reportPath, OUTPUT_DIR / "reports", "Report")
        try:
            report = json.loads(resolved.read_text(encoding="utf-8"))
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Report file was not found.") from None

    report["grant"]["status"] = "archived"
    report["score"]["next_step"] = "archive_opportunity"
    disqualifiers = report["score"].setdefault("disqualifiers", [])
    if "Archived manually after founder review." not in disqualifiers:
        disqualifiers.append("Archived manually after founder review.")

    if bucket:
        write_json_blob(report_key, report)
    else:
        resolved.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


@app.get("/profile", dependencies=[Depends(verify_api_key)])
def read_profile() -> dict:
    raw = profile_path().read_text(encoding="utf-8")
    return FounderProfile.model_validate(yaml.safe_load(raw)).model_dump(mode="json")


@app.put("/profile", dependencies=[Depends(verify_api_key)])
def write_profile(profile: FounderProfile) -> dict:
    payload = yaml.safe_dump(profile.model_dump(mode="json"), sort_keys=False)
    path = profile_path()
    path.write_text(payload, encoding="utf-8")

    bucket = storage_bucket()
    if bucket:
        bucket.blob(PROFILE_KEY).upload_from_string(payload, content_type="application/x-yaml")

    return profile.model_dump(mode="json")
