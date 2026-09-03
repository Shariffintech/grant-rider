import { NextResponse } from "next/server";
import { archiveReport } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { reportPath } = await request.json();

  if (!reportPath || typeof reportPath !== "string") {
    return NextResponse.json({ error: "reportPath is required." }, { status: 400 });
  }

  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, reportPath);
  }

  try {
    return NextResponse.json(await archiveReport(reportPath));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

async function proxyToAdkBackend(backendUrl: string, reportPath: string) {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/archive`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ reportPath })
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
