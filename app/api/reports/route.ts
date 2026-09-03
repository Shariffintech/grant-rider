import { NextResponse } from "next/server";
import { listReports } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(await listReports());
}
