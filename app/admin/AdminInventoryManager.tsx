"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";

type EditableVehicle = Vehicle & {
  isFeatured?: boolean;
};

const storageKey = "deals-with-dennis-admin-inventory";
const maxVehicleImages = 20;
const maxImageSizeBytes = 2_500_000;

const blankVehicle: EditableVehicle = {
  id: "draft-new-vehicle",
  type: "used",
  year: new Date().getFullYear(),
  make: "",
  model: "",
  trim: "",
  stockNumber: "",
  vin: "",
  className: "",
  priceLabel: "",
  mileageLabel: "",
  drivetrain: "",
  transmission: "",
  fuel: "",
  exteriorColor: "",
  status: "available",
  claimStatus: "unknown",
  isFeatured: true,
  imageUrls: [],
};

const editableFields = [
  "year",
  "make",
  "model",
  "trim",
  "stockNumber",
  "vin",
  "className",
  "exteriorColor",
  "priceLabel",
  "mileageLabel",
  "drivetrain",
  "transmission",
  "fuel",
] as const;

type EditableField = (typeof editableFields)[number];

const claimStatusOptions: { label: string; value: ClaimStatus }[] = [
  { label: "Unknown / not listed", value: "unknown" },
  { label: "No claim", value: "no-claim" },
  { label: "Minor claim", value: "minor-claim" },
  { label: "Claim over $5k", value: "claim-over-5k" },
];

export function AdminInventoryManager({
  initialVehicles,
}: {
  initialVehicles: Vehicle[];
}) {
  const [vehicles, setVehicles] = useState<EditableVehicle[]>(() =>
    initialVehicles.map((vehicle) => ({
      ...vehicle,
      claimStatus: vehicle.claimStatus ?? "unknown",
      isFeatured: vehicle.isFeatured ?? true,
    })),
  );
  const [selectedId, setSelectedId] = useState(initialVehicles[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadInventory();

    const saved = window.localStorage.getItem(storageKey);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as EditableVehicle[];
      setVehicles(parsed);
      setSelectedId(parsed[0]?.id ?? "");
    } catch {
      setNotice("Saved draft could not be loaded.");
    }
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0],
    [selectedId, vehicles],
  );

  function updateVehicle(id: string, patch: Partial<EditableVehicle>) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, ...patch } : vehicle,
      ),
    );
  }

  async function uploadVehicleImages(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const vehicle = vehicles.find((item) => item.id === id);
    const currentImages = vehicle?.imageUrls ?? [];
    const openSlots = maxVehicleImages - currentImages.length;

    if (openSlots <= 0) {
      setNotice("This vehicle already has the 20 image maximum.");
      return;
    }

    const acceptedFiles = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, openSlots);
    const oversized = acceptedFiles.find(
      (file) => file.size > maxImageSizeBytes,
    );

    if (oversized) {
      setNotice("Each image must be 2.5 MB or smaller for this preview version.");
      return;
    }

    const formData = new FormData();
    formData.set("vehicleId", id);
    acceptedFiles.forEach((file) => formData.append("images", file));

    const response = await fetch("/api/admin/images", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Image upload failed.");
      return;
    }

    const result = (await response.json()) as {
      imageUrls?: string[];
      mode?: string;
    };
    const imageUrls = result.imageUrls ?? [];
    updateVehicle(id, {
      imageUrls: [...currentImages, ...imageUrls],
    });
    setNotice(
      `Added ${imageUrls.length} image${imageUrls.length === 1 ? "" : "s"}${
        result.mode === "supabase" ? " to Supabase Storage" : ""
      }.`,
    );
  }

  function removeVehicleImage(id: string, imageIndex: number) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentImages = vehicle?.imageUrls ?? [];

    updateVehicle(id, {
      imageUrls: currentImages.filter((_, index) => index !== imageIndex),
    });
    setNotice("Image removed.");
  }

  function setCoverImage(id: string, imageIndex: number) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentImages = [...(vehicle?.imageUrls ?? [])];
    const [selected] = currentImages.splice(imageIndex, 1);

    if (!selected) {
      return;
    }

    updateVehicle(id, {
      imageUrls: [selected, ...currentImages],
    });
    setNotice("Cover image updated.");
  }

  async function loadInventory() {
    const response = await fetch("/api/admin/inventory");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { vehicles?: EditableVehicle[] };

    if (data.vehicles?.length) {
      setVehicles(
        data.vehicles.map((vehicle) => ({
          ...vehicle,
          claimStatus: vehicle.claimStatus ?? "unknown",
          isFeatured: vehicle.isFeatured ?? true,
        })),
      );
      setSelectedId(data.vehicles[0].id);
    }
  }

  async function saveDraft() {
    setSaving(true);
    window.localStorage.setItem(storageKey, JSON.stringify(vehicles));

    const response = await fetch("/api/admin/inventory", {
      body: JSON.stringify({ vehicles }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      setNotice("Draft saved locally, but server save failed.");
      setSaving(false);
      return;
    }

    const result = (await response.json()) as { mode?: string; count?: number };
    setNotice(
      result.mode === "supabase"
        ? `Saved ${result.count ?? vehicles.length} vehicles to Supabase.`
        : "Draft saved locally. Add Supabase env vars for remote persistence.",
    );
    setSaving(false);
  }

  function resetDraft() {
    const next = initialVehicles.map((vehicle) => ({
      ...vehicle,
      claimStatus: vehicle.claimStatus ?? "unknown",
      isFeatured: vehicle.isFeatured ?? true,
    }));
    window.localStorage.removeItem(storageKey);
    setVehicles(next);
    setSelectedId(next[0]?.id ?? "");
    setNotice("Draft reset to source inventory.");
  }

  function addVehicle() {
    const id = `draft-${Date.now()}`;
    const next = { ...blankVehicle, id };
    setVehicles((current) => [next, ...current]);
    setSelectedId(id);
    setNotice("New vehicle draft added.");
  }

  function removeVehicle(id: string) {
    setVehicles((current) => {
      const next = current.filter((vehicle) => vehicle.id !== id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
    setNotice("Vehicle removed from draft.");
  }

  function exportDraft() {
    const blob = new Blob([JSON.stringify(vehicles, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory-draft.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.reload();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith(".json")
      ? JSON.parse(text)
      : parseCsv(text);

    const normalized = (imported as Partial<EditableVehicle>[]).map(
      (vehicle, index) => ({
        ...blankVehicle,
        ...vehicle,
        id: vehicle.id ?? `import-${Date.now()}-${index}`,
        type: (vehicle.type as VehicleType) ?? "used",
        status: vehicle.status ?? "available",
        isFeatured: vehicle.isFeatured ?? true,
        claimStatus: normalizeClaimStatus(vehicle.claimStatus),
      }),
    );

    setVehicles(normalized);
    setSelectedId(normalized[0]?.id ?? "");
    setNotice(`Imported ${normalized.length} vehicles.`);
    event.target.value = "";
  }

  return (
    <section className="admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Inventory draft</p>
          <h2>{vehicles.length} vehicles</h2>
        </div>
        <div className="admin-actions">
          <label className="button secondary file-button">
            Import CSV/JSON
            <input accept=".csv,.json" onChange={importFile} type="file" />
          </label>
          <button className="button secondary" onClick={exportDraft} type="button">
            Export
          </button>
          <button className="button secondary" onClick={addVehicle} type="button">
            Add Vehicle
          </button>
          <button className="button secondary" onClick={logout} type="button">
            Sign Out
          </button>
          <button
            className="button primary"
            disabled={saving}
            onClick={saveDraft}
            type="button"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="admin-workspace">
        <div className="admin-list" aria-label="Inventory vehicles">
          {vehicles.map((vehicle) => (
            <button
              className={vehicle.id === selectedVehicle?.id ? "active" : ""}
              key={vehicle.id}
              onClick={() => setSelectedId(vehicle.id)}
              type="button"
            >
              <span>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              <small>{vehicle.stockNumber || "No stock #"}</small>
            </button>
          ))}
        </div>

        {selectedVehicle ? (
          <form className="admin-editor">
            <div className="editor-head">
              <div>
                <p className="eyebrow">Edit vehicle</p>
                <h3>
                  {selectedVehicle.year} {selectedVehicle.make}{" "}
                  {selectedVehicle.model}
                </h3>
              </div>
              <button
                className="button danger"
                onClick={() => removeVehicle(selectedVehicle.id)}
                type="button"
              >
                Remove
              </button>
            </div>

            <div className="editor-grid">
              <div className="editor-wide image-manager">
                <div className="image-manager-head">
                  <div>
                    <span>Vehicle images</span>
                    <p>
                      {(selectedVehicle.imageUrls?.length ?? 0)} /{" "}
                      {maxVehicleImages} uploaded
                    </p>
                  </div>
                  <label className="button secondary file-button">
                    Upload Images
                    <input
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        uploadVehicleImages(selectedVehicle.id, event)
                      }
                      type="file"
                    />
                  </label>
                </div>

                {(selectedVehicle.imageUrls?.length ?? 0) > 0 ? (
                  <div className="image-grid">
                    {selectedVehicle.imageUrls?.map((imageUrl, index) => (
                      <div className="image-tile" key={`${imageUrl}-${index}`}>
                        <img alt="" src={imageUrl} />
                        <div className="image-actions">
                          <button
                            onClick={() => setCoverImage(selectedVehicle.id, index)}
                            type="button"
                          >
                            {index === 0 ? "Cover" : "Make Cover"}
                          </button>
                          <button
                            onClick={() =>
                              removeVehicleImage(selectedVehicle.id, index)
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="image-empty">
                    Upload up to 20 photos. The first image becomes the public
                    inventory cover.
                  </p>
                )}
              </div>

              <label>
                <span>Type</span>
                <select
                  value={selectedVehicle.type}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      type: event.target.value as VehicleType,
                    })
                  }
                >
                  <option value="used">Used</option>
                  <option value="new">New</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={selectedVehicle.status}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      status: event.target.value as EditableVehicle["status"],
                    })
                  }
                >
                  <option value="available">Available</option>
                  <option value="incoming">Incoming</option>
                  <option value="sold">Sold</option>
                </select>
              </label>

              <label>
                <span>Claim Status</span>
                <select
                  value={selectedVehicle.claimStatus ?? "unknown"}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      claimStatus: event.target.value as ClaimStatus,
                    })
                  }
                >
                  {claimStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {editableFields.map((field) => (
                <label key={field}>
                  <span>{fieldLabel(field)}</span>
                  <input
                    value={String(selectedVehicle[field] ?? "")}
                    onChange={(event) =>
                      updateVehicle(selectedVehicle.id, {
                        [field]:
                          field === "year"
                            ? Number(event.target.value)
                            : event.target.value,
                      })
                    }
                    type={field === "year" ? "number" : "text"}
                  />
                </label>
              ))}

              <label className="editor-wide">
                <span>Featured on public site</span>
                <select
                  value={selectedVehicle.isFeatured ? "yes" : "no"}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      isFeatured: event.target.value === "yes",
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            <div className="admin-actions bottom-actions">
              <button className="button secondary" onClick={resetDraft} type="button">
                Reset Draft
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={saveDraft}
                type="button"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function fieldLabel(field: EditableField) {
  const labels: Record<EditableField, string> = {
    year: "Year",
    make: "Brand",
    model: "Model",
    trim: "Trim",
    stockNumber: "Stock #",
    vin: "VIN",
    className: "Class",
    exteriorColor: "Color",
    priceLabel: "Price",
    mileageLabel: "Mileage",
    drivetrain: "Drivetrain",
    transmission: "Transmission",
    fuel: "Fuel",
  };

  return labels[field];
}

function parseCsv(text: string) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);

  return rows
    .filter(Boolean)
    .map((row) => {
      const values = splitCsvLine(row);
      return headers.reduce<Record<string, string>>((record, header, index) => {
        record[toCamelKey(header)] = values[index] ?? "";
        return record;
      }, {});
    });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function toCamelKey(value: string) {
  const normalized = value.trim().replace(/[#/]/g, "").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    brand: "make",
    colour: "exteriorColor",
    color: "exteriorColor",
    class: "className",
    stock: "stockNumber",
    stock_number: "stockNumber",
    "stock number": "stockNumber",
    price: "priceLabel",
    mileage: "mileageLabel",
    "claim status": "claimStatus",
    claim_status: "claimStatus",
    claims: "claimStatus",
    drive: "drivetrain",
    drivetrain: "drivetrain",
    fuel: "fuel",
    fuel_type: "fuel",
    "fuel type": "fuel",
    transmission: "transmission",
    transmission_type: "transmission",
    "transmission type": "transmission",
  };
  const lower = normalized.toLowerCase();

  if (aliases[lower]) {
    return aliases[lower];
  }

  return lower.replace(/ ([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeClaimStatus(value: unknown): ClaimStatus {
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!lower) {
    return "unknown";
  }

  if (lower.includes("no") && lower.includes("claim")) {
    return "no-claim";
  }

  if (lower.includes("minor")) {
    return "minor-claim";
  }

  if (lower.includes("5k") || lower.includes("5000") || lower.includes("5,000")) {
    return "claim-over-5k";
  }

  return "unknown";
}
