import { NextResponse } from "next/server";
import { listDiscoveredOpportunities } from "../_lib/files";
import { discoverWithFirecrawlApi } from "../_lib/discovery";
import { runGrantCommand } from "../_lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await listDiscoveredOpportunities());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const limit = normalizeLimit(body.limit);
  const backendUrl = process.env.GRANT_RIDER_API_URL;

  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, limit);
  }

  try {
    const opportunities = await discoverLocally(limit);
    return NextResponse.json({ opportunities });
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

async function proxyToAdkBackend(backendUrl: string, limit: number) {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/discover`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ limit })
  });

  const payload = await response.json();
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
