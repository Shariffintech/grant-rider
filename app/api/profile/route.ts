import { NextResponse } from "next/server";
import { readProfile, writeProfile } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readProfile());
}

export async function PUT(request: Request) {
  const profile = await request.json();
  return NextResponse.json(await writeProfile(profile));
}
