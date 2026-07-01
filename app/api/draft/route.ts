import { NextResponse } from "next/server";
import { readDraft } from "../_lib/files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { draftPath } = await request.json();

  if (!draftPath || typeof draftPath !== "string") {
    return NextResponse.json({ error: "draftPath is required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ content: await readDraft(draftPath) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
