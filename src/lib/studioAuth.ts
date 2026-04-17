import { createHmac, timingSafeEqual } from "node:crypto";

export const STUDIO_AUTH_COOKIE = "origin-studio-session";

const STUDIO_SESSION_SCOPE = "studio";
const STUDIO_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const getStudioConfig = () => {
  const passphrase = process.env.ORIGIN_STUDIO_PASSPHRASE?.trim();
  const secret = process.env.ORIGIN_STUDIO_COOKIE_SECRET?.trim();

  if (!passphrase || !secret) {
    return null;
  }

  return { passphrase, secret };
};

const signValue = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const getSafeBuffer = (value: string) => Buffer.from(value, "utf8");

export const isStudioConfigured = () => getStudioConfig() !== null;

export const verifyStudioPassphrase = (submitted: string) => {
  const config = getStudioConfig();

  if (!config) {
    return false;
  }

  const expected = getSafeBuffer(config.passphrase);
  const received = getSafeBuffer(submitted.trim());

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
};

export const createStudioSessionToken = (now = Date.now()) => {
  const config = getStudioConfig();

  if (!config) {
    throw new Error("Studio auth is not configured.");
  }

  const expiresAt = now + STUDIO_SESSION_TTL_SECONDS * 1000;
  const payload = `${STUDIO_SESSION_SCOPE}.${expiresAt}`;
  const signature = signValue(payload, config.secret);

  return {
    expiresAt,
    token: `${payload}.${signature}`,
  };
};

export const verifyStudioSessionToken = (
  token: string | null | undefined,
  now = Date.now()
) => {
  const config = getStudioConfig();

  if (!config || !token) {
    return false;
  }

  const lastSeparator = token.lastIndexOf(".");
  if (lastSeparator <= 0 || lastSeparator === token.length - 1) {
    return false;
  }

  const payload = token.slice(0, lastSeparator);
  const signature = token.slice(lastSeparator + 1);
  const expectedSignature = signValue(payload, config.secret);

  const signatureBuffer = getSafeBuffer(signature);
  const expectedBuffer = getSafeBuffer(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false;
  }

  const [scope, expiresRaw] = payload.split(".");
  if (scope !== STUDIO_SESSION_SCOPE) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresRaw ?? "", 10);

  return Number.isFinite(expiresAt) && expiresAt > now;
};

export const getStudioCookieOptions = (expiresAt: number) => ({
  expires: new Date(expiresAt),
  httpOnly: true,
  path: "/client/studio",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});

export const getStudioExpiredCookieOptions = () => ({
  expires: new Date(0),
  httpOnly: true,
  maxAge: 0,
  path: "/client/studio",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});

