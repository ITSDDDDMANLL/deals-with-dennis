import { cookies } from "next/headers";
import { getFeaturedVehicles } from "../../../../data/inventory";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../../lib/admin-auth";
import { getInventoryVehicles } from "../../../../../lib/inventory-store";

export const runtime = "nodejs";

type ZipEntryRecord = {
  compressedSize: number;
  crc: number;
  fileName: Uint8Array;
  localHeaderOffset: number;
  modifiedAt: Date;
  uncompressedSize: number;
};

type WatermarkedPhotoDownload = {
  fileName: string;
  url: string;
};

const encoder = new TextEncoder();
const maxFileSize = 80_000_000;

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const vehicles = await getInventoryVehicles(getFeaturedVehicles(), {
    includeHidden: true,
  });
  const downloads = vehicles
    .filter((vehicle) => !vehicle.deletedAt)
    .flatMap((vehicle) =>
      (vehicle.vehiclePhotos ?? [])
        .map((photo, index) => ({
          fileName: buildPhotoFileName(vehicle, index, photo.watermarkedUrl),
          url: String(photo.watermarkedUrl ?? "").trim(),
        }))
        .filter((photo) => photo.url),
    );

  if (!downloads.length) {
    return Response.json(
      {
        error: "No watermarked photos are ready to download.",
        details: "Run Watermark All Vehicles first, then save vehicle changes.",
      },
      { status: 404 },
    );
  }

  const fileName = `deals-with-dennis-watermarked-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(createZipStream(downloads), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/zip",
    },
  });
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}

function createZipStream(downloads: WatermarkedPhotoDownload[]) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const records: ZipEntryRecord[] = [];
      const errors: string[] = [];
      let offset = 0;

      const enqueue = (chunk: Uint8Array) => {
        controller.enqueue(chunk);
        offset += chunk.byteLength;
      };

      for (const download of downloads) {
        try {
          const response = await fetch(download.url, { cache: "no-store" });

          if (!response.ok || !response.body) {
            errors.push(
              `${download.fileName}: HTTP ${response.status} ${response.statusText}`.trim(),
            );
            continue;
          }

          const contentLength = Number(response.headers.get("content-length") ?? 0);

          if (contentLength > maxFileSize) {
            errors.push(
              `${download.fileName}: skipped because it is larger than ${Math.round(
                maxFileSize / 1_000_000,
              )} MB.`,
            );
            continue;
          }

          const record = createEntryRecord(download.fileName, offset);
          enqueue(createLocalFileHeader(record));

          const reader = response.body.getReader();
          let fileSize = 0;
          let crc = 0xffffffff;

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            if (!value) {
              continue;
            }

            fileSize += value.byteLength;
            crc = updateCrc32(crc, value);
            enqueue(value);
          }

          record.crc = (crc ^ 0xffffffff) >>> 0;
          record.compressedSize = fileSize;
          record.uncompressedSize = fileSize;
          enqueue(createDataDescriptor(record));
          records.push(record);
        } catch (error) {
          errors.push(
            `${download.fileName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (errors.length) {
        const record = createEntryRecord("download-errors.txt", offset);
        const payload = encoder.encode(errors.join("\n"));
        enqueue(createLocalFileHeader(record));
        record.crc = calculateCrc32(payload);
        record.compressedSize = payload.byteLength;
        record.uncompressedSize = payload.byteLength;
        enqueue(payload);
        enqueue(createDataDescriptor(record));
        records.push(record);
      }

      const centralDirectoryOffset = offset;
      for (const record of records) {
        enqueue(createCentralDirectoryHeader(record));
      }

      enqueue(
        createEndOfCentralDirectory({
          centralDirectoryOffset,
          centralDirectorySize: offset - centralDirectoryOffset,
          entryCount: records.length,
        }),
      );
      controller.close();
    },
  });
}

function createEntryRecord(
  fileName: string,
  localHeaderOffset: number,
): ZipEntryRecord {
  return {
    compressedSize: 0,
    crc: 0,
    fileName: encoder.encode(fileName),
    localHeaderOffset,
    modifiedAt: new Date(),
    uncompressedSize: 0,
  };
}

function createLocalFileHeader(record: ZipEntryRecord) {
  const buffer = new Uint8Array(30 + record.fileName.byteLength);
  const view = new DataView(buffer.buffer);
  const { date, time } = toDosDateTime(record.modifiedAt);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0808, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint16(26, record.fileName.byteLength, true);
  buffer.set(record.fileName, 30);

  return buffer;
}

function createDataDescriptor(record: ZipEntryRecord) {
  const buffer = new Uint8Array(16);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, record.crc, true);
  view.setUint32(8, record.compressedSize, true);
  view.setUint32(12, record.uncompressedSize, true);

  return buffer;
}

function createCentralDirectoryHeader(record: ZipEntryRecord) {
  const buffer = new Uint8Array(46 + record.fileName.byteLength);
  const view = new DataView(buffer.buffer);
  const { date, time } = toDosDateTime(record.modifiedAt);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0808, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, record.crc, true);
  view.setUint32(20, record.compressedSize, true);
  view.setUint32(24, record.uncompressedSize, true);
  view.setUint16(28, record.fileName.byteLength, true);
  view.setUint32(42, record.localHeaderOffset, true);
  buffer.set(record.fileName, 46);

  return buffer;
}

function createEndOfCentralDirectory({
  centralDirectoryOffset,
  centralDirectorySize,
  entryCount,
}: {
  centralDirectoryOffset: number;
  centralDirectorySize: number;
  entryCount: number;
}) {
  const buffer = new Uint8Array(22);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);

  return buffer;
}

function toDosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

function calculateCrc32(bytes: Uint8Array) {
  return (updateCrc32(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
}

function updateCrc32(crc: number, bytes: Uint8Array) {
  let nextCrc = crc;

  for (const byte of bytes) {
    nextCrc = (nextCrc >>> 8) ^ crcTable[(nextCrc ^ byte) & 0xff];
  }

  return nextCrc;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function buildPhotoFileName(
  vehicle: {
    id: string;
    make: string;
    model: string;
    stockNumber?: string;
    year: number;
  },
  index: number,
  url?: string,
) {
  const extension = getImageExtension(url);
  const stock = vehicle.stockNumber || vehicle.id;
  const baseName = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    stock,
    String(index + 1).padStart(2, "0"),
  ]
    .filter(Boolean)
    .map(sanitizeFileNamePart)
    .join("-");

  return `${baseName || `vehicle-${index + 1}`}.${extension}`;
}

function getImageExtension(url?: string) {
  if (!url) {
    return "jpg";
  }

  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase() ?? "";

    if (/^(avif|gif|heic|heif|jpeg|jpg|png|webp)$/.test(extension)) {
      return extension === "jpeg" ? "jpg" : extension;
    }
  } catch {
    return "jpg";
  }

  return "jpg";
}

function sanitizeFileNamePart(value: string | number) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
