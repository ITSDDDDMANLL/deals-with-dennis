import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSessionValueValid } from "../../../../lib/admin-auth";
import { getSiteVideos, saveSiteVideos } from "../../../../lib/video-store";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const videos = await getSiteVideos([], { includeHidden: true });

  return NextResponse.json({ videos });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.videos)) {
    return NextResponse.json(
      { error: "Expected videos array." },
      { status: 400 },
    );
  }

  const result = await saveSiteVideos(body.videos);

  return NextResponse.json({ ok: true, ...result });
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}
