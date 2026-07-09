import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAdminSessionValue,
  getAdminCookieName,
  isAdminPasswordValid,
} from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(getAdminCookieName(), createAdminSessionValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(getAdminCookieName());

  return NextResponse.json({ ok: true });
}
