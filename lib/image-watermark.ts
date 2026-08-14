import crypto from "node:crypto";
import sharp from "sharp";
import { defaultSiteContent, type SiteContent } from "./site-content";
import { createSupabaseAdmin } from "./supabase/admin";

export type WatermarkPhotoInput = {
  id?: string;
  originalUrl: string;
};

export type WatermarkPhotoResult = WatermarkPhotoInput & {
  error?: string;
  watermarkedUrl?: string;
};

const bucketName = process.env.SUPABASE_VEHICLE_IMAGE_BUCKET ?? "vehicle-images";

export async function watermarkVehiclePhotos({
  photos,
  siteContent = defaultSiteContent,
  vehicleId,
}: {
  photos: WatermarkPhotoInput[];
  siteContent?: SiteContent;
  vehicleId: string;
}) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase service role is required for watermarking.");
  }

  const results: WatermarkPhotoResult[] = [];

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];

    try {
      const source = await downloadImage(photo.originalUrl);
      const watermarked = await applyDealsWithDennisWatermark(source, {
        dealerName: siteContent.dealerName,
        name: siteContent.profileName || "Dennis Liu",
        phone: process.env.WATERMARK_PHONE ?? "",
        website:
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ??
          "dealswithdennis.com",
      });
      const path = getWatermarkedPath(vehicleId, photo.originalUrl, index);
      const { error } = await supabase.storage.from(bucketName).upload(path, watermarked, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);

      results.push({
        ...photo,
        watermarkedUrl: data.publicUrl,
      });
    } catch (error) {
      results.push({
        ...photo,
        error: getErrorMessage(error),
      });
    }
  }

  return results;
}

async function downloadImage(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to download original image. HTTP ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function applyDealsWithDennisWatermark(
  input: Buffer,
  branding: {
    dealerName: string;
    name: string;
    phone: string;
    website: string;
  },
) {
  const base = sharp(input, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 1600;
  const height = metadata.height ?? 1200;
  const shortestSide = Math.max(1, Math.min(width, height));
  const fontSize = clamp(Math.round(shortestSide * 0.028), 18, 42);
  const smallFontSize = clamp(Math.round(fontSize * 0.72), 14, 30);
  const horizontalPadding = Math.round(fontSize * 0.9);
  const verticalPadding = Math.round(fontSize * 0.65);
  const margin = clamp(Math.round(shortestSide * 0.035), 18, 52);
  const lineGap = Math.round(fontSize * 0.35);
  const textLineOne = `${branding.name} | ${branding.dealerName}`;
  const textLineTwo = [branding.phone, branding.website].filter(Boolean).join(" | ");
  const textWidth = Math.max(
    estimateTextWidth(textLineOne, fontSize),
    estimateTextWidth(textLineTwo, smallFontSize),
  );
  const overlayWidth = Math.min(
    width - margin * 2,
    Math.max(Math.round(width * 0.34), textWidth + horizontalPadding * 2),
  );
  const overlayHeight =
    verticalPadding * 2 + fontSize + (textLineTwo ? lineGap + smallFontSize : 0);
  const left = Math.max(margin, width - overlayWidth - margin);
  const top = Math.max(margin, height - overlayHeight - margin);
  const svg = createWatermarkSvg({
    fontSize,
    height: overlayHeight,
    lineGap,
    smallFontSize,
    textLineOne,
    textLineTwo,
    verticalPadding,
    width: overlayWidth,
  });

  return base
    .composite([{ input: Buffer.from(svg), left, top }])
    .jpeg({ mozjpeg: true, quality: 88 })
    .toBuffer();
}

function createWatermarkSvg({
  fontSize,
  height,
  lineGap,
  smallFontSize,
  textLineOne,
  textLineTwo,
  verticalPadding,
  width,
}: {
  fontSize: number;
  height: number;
  lineGap: number;
  smallFontSize: number;
  textLineOne: string;
  textLineTwo: string;
  verticalPadding: number;
  width: number;
}) {
  const firstBaseline = verticalPadding + fontSize * 0.86;
  const secondBaseline = firstBaseline + lineGap + smallFontSize;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${Math.round(height * 0.24)}" fill="#051f19" opacity="0.76"/>
      <text x="${Math.round(width / 2)}" y="${firstBaseline}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800">${escapeSvgText(textLineOne)}</text>
      ${
        textLineTwo
          ? `<text x="${Math.round(width / 2)}" y="${secondBaseline}" text-anchor="middle" fill="#dbeee6" font-family="Arial, Helvetica, sans-serif" font-size="${smallFontSize}" font-weight="700">${escapeSvgText(textLineTwo)}</text>`
          : ""
      }
    </svg>
  `;
}

function getWatermarkedPath(vehicleId: string, originalUrl: string, index: number) {
  const hash = crypto.createHash("sha256").update(originalUrl).digest("hex").slice(0, 18);

  return `${sanitizePathPart(vehicleId)}/watermarked/${index + 1}-${hash}.jpg`;
}

function sanitizePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "vehicle";
}

function estimateTextWidth(value: string, fontSize: number) {
  return Math.round(value.length * fontSize * 0.58);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
