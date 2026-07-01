from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl


class FounderProfile(BaseModel):
    name: str
    founder_name: str
    industry: str
    entity_type: str = "for-profit"
    focus_areas: list[str]
    business_stage: str
    eligible_locations: list[str]
    target_customers: list[str]
    funding_needs: list[str]
    excluded_grants: list[str] = Field(default_factory=list)
    minimum_score_to_draft: int = Field(default=80, ge=0, le=100)


class GrantStatus(StrEnum):
    DISCOVERED = "discovered"
    DRAFT_CREATED = "draft_created"
    NEEDS_REVIEW = "needs_review"
    APPROVED_FOR_SUBMISSION = "approved_for_submission"
    SUBMITTED = "submitted"
    ARCHIVED = "archived"


class GrantDetails(BaseModel):
    title: str
    url: HttpUrl
    source: str = "manual_url"
    funder: str | None = None
    deadline: date | None = None
    funding_amount: int | None = None
    eligibility_summary: str | None = None
    eligible_entity_types: list[str] = Field(default_factory=list)
    eligible_locations: list[str] = Field(default_factory=list)
    eligible_stages: list[str] = Field(default_factory=list)
    focus_areas: list[str] = Field(default_factory=list)
    allowed_uses: list[str] = Field(default_factory=list)
    required_documents: list[str] = Field(default_factory=list)
    application_questions: list[str] = Field(default_factory=list)
    submission_method: str | None = None
    geographic_restrictions: str | None = None
    business_stage_restrictions: str | None = None
    nonprofit_for_profit_requirements: str | None = None
    estimated_effort: str = "unknown"
    extraction_notes: list[str] = Field(default_factory=list)
    status: GrantStatus = GrantStatus.DISCOVERED


class ScoreBreakdown(BaseModel):
    mission_fit: int = Field(ge=0, le=25)
    eligibility_fit: int = Field(ge=0, le=25)
    funding_use_fit: int = Field(ge=0, le=20)
    geographic_fit: int = Field(ge=0, le=10)
    stage_fit: int = Field(ge=0, le=10)
    application_effort: int = Field(ge=0, le=10)


class GrantScore(BaseModel):
    total: int = Field(ge=0, le=100)
    breakdown: ScoreBreakdown
    reasons: list[str]
    disqualifiers: list[str] = Field(default_factory=list)
    next_step: str


class WorkflowResult(BaseModel):
    grant: GrantDetails
    score: GrantScore
    draft_path: str | None = None
    report_path: str

