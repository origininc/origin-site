import {
  STUDIO_AUTH_COOKIE,
  getStudioExpiredCookieOptions,
} from "@/lib/studioAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const redirectUrl = new URL("/client/studio", request.url);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });

  response.cookies.set(
    STUDIO_AUTH_COOKIE,
    "",
    getStudioExpiredCookieOptions()
  );

  return response;
}

