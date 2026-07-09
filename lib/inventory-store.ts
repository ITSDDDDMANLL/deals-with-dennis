import seedVehicles from "../app/data/used-inventory.json";
import type { Vehicle } from "../app/data/inventory";
import { createSupabaseAdmin } from "./supabase/admin";

type InventoryRow = {
  id: string;
  source: string | null;
  vehicle_type: "new" | "used";
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stock_number: string | null;
  vin: string | null;
  class_name: string | null;
  exterior_color: string | null;
  price_label: string | null;
  mileage_label: string | null;
  status: "available" | "incoming" | "sold";
  claim_status: string | null;
  is_featured: boolean | null;
  image_urls: string[] | null;
  raw_payload?: Record<string, unknown> | null;
};

export async function getInventoryVehicles(
  fallback: Vehicle[] = [],
  options: { includeHidden?: boolean } = {},
) {
  const supabase = createSupabaseAdmin();
  const fallbackVehicles = fallback.length ? fallback : (seedVehicles as Vehicle[]);

  if (!supabase) {
    return options.includeHidden
      ? fallbackVehicles
      : fallbackVehicles.filter((vehicle) => vehicle.isFeatured !== false);
  }

  let query = supabase
    .from("inventory_vehicles")
    .select(
      "id, source, vehicle_type, year, make, model, trim, stock_number, vin, class_name, exterior_color, price_label, mileage_label, status, claim_status, is_featured, image_urls, raw_payload",
    )
    .order("created_at", { ascending: false });

  if (!options.includeHidden) {
    query = query.eq("is_featured", true).eq("status", "available");
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return options.includeHidden
      ? fallbackVehicles
      : fallbackVehicles.filter((vehicle) => vehicle.isFeatured !== false);
  }

  return (data as InventoryRow[]).map(rowToVehicle);
}

export async function saveInventoryVehicles(vehicles: Vehicle[]) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { mode: "local", count: vehicles.length };
  }

  const rows = vehicles.map(vehicleToRow);
  const { error } = await supabase
    .from("inventory_vehicles")
    .upsert(rows, { onConflict: "stock_number" });

  if (error) {
    throw error;
  }

  return { mode: "supabase", count: vehicles.length };
}

function rowToVehicle(row: InventoryRow): Vehicle {
  const raw = row.raw_payload ?? {};

  return {
    id: row.id,
    type: row.vehicle_type,
    year: row.year ?? Number(raw.year ?? new Date().getFullYear()),
    make: row.make ?? "",
    model: row.model ?? "",
    trim: row.trim ?? "",
    stockNumber: row.stock_number ?? "",
    vin: row.vin ?? "",
    className: row.class_name ?? "",
    priceLabel: row.price_label ?? "Ask for pricing",
    mileageLabel: row.mileage_label ?? "Mileage TBD",
    drivetrain: String(raw.drivetrain ?? ""),
    transmission: String(raw.transmission ?? ""),
    fuel: String(raw.fuel ?? ""),
    exteriorColor: row.exterior_color ?? "Color TBD",
    status: row.status,
    claimStatus: normalizeClaimStatus(row.claim_status ?? raw.claimStatus),
    sourceVehicle: String(raw.sourceVehicle ?? ""),
    isFeatured: row.is_featured ?? true,
    imageUrls: Array.isArray(row.image_urls)
      ? row.image_urls.map(String)
      : Array.isArray(raw.imageUrls)
        ? raw.imageUrls.map(String)
        : [],
  };
}

function vehicleToRow(vehicle: Vehicle) {
  return {
    source: "admin",
    vehicle_type: vehicle.type,
    year: vehicle.year || null,
    make: vehicle.make || null,
    model: vehicle.model || null,
    trim: vehicle.trim || null,
    stock_number: vehicle.stockNumber || vehicle.id,
    vin: vehicle.vin || null,
    class_name: vehicle.className || null,
    exterior_color: vehicle.exteriorColor || null,
    price_label: vehicle.priceLabel || null,
    mileage_label: vehicle.mileageLabel || null,
    status: vehicle.status,
    claim_status: vehicle.claimStatus ?? "unknown",
    is_featured: vehicle.isFeatured !== false,
    image_urls: vehicle.imageUrls ?? [],
    raw_payload: vehicle,
  };
}

function normalizeClaimStatus(value: unknown): Vehicle["claimStatus"] {
  const normalized = String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  if (
    normalized === "no-claim" ||
    normalized === "minor-claim" ||
    normalized === "claim-over-5k"
  ) {
    return normalized;
  }

  return "unknown";
}
