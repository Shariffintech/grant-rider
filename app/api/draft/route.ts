import { NextResponse } from "next/server";
import { readDraft } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { draftPath } = await request.json();

  if (!draftPath || typeof draftPath !== "string") {
    return NextResponse.json({ error: "draftPath is required." }, { status: 400 });
  }

  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, draftPath);
  }

  try {
    return NextResponse.json({ content: await readDraft(draftPath) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

async function proxyToAdkBackend(backendUrl: string, draftPath: string) {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/draft`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ draftPath })
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
