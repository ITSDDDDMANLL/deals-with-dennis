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
const defaultWatermarkPhone = "236-878-4987";

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
        phone: process.env.WATERMARK_PHONE ?? defaultWatermarkPhone,
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
  const barHeight = clamp(Math.round(height * 0.115), 86, 190);
  const primaryFontSize = clamp(Math.round(shortestSide * 0.045), 28, 70);
  const secondaryFontSize = clamp(Math.round(primaryFontSize * 0.58), 18, 42);
  const lineGap = Math.round(primaryFontSize * 0.16);
  const topLineOne = `${branding.name} | ${branding.dealerName}`;
  const topLineTwo = "Deals with Dennis";
  const bottomLineOne = [branding.phone, branding.website].filter(Boolean).join(" | ");
  const bottomLineTwo = "Cam Clark Ford Richmond | Dealer #10904";
  const svg = createWatermarkSvg({
    barHeight,
    bottomLineOne,
    bottomLineTwo,
    height,
    lineGap,
    primaryFontSize,
    secondaryFontSize,
    topLineOne,
    topLineTwo,
    width,
  });

  return base
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ mozjpeg: true, quality: 88 })
    .toBuffer();
}

function createWatermarkSvg({
  barHeight,
  bottomLineOne,
  bottomLineTwo,
  height,
  lineGap,
  primaryFontSize,
  secondaryFontSize,
  topLineOne,
  topLineTwo,
  width,
}: {
  barHeight: number;
  bottomLineOne: string;
  bottomLineTwo: string;
  height: number;
  lineGap: number;
  primaryFontSize: number;
  secondaryFontSize: number;
  topLineOne: string;
  topLineTwo: string;
  width: number;
}) {
  const textMaxWidth = Math.max(1, width - 48);
  const fittedPrimaryFontSize = Math.min(
    fitBitmapFontSize(topLineOne, primaryFontSize, textMaxWidth),
    fitBitmapFontSize(bottomLineOne, primaryFontSize, textMaxWidth),
  );
  const fittedSecondaryFontSize = Math.min(
    fitBitmapFontSize(topLineTwo, secondaryFontSize, textMaxWidth),
    fitBitmapFontSize(bottomLineTwo, secondaryFontSize, textMaxWidth),
  );
  const topPrimary = centerBitmapLine(topLineOne, fittedPrimaryFontSize, width);
  const topSecondary = centerBitmapLine(topLineTwo, fittedSecondaryFontSize, width);
  const bottomPrimary = centerBitmapLine(bottomLineOne, fittedPrimaryFontSize, width);
  const bottomSecondary = centerBitmapLine(
    bottomLineTwo,
    fittedSecondaryFontSize,
    width,
  );
  const topContentHeight =
    getBitmapTextHeight(fittedPrimaryFontSize) +
    lineGap +
    getBitmapTextHeight(fittedSecondaryFontSize);
  const topStart = Math.max(8, Math.round((barHeight - topContentHeight) / 2));
  const bottomContentHeight =
    getBitmapTextHeight(fittedPrimaryFontSize) +
    lineGap +
    getBitmapTextHeight(fittedSecondaryFontSize);
  const bottomStart =
    height - barHeight + Math.max(8, Math.round((barHeight - bottomContentHeight) / 2));
  const topText = [
    renderBitmapText({
      fontSize: fittedPrimaryFontSize,
      text: topLineOne,
      x: topPrimary.x,
      y: topStart,
    }),
    renderBitmapText({
      fill: "#dbeee6",
      fontSize: fittedSecondaryFontSize,
      text: topLineTwo,
      x: topSecondary.x,
      y: topStart + getBitmapTextHeight(fittedPrimaryFontSize) + lineGap,
    }),
  ].join("");
  const bottomText = [
    renderBitmapText({
      fontSize: fittedPrimaryFontSize,
      text: bottomLineOne,
      x: bottomPrimary.x,
      y: bottomStart,
    }),
    renderBitmapText({
      fill: "#dbeee6",
      fontSize: fittedSecondaryFontSize,
      text: bottomLineTwo,
      x: bottomSecondary.x,
      y: bottomStart + getBitmapTextHeight(fittedPrimaryFontSize) + lineGap,
    }),
  ].join("");

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#051f19" opacity="0.86"/>
      <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="#051f19" opacity="0.88"/>
      ${topText}
      ${bottomText}
    </svg>
  `;
}

function centerBitmapLine(text: string, fontSize: number, containerWidth: number) {
  const textWidth = measureBitmapText(text, fontSize);

  return {
    textWidth,
    x: Math.max(12, Math.round((containerWidth - textWidth) / 2)),
  };
}

function getBitmapTextHeight(fontSize: number) {
  return getBitmapScale(fontSize) * 7;
}

function fitBitmapFontSize(text: string, preferredFontSize: number, maxWidth: number) {
  let fontSize = preferredFontSize;

  while (fontSize > 10 && measureBitmapText(text, fontSize) > maxWidth) {
    fontSize -= 1;
  }

  return fontSize;
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
