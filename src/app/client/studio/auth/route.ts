import {
  STUDIO_AUTH_COOKIE,
  createStudioSessionToken,
  getStudioCookieOptions,
  isStudioConfigured,
  verifyStudioPassphrase,
} from "@/lib/studioAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const redirectUrl = new URL("/client/studio", request.url);

  if (!isStudioConfigured()) {
    redirectUrl.searchParams.set("error", "config");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const formData = await request.formData();
  const passphrase = String(formData.get("passphrase") ?? "");

  if (!verifyStudioPassphrase(passphrase)) {
    redirectUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const { expiresAt, token } = createStudioSessionToken();
  const response = NextResponse.redirect(redirectUrl, { status: 303 });

  response.cookies.set(
    STUDIO_AUTH_COOKIE,
    token,
    getStudioCookieOptions(expiresAt)
  );

  return response;
}

