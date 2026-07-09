import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "dd_admin_session";

export function getAdminCookieName() {
  return cookieName;
}

export function isAdminPasswordValid(password: string) {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    return isLocalDevelopment() && password === "local-admin";
  }

  return password === configuredPassword;
}

export function createAdminSessionValue() {
  const secret = getSessionSecret();
  const payload = "admin";
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return `${payload}.${signature}`;
}

export function isAdminSessionValueValid(value?: string) {
  if (!value) {
    return false;
  }

  const [payload, signature] = value.split(".");

  if (payload !== "admin" || !signature) {
    return false;
  }

  const expected = createAdminSessionValue().split(".")[1];
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "local-dev-admin-secret"
  );
}

function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
}
