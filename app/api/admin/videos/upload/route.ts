import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../../lib/admin-auth";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";

const maxVideoSizeBytes = 250_000_000;
const bucketName = process.env.SUPABASE_SITE_VIDEO_BUCKET ?? "site-videos";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return createUploadTarget(request);
  }

  const formData = await request.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Video file is required." }, { status: 400 });
  }

  if (!isAllowedVideo(file.name, file.type) || file.size > maxVideoSizeBytes) {
    return NextResponse.json(
      { error: "Video must be a video file and 250 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    const videoUrl = await fileToDataUrl(file);
    return NextResponse.json({ videoUrl, mode: "local" });
  }

  const extension = getExtension(file);
  const path = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucketName).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      { error: `Unable to upload ${file.name}.` },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);

  return NextResponse.json({ videoUrl: data.publicUrl, mode: "supabase" });
}

async function createUploadTarget(request: Request) {
  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName ?? "video.mov");
  const contentType = String(body?.contentType ?? getContentType(fileName));
  const fileSize = Number(body?.fileSize ?? 0);

  if (!isAllowedVideo(fileName, contentType) || fileSize > maxVideoSizeBytes) {
    return NextResponse.json(
      { error: "Video must be a video file and 250 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is required for video uploads." },
      { status: 500 },
    );
  }

  const extension = getExtension({ name: fileName, type: contentType });
  const path = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Unable to prepare video upload." },
      { status: 500 },
    );
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(path).data
    .publicUrl;

  return NextResponse.json({
    contentType,
    mode: "supabase",
    path,
    signedUrl: data.signedUrl,
    videoUrl: publicUrl,
  });
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}

async function fileToDataUrl(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function getExtension(file: Pick<File, "name" | "type">) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  return file.type.split("/")[1] || "mp4";
}

function getContentType(fileName: string) {
  return fileName.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

function isAllowedVideo(fileName: string, contentType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    contentType.startsWith("video/") ||
    lowerName.endsWith(".mov") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".m4v") ||
    lowerName.endsWith(".webm")
  );
}
