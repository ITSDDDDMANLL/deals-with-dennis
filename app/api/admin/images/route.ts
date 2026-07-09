import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../lib/admin-auth";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const maxImagesPerRequest = 20;
const maxImageSizeBytes = 2_500_000;
const bucketName = process.env.SUPABASE_VEHICLE_IMAGE_BUCKET ?? "vehicle-images";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File)
    .slice(0, maxImagesPerRequest);
  const vehicleId = String(formData.get("vehicleId") ?? "vehicle");

  if (!files.length) {
    return NextResponse.json({ imageUrls: [] });
  }

  const invalidFile = files.find(
    (file) => !file.type.startsWith("image/") || file.size > maxImageSizeBytes,
  );

  if (invalidFile) {
    return NextResponse.json(
      { error: "Images must be image files and 2.5 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    const imageUrls = await Promise.all(files.map(fileToDataUrl));
    return NextResponse.json({ imageUrls, mode: "local" });
  }

  const imageUrls: string[] = [];

  for (const file of files) {
    const extension = getExtension(file);
    const path = `${sanitizePathPart(vehicleId)}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bytes = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(path, bytes, {
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
    imageUrls.push(data.publicUrl);
  }

  return NextResponse.json({ imageUrls, mode: "supabase" });
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

function getExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  return file.type.split("/")[1] || "jpg";
}

function sanitizePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}
