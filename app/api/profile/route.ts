import { NextResponse } from "next/server";
import { readProfile, writeProfile } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, "GET");
  }

  return NextResponse.json(await readProfile());
}

export async function PUT(request: Request) {
  const profile = await request.json();
  const backendUrl = process.env.GRANT_RIDER_API_URL;
  if (backendUrl) {
    return proxyToAdkBackend(backendUrl, "PUT", profile);
  }

  return NextResponse.json(await writeProfile(profile));
}

async function proxyToAdkBackend(backendUrl: string, method: "GET" | "PUT", profile?: unknown) {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/profile`, {
    method,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(process.env.GRANT_RIDER_API_KEY
        ? { authorization: `Bearer ${process.env.GRANT_RIDER_API_KEY}` }
        : {})
    },
    ...(method === "PUT" ? { body: JSON.stringify(profile) } : {})
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
