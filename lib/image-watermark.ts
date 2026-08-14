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
const watermarkRenderVersion = "2026-08-14-svg-full-bars-v3";

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
  const branding = {
    dealerName: siteContent.dealerName,
    name: siteContent.profileName || "Dennis Liu",
    phone: process.env.WATERMARK_PHONE ?? defaultWatermarkPhone,
    website:
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ??
      "dealswithdennis.com",
  };
  const watermarkVersion = getWatermarkVersion(branding);

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];

    try {
      const source = await downloadImage(photo.originalUrl);
      const watermarked = await applyDealsWithDennisWatermark(source, branding);
      const path = getWatermarkedPath(
        vehicleId,
        photo.originalUrl,
        index,
        watermarkVersion,
      );
      const { error } = await supabase.storage.from(bucketName).upload(path, watermarked, {
        cacheControl: "31536000",
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
  const overlay = Buffer.from(createWatermarkSvg({
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
  }));

  return base
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ mozjpeg: true, quality: 88 })
    .toBuffer();
}

async function createBarOverlay(width: number, height: number, opacity: number) {
  return sharp({
    create: {
      background: { alpha: opacity, b: 25, g: 31, r: 5 },
      channels: 4,
      height,
      width,
    },
  })
    .png()
    .toBuffer();
}

async function createWatermarkTextOverlay({
  barHeight,
  lineGap,
  primaryFontSize,
  primaryText,
  secondaryFontSize,
  secondaryText,
  width,
}: {
  barHeight: number;
  lineGap: number;
  primaryFontSize: number;
  primaryText: string;
  secondaryFontSize: number;
  secondaryText: string;
  width: number;
}) {
  const textMaxWidth = Math.max(1, width - 56);
  const fittedPrimaryFontSize = fitSvgFontSize(
    primaryText,
    primaryFontSize,
    textMaxWidth,
    0.58,
  );
  const fittedSecondaryFontSize = fitSvgFontSize(
    secondaryText,
    secondaryFontSize,
    textMaxWidth,
    0.56,
  );
  const primaryBoxHeight = Math.ceil(fittedPrimaryFontSize * 1.34);
  const secondaryBoxHeight = Math.ceil(fittedSecondaryFontSize * 1.35);
  const contentHeight = primaryBoxHeight + lineGap + secondaryBoxHeight;
  const startY = Math.max(4, Math.round((barHeight - contentHeight) / 2));
  const primaryLayer = await renderTextLayer({
    color: "#ffffff",
    fontSize: fittedPrimaryFontSize,
    height: primaryBoxHeight,
    text: primaryText,
    weight: "800",
    width,
  });
  const secondaryLayer = await renderTextLayer({
    color: "#dbeee6",
    fontSize: fittedSecondaryFontSize,
    height: secondaryBoxHeight,
    text: secondaryText,
    weight: "700",
    width,
  });

  return sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: barHeight,
      width,
    },
  })
    .composite([
      { input: primaryLayer, left: 0, top: startY },
      { input: secondaryLayer, left: 0, top: startY + primaryBoxHeight + lineGap },
    ])
    .png()
    .toBuffer();
}

async function renderTextLayer({
  color,
  fontSize,
  height,
  text,
  weight,
  width,
}: {
  color: string;
  fontSize: number;
  height: number;
  text: string;
  weight: "700" | "800";
  width: number;
}) {
  return sharp({
    text: {
      align: "centre",
      font: `sans ${fontSize}`,
      height,
      rgba: true,
      text: `<span foreground="${color}" font_weight="${weight}">${escapePangoText(text)}</span>`,
      width,
    },
  })
    .png()
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
    fitSvgFontSize(topLineOne, primaryFontSize, textMaxWidth, 0.58),
    fitSvgFontSize(bottomLineOne, primaryFontSize, textMaxWidth, 0.58),
  );
  const fittedSecondaryFontSize = Math.min(
    fitSvgFontSize(topLineTwo, secondaryFontSize, textMaxWidth, 0.56),
    fitSvgFontSize(bottomLineTwo, secondaryFontSize, textMaxWidth, 0.56),
  );
  const topContentHeight =
    fittedPrimaryFontSize +
    lineGap +
    fittedSecondaryFontSize;
  const topStart = Math.max(10, Math.round((barHeight - topContentHeight) / 2));
  const bottomContentHeight =
    fittedPrimaryFontSize +
    lineGap +
    fittedSecondaryFontSize;
  const bottomStart =
    height - barHeight + Math.max(10, Math.round((barHeight - bottomContentHeight) / 2));
  const centerX = Math.round(width / 2);
  const topPrimaryY = topStart + Math.round(fittedPrimaryFontSize * 0.55);
  const topSecondaryY =
    topStart +
    fittedPrimaryFontSize +
    lineGap +
    Math.round(fittedSecondaryFontSize * 0.55);
  const bottomPrimaryY = bottomStart + Math.round(fittedPrimaryFontSize * 0.55);
  const bottomSecondaryY =
    bottomStart +
    fittedPrimaryFontSize +
    lineGap +
    Math.round(fittedSecondaryFontSize * 0.55);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .watermark-primary {
          fill: #ffffff;
          font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
          font-weight: 800;
        }

        .watermark-secondary {
          fill: #dbeee6;
          font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
          font-weight: 700;
        }
      </style>
      <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#051f19" opacity="0.86"/>
      <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="#051f19" opacity="0.88"/>
      <text class="watermark-primary" x="${centerX}" y="${topPrimaryY}" font-size="${fittedPrimaryFontSize}" text-anchor="middle">${escapeSvgText(topLineOne)}</text>
      <text class="watermark-secondary" x="${centerX}" y="${topSecondaryY}" font-size="${fittedSecondaryFontSize}" text-anchor="middle">${escapeSvgText(topLineTwo)}</text>
      <text class="watermark-primary" x="${centerX}" y="${bottomPrimaryY}" font-size="${fittedPrimaryFontSize}" text-anchor="middle">${escapeSvgText(bottomLineOne)}</text>
      <text class="watermark-secondary" x="${centerX}" y="${bottomSecondaryY}" font-size="${fittedSecondaryFontSize}" text-anchor="middle">${escapeSvgText(bottomLineTwo)}</text>
    </svg>
  `;
}

function fitSvgFontSize(
  text: string,
  preferredFontSize: number,
  maxWidth: number,
  averageCharacterWidth: number,
) {
  let fontSize = preferredFontSize;

  while (
    fontSize > 12 &&
    text.length * fontSize * averageCharacterWidth > maxWidth
  ) {
    fontSize -= 1;
  }

  return fontSize;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePangoText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function getWatermarkedPath(
  vehicleId: string,
  originalUrl: string,
  index: number,
  watermarkVersion: string,
) {
  const hash = crypto
    .createHash("sha256")
    .update(`${originalUrl}:${watermarkVersion}`)
    .digest("hex")
    .slice(0, 18);

  return `${sanitizePathPart(vehicleId)}/watermarked/${watermarkVersion}/${index + 1}-${hash}.jpg`;
}

function getWatermarkVersion(branding: {
  dealerName: string;
  name: string;
  phone: string;
  website: string;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        branding,
        renderVersion: watermarkRenderVersion,
      }),
    )
    .digest("hex")
    .slice(0, 12);
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
