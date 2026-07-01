import { promises as fs } from "fs";
import path from "path";
import { parse, stringify } from "yaml";

export type FounderProfile = {
  name: string;
  founder_name: string;
  industry: string;
  entity_type: string;
  focus_areas: string[];
  business_stage: string;
  eligible_locations: string[];
  target_customers: string[];
  funding_needs: string[];
  excluded_grants: string[];
  minimum_score_to_draft: number;
};

export type WorkflowResult = {
  grant: {
    title: string;
    url: string;
    source: string;
    funder?: string | null;
    deadline?: string | null;
    funding_amount?: number | null;
    eligibility_summary?: string | null;
    eligible_entity_types: string[];
    eligible_locations: string[];
    eligible_stages: string[];
    focus_areas: string[];
    allowed_uses: string[];
    required_documents: string[];
    application_questions: string[];
    submission_method?: string | null;
    estimated_effort: string;
    extraction_notes: string[];
    status: string;
  };
  score: {
    total: number;
    breakdown: Record<string, number>;
    reasons: string[];
    disqualifiers: string[];
    next_step: string;
  };
  draft_path?: string | null;
  report_path: string;
};

export type DiscoveredOpportunity = {
  title: string;
  url: string;
  source: string;
  eligibility_summary?: string | null;
  status: string;
  search_keyword?: string | null;
};

export const rootDir = process.cwd();
export const profilePath = path.join(rootDir, "founder_profile.yaml");
export const reportsDir = path.join(rootDir, "outputs", "reports");
export const draftsDir = path.join(rootDir, "outputs", "drafts");
export const discoveryPath = path.join(rootDir, "outputs", "discovery", "opportunities.json");

export async function readProfile(): Promise<FounderProfile> {
  const raw = await fs.readFile(profilePath, "utf8");
  return parse(raw) as FounderProfile;
}

export async function writeProfile(profile: FounderProfile) {
  const normalized: FounderProfile = {
    ...profile,
    focus_areas: cleanList(profile.focus_areas),
    eligible_locations: cleanList(profile.eligible_locations),
    target_customers: cleanList(profile.target_customers),
    funding_needs: cleanList(profile.funding_needs),
    excluded_grants: cleanList(profile.excluded_grants),
    minimum_score_to_draft: clamp(Number(profile.minimum_score_to_draft), 0, 100)
  };

  await fs.writeFile(profilePath, stringify(normalized), "utf8");
  return normalized;
}

export async function listReports(): Promise<WorkflowResult[]> {
  try {
    const files = await fs.readdir(reportsDir);
    const reports = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const fullPath = path.join(reportsDir, file);
          const raw = await fs.readFile(fullPath, "utf8");
          const stat = await fs.stat(fullPath);
          return { ...JSON.parse(raw), _mtime: stat.mtimeMs } as WorkflowResult & { _mtime: number };
        })
    );

    return reports.sort((a, b) => b._mtime - a._mtime).map(({ _mtime, ...report }) => report);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function listDiscoveredOpportunities(): Promise<DiscoveredOpportunity[]> {
  try {
    const raw = await fs.readFile(discoveryPath, "utf8");
    return JSON.parse(raw) as DiscoveredOpportunity[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readDraft(draftPath: string) {
  const resolved = path.resolve(draftPath);
  const allowedRoot = path.resolve(draftsDir);

  if (!resolved.startsWith(allowedRoot)) {
    throw new Error("Draft path is outside the outputs/drafts directory.");
  }

  return fs.readFile(resolved, "utf8");
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
