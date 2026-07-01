import { NextResponse } from "next/server";
import { listReports } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listReports());
}
