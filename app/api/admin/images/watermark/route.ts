import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../../lib/admin-auth";
import { getSiteContent } from "../../../../../lib/site-content";
import {
  type WatermarkPhotoInput,
  watermarkVehiclePhotos,
} from "../../../../../lib/image-watermark";

const maxPhotosPerBatch = 40;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const vehicleId = String(body?.vehicleId ?? "").trim();
  const rawPhotos: unknown[] = Array.isArray(body?.photos)
    ? body.photos.slice(0, maxPhotosPerBatch)
    : [];
  const photos: WatermarkPhotoInput[] = rawPhotos
    .map((photo) => {
      const currentPhoto = photo as Partial<WatermarkPhotoInput>;

      return {
        id: String(currentPhoto.id ?? ""),
        originalUrl: String(currentPhoto.originalUrl ?? "").trim(),
      };
    })
    .filter((photo) => Boolean(photo.originalUrl));

  if (!vehicleId) {
    return NextResponse.json(
      { error: "Vehicle id is required for watermarking." },
      { status: 400 },
    );
  }

  if (!photos.length) {
    return NextResponse.json(
      { error: "At least one original photo is required." },
      { status: 400 },
    );
  }

  try {
    const siteContent = await getSiteContent();
    const results = await watermarkVehiclePhotos({
      photos,
      siteContent,
      vehicleId,
    });
    const failed = results.filter((result) => result.error);

    return NextResponse.json({
      failed: failed.length,
      ok: true,
      results,
      succeeded: results.length - failed.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Watermark processing failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}
