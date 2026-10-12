import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.GRANT_RIDER_PROFILE_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Profile access is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  const expected = "Basic " + btoa("abena:" + password);

  if (authorization === expected) return NextResponse.next();

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": "Basic realm=\"Abena DMS profile\", charset=\"UTF-8\"" }
  });
}

export const config = { matcher: ["/:path*"] };
