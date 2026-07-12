import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSessionValueValid } from "../../../../lib/admin-auth";
import { getSiteContent, saveSiteContent } from "../../../../lib/site-content";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const content = await getSiteContent();

  return NextResponse.json({ content });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body?.content) {
    return NextResponse.json(
      { error: "Expected content payload." },
      { status: 400 },
    );
  }

  const result = await saveSiteContent(body.content);

  return NextResponse.json({ ok: true, ...result });
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}
