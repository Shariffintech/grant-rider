import { NextResponse } from "next/server";
import { DiscoveredOpportunity, listDiscoveredOpportunities, WorkflowResult } from "../_lib/files";
import { discoverWithFirecrawlApi } from "../_lib/discovery";
import { runGrantCommand } from "../_lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const discoveries = await listDiscoveredOpportunities();
  const archivedReports = await listArchivedReports();
  return NextResponse.json(filterArchivedOpportunities(discoveries, archivedReports));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const limit = normalizeLimit(body.limit);
  const backendUrl = process.env.GRANT_RIDER_API_URL;

  if (backendUrl && !process.env.FIRECRAWL_API_KEY) {
    return proxyToAdkBackend(backendUrl, limit);
  }

  try {
    const opportunities = await discoverLocally(limit);
    const archivedReports = await listArchivedReports();
    return NextResponse.json({ opportunities: filterArchivedOpportunities(opportunities, archivedReports) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown discovery failure.";
    return NextResponse.json({
      opportunities: [],
      error: friendlyDiscoveryError(message)
    });
  }
}

async function discoverLocally(limit: number) {
  if (process.env.FIRECRAWL_API_KEY) {
    return discoverWithFirecrawlApi(limit);
  }

  await runGrantCommand(["-m", "grant_application_agent.main", "discover", "--limit", String(limit)]);
  return listDiscoveredOpportunities();
}

async function listArchivedReports() {
  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/reports`, {
      cache: "no-store",
      headers: {
        ...(process.env.GRANT_RIDER_API_KEY
          ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
          : {})
      }
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as WorkflowResult[];
  }

  const { listReports } = await import("../_lib/files");
  return listReports();
}

function filterArchivedOpportunities(
  opportunities: DiscoveredOpportunity[],
  reports: WorkflowResult[]
) {
  const archivedUrls = new Set(
    reports
      .filter((report) => report.grant.status === "archived")
      .map((report) => normalizeUrl(report.grant.url))
      .filter(Boolean)
  );

  return opportunities.filter((opportunity) => !archivedUrls.has(normalizeUrl(opportunity.url)));
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

async function proxyToAdkBackend(backendUrl: string, limit: number) {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/discover`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ limit })
  });

  const payload = await response.json();
  if (Array.isArray(payload.opportunities)) {
    const archivedReports = await listArchivedReports();
    payload.opportunities = filterArchivedOpportunities(payload.opportunities, archivedReports);
  }
  return NextResponse.json(payload, { status: response.status });
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value ?? 5);
  if (Number.isNaN(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function friendlyDiscoveryError(message: string) {
  if (message.includes("FIRECRAWL_API_KEY")) {
    return "Find Grants needs FIRECRAWL_API_KEY in Vercel Settings > Environment Variables.";
  }

  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    return "Firecrawl rejected the API key. Please check FIRECRAWL_API_KEY in Vercel.";
  }

  if (message.includes("404")) {
    return "The grant search service URL was not found. Please redeploy the latest version of Granted.";
  }

  return `Find Grants could not search right now. ${message}`;
}
