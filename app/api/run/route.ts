import { NextResponse } from "next/server";
import { scrapeWithFirecrawlApi } from "../_lib/discovery";
import { runGrantCommand } from "../_lib/workflow";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "A grant URL is required." }, { status: 400 });
  }

  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, url);
  }

  try {
    const stdout = await runLocalWorkflow(url);

    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function proxyToAdkBackend(backendUrl: string, url: string) {
  let pageText: string | undefined;
  if (process.env.FIRECRAWL_API_KEY) {
    pageText = await scrapeWithFirecrawlApi(url).catch(() => undefined);
  }

  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/run`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ url, pageText })
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

async function runLocalWorkflow(url: string) {
  return runGrantCommand(["-m", "grant_application_agent.main", "run", "--url", url]);
}
