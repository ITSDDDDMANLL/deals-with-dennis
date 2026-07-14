import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../lib/admin-auth";
import { createSupabaseAdmin } from "../../../../lib/supabase/admin";

const maxImagesPerRequest = 20;
const maxImageSizeBytes = 12_000_000;
const bucketName = process.env.SUPABASE_VEHICLE_IMAGE_BUCKET ?? "vehicle-images";

type ImageUploadRequestFile = {
  contentType?: string;
  fileName?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return createImageUploadTargets(request);
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
    (file) => !isAllowedImageFile(file) || file.size > maxImageSizeBytes,
  );

  if (invalidFile) {
    return NextResponse.json(
      { error: "Images must be image files and 12 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    const imageUrls = await Promise.all(files.map(fileToDataUrl));
    return NextResponse.json({ imageUrls, mode: "local" });
  }

  const bucketError = await ensureImageBucket(supabase);

  if (bucketError) {
    return NextResponse.json(
      { error: "Image upload failed.", details: bucketError },
      { status: 500 },
    );
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
        {
          error: `Unable to upload ${file.name}.`,
          details: error.message,
        },
        { status: 500 },
      );
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    imageUrls.push(data.publicUrl);
  }

  return NextResponse.json({ imageUrls, mode: "supabase" });
}

async function createImageUploadTargets(request: Request) {
  const body = await request.json().catch(() => null);
  const vehicleId = String(body?.vehicleId ?? "vehicle");
  const files: ImageUploadRequestFile[] = Array.isArray(body?.files)
    ? body.files.slice(0, maxImagesPerRequest)
    : [];

  if (!files.length) {
    return NextResponse.json({ uploads: [] });
  }

  const invalidFile = files.find((file) => {
    const fileName = String(file?.fileName ?? "");
    const contentType = String(file?.contentType ?? getContentType(fileName));
    const fileSize = Number(file?.fileSize ?? 0);

    return (
      !isAllowedImage(fileName, contentType) ||
      !fileSize ||
      fileSize > maxImageSizeBytes
    );
  });

  if (invalidFile) {
    return NextResponse.json(
      { error: "Images must be image files and 12 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Image upload failed.",
        details: "Supabase is required for direct image uploads.",
      },
      { status: 500 },
    );
  }

  const bucketError = await ensureImageBucket(supabase);

  if (bucketError) {
    return NextResponse.json(
      { error: "Image upload failed.", details: bucketError },
      { status: 500 },
    );
  }

  const uploads = [];

  for (const file of files) {
    const fileName = String(file.fileName);
    const contentType = String(file.contentType || getContentType(fileName));
    const extension = getExtension({ name: fileName, type: contentType });
    const path = `${sanitizePathPart(vehicleId)}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        {
          error: `Unable to prepare upload for ${fileName}.`,
          details: error?.message ?? "Supabase did not return a signed URL.",
        },
        { status: 500 },
      );
    }

    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    uploads.push({
      contentType,
      fileName,
      imageUrl: publicData.publicUrl,
      path,
      signedUrl: data.signedUrl,
    });
  }

  return NextResponse.json({ mode: "supabase", uploads });
}

async function ensureImageBucket(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
) {
  const bucketOptions = {
    allowedMimeTypes: [
      "image/gif",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    fileSizeLimit: maxImageSizeBytes,
    public: true,
  };
  const { error } = await supabase.storage.createBucket(bucketName, bucketOptions);

  if (error?.message.toLowerCase().includes("already exists")) {
    const { error: updateError } = await supabase.storage.updateBucket(
      bucketName,
      bucketOptions,
    );

    if (updateError) {
      return `Unable to update image bucket "${bucketName}": ${updateError.message}`;
    }

    return "";
  }

  if (error) {
    return `Unable to prepare image bucket "${bucketName}": ${error.message}`;
  }

  return "";
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

  return file.type.split("/")[1] || "jpg";
}

function sanitizePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

function isAllowedImageFile(file: File) {
  return isAllowedImage(file.name, file.type);
}

function isAllowedImage(fileName: string, contentType: string) {
  return (
    contentType.startsWith("image/") ||
    /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(fileName)
  );
}

function getContentType(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  if (lowerName.endsWith(".heic")) return "image/heic";
  if (lowerName.endsWith(".heif")) return "image/heif";

  return "image/jpeg";
}
