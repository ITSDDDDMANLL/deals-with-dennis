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
    measureBitmapText(textLineOne, fontSize),
    measureBitmapText(textLineTwo, smallFontSize),
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
  const firstTop = verticalPadding;
  const secondTop = firstTop + fontSize + lineGap;
  const firstText = renderBitmapText({
    fontSize,
    text: textLineOne,
    x: Math.round((width - measureBitmapText(textLineOne, fontSize)) / 2),
    y: firstTop,
  });
  const secondText = textLineTwo
    ? renderBitmapText({
        fill: "#dbeee6",
        fontSize: smallFontSize,
        text: textLineTwo,
        x: Math.round((width - measureBitmapText(textLineTwo, smallFontSize)) / 2),
        y: secondTop,
      })
    : "";

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${Math.round(height * 0.24)}" fill="#051f19" opacity="0.76"/>
      ${firstText}
      ${secondText}
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

function measureBitmapText(value: string, fontSize: number) {
  const scale = getBitmapScale(fontSize);
  const gap = scale;

  return normalizeWatermarkText(value)
    .split("")
    .reduce((width, char, index) => {
      const glyph = bitmapGlyphs[char] ?? bitmapGlyphs[" "];
      const glyphWidth = glyph[0]?.length ?? 3;

      return width + glyphWidth * scale + (index ? gap : 0);
    }, 0);
}

function renderBitmapText({
  fill = "#ffffff",
  fontSize,
  text,
  x,
  y,
}: {
  fill?: string;
  fontSize: number;
  text: string;
  x: number;
  y: number;
}) {
  const normalized = normalizeWatermarkText(text);
  const scale = getBitmapScale(fontSize);
  const gap = scale;
  let cursorX = x;
  const parts: string[] = [];

  for (const char of normalized) {
    const glyph = bitmapGlyphs[char] ?? bitmapGlyphs[" "];
    const glyphWidth = glyph[0]?.length ?? 3;

    glyph.forEach((row, rowIndex) => {
      row.split("").forEach((cell, columnIndex) => {
        if (cell !== "1") {
          return;
        }

        parts.push(
          `<rect x="${cursorX + columnIndex * scale}" y="${y + rowIndex * scale}" width="${scale}" height="${scale}" fill="${fill}" rx="${Math.max(1, Math.round(scale * 0.16))}"/>`,
        );
      });
    });
    cursorX += glyphWidth * scale + gap;
  }

  return parts.join("");
}

function normalizeWatermarkText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9| .,#:+()/@-]/g, "");
}

function getBitmapScale(fontSize: number) {
  return Math.max(2, Math.round(fontSize / 7));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const bitmapGlyphs: Record<string, string[]> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "0", "0", "1", "1"],
  ":": ["0", "1", "0", "0", "0", "1", "0"],
  "-": ["000", "000", "000", "111", "000", "000", "000"],
  "|": ["1", "1", "1", "1", "1", "1", "1"],
  "/": ["00001", "00010", "00100", "00100", "01000", "10000", "00000"],
  "(": ["01", "10", "10", "10", "10", "10", "01"],
  ")": ["10", "01", "01", "01", "01", "01", "10"],
  "+": ["000", "010", "010", "111", "010", "010", "000"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "00000"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01111", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "11110"],
};
