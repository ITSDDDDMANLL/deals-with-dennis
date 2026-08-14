"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../../data/inventory";
import { readErrorMessage } from "../../utils/read-error-message";

type BulkVehicle = Vehicle & {
  isDirty?: boolean;
};

type PublishChange = {
  fields?: string[];
  label: string;
  type: "added" | "changed" | "removed";
};

type PublishSummary = {
  added: PublishChange[];
  changed: PublishChange[];
  removed: PublishChange[];
  total: number;
};

const classNameOptions = [
  "",
  "SUV",
  "Crossover",
  "Sedan",
  "Coupe",
  "Hatchback",
  "Wagon",
  "Convertible",
  "Truck",
  "Pickup Truck",
  "Van",
  "Minivan",
  "Cargo Van",
  "Passenger Van",
  "Commercial",
  "Chassis Cab",
  "Other",
];
const drivetrainOptions = ["", "FWD", "RWD", "AWD", "4x4", "Other"];
const transmissionOptions = ["", "Manual", "Auto", "Other"];
const fuelOptions = ["", "Diesel", "Gasoline", "Hybrid", "EV", "PHEV", "Other"];
const maxScreenshotFiles = 8;
const maxScreenshotSide = 1600;
const screenshotQuality = 0.72;
const claimStatusOptions: { label: string; value: ClaimStatus }[] = [
  { label: "Unknown", value: "unknown" },
  { label: "No claim", value: "no-claim" },
  { label: "Minor claim", value: "minor-claim" },
  { label: "Claim over $5k", value: "claim-over-5k" },
];

const blankVehicle: BulkVehicle = {
  id: "bulk-new",
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
  status: "incoming",
  claimStatus: "unknown",
  isFeatured: true,
  imageUrls: [],
  vehiclePhotos: [],
  details: "",
  highlights: "",
};

type ExtractedVehicle = Partial<Vehicle> & {
  notes?: string;
};

export function BulkInventoryEditor({
  initialVehicles,
}: {
  initialVehicles: Vehicle[];
}) {
  const [baselineVehicles, setBaselineVehicles] = useState<Vehicle[]>(initialVehicles);
  const [vehicles, setVehicles] = useState<BulkVehicle[]>(() =>
    initialVehicles.map((vehicle) => ({ ...vehicle, isDirty: false })),
  );
  const [notice, setNotice] = useState("");
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const filteredVehicles = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const searchMatches =
        !needle ||
        [
          vehicle.year,
          vehicle.make,
          vehicle.model,
          vehicle.trim,
          vehicle.stockNumber,
          vehicle.vin,
          vehicle.priceLabel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const statusMatches = statusFilter === "all" || vehicle.status === statusFilter;
      const typeMatches = typeFilter === "all" || vehicle.type === typeFilter;

      return searchMatches && statusMatches && typeMatches;
    });
  }, [search, statusFilter, typeFilter, vehicles]);

  function updateVehicle(id: string, patch: Partial<BulkVehicle>) {
    setHasUnsavedChanges(true);
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, ...patch, isDirty: true } : vehicle,
      ),
    );
  }

  function addRow(vehicle: Partial<BulkVehicle> = {}) {
    const nextVehicle = normalizeBulkVehicle({
      ...blankVehicle,
      ...vehicle,
      id: vehicle.id || `bulk-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      isDirty: true,
    });

    setHasUnsavedChanges(true);
    setVehicles((current) => [nextVehicle, ...current]);
    setNotice("Row added. Review it, then publish to Supabase.");
  }

  function removeRow(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);
    const label = [vehicle?.year, vehicle?.make, vehicle?.model]
      .filter(Boolean)
      .join(" ");
    const confirmed = window.confirm(
      `Remove ${label || "this row"} from inventory? It will be deleted from Supabase after publishing.`,
    );

    if (!confirmed) {
      return;
    }

    setHasUnsavedChanges(true);
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    setNotice("Row removed. Publish to apply the deletion.");
  }

  async function reloadInventory() {
    const confirmed =
      !hasUnsavedChanges ||
      window.confirm(
        "Reload from Supabase? Unsaved bulk edits will be discarded.",
      );

    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/admin/inventory");

    if (!response.ok) {
      setNotice(await readErrorMessage(response, "Bulk inventory reload failed."));
      return;
    }

    const data = (await response.json()) as { vehicles?: Vehicle[] };
    const nextVehicles = data.vehicles ?? [];
    setBaselineVehicles(nextVehicles);
    setVehicles(nextVehicles.map((vehicle) => ({ ...vehicle, isDirty: false })));
    setHasUnsavedChanges(false);
    setNotice("Reloaded current inventory from Supabase.");
  }

  function requestPublishConfirmation() {
    const summary = getPublishSummary(baselineVehicles, vehicles);

    if (!summary.total) {
      setNotice("No inventory changes to publish.");
      return;
    }

    setPublishSummary(summary);
  }

  async function publishInventory() {
    setSaving(true);
    setPublishSummary(null);
    const vehiclesToSave = vehicles.map((vehicle) =>
      stripBulkFields(normalizeBulkVehicle(vehicle)),
    );

    let response: Response;

    try {
      response = await fetch("/api/admin/inventory", {
        body: JSON.stringify({ vehicles: vehiclesToSave }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
    } catch (error) {
      setNotice(`Bulk publish failed before reaching the server: ${getErrorMessage(error)}`);
      setSaving(false);
      return;
    }

    if (!response.ok) {
      setNotice(await readErrorMessage(response, "Bulk publish failed."));
      setSaving(false);
      return;
    }

    const result = (await response.json()) as { count?: number; mode?: string };

    if (result.mode !== "supabase") {
      setNotice("Bulk publish did not reach Supabase. Check server environment variables.");
      setSaving(false);
      return;
    }

    setBaselineVehicles(vehiclesToSave);
    setVehicles(vehiclesToSave.map((vehicle) => ({ ...vehicle, isDirty: false })));
    setHasUnsavedChanges(false);
    setSaving(false);
    setNotice(`Published ${result.count ?? vehiclesToSave.length} vehicles to Supabase.`);
  }

  async function extractFromScreenshots(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, maxScreenshotFiles);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    setExtracting(true);
    setNotice(
      `Preparing ${files.length} screenshot${files.length === 1 ? "" : "s"} for recognition...`,
    );

    const formData = new FormData();

    try {
      const compressedFiles = await Promise.all(files.map(compressScreenshotFile));
      const originalSize = files.reduce((total, file) => total + file.size, 0);
      const compressedSize = compressedFiles.reduce((total, file) => total + file.size, 0);

      compressedFiles.forEach((file) => formData.append("images", file));
      setNotice(
        `Reading screenshots... compressed from ${formatBytes(originalSize)} to ${formatBytes(compressedSize)}.`,
      );
    } catch (error) {
      setNotice(`Screenshot import failed while preparing images: ${getErrorMessage(error)}`);
      setExtracting(false);
      return;
    }

    let response: Response;

    try {
      response = await fetch("/api/admin/bulk/extract", {
        body: formData,
        method: "POST",
      });
    } catch (error) {
      setNotice(`Screenshot import failed before reaching the server: ${getErrorMessage(error)}`);
      setExtracting(false);
      return;
    }

    if (!response.ok) {
      const message = await readErrorMessage(response, "Screenshot import failed.");
      setNotice(
        response.status === 413 || /payload|too large/i.test(message)
          ? `${message}. Try fewer screenshots at once, or crop each screenshot closer to the vehicle information.`
          : message,
      );
      setExtracting(false);
      return;
    }

    const data = (await response.json()) as { vehicles?: ExtractedVehicle[] };
    const extracted = (data.vehicles ?? []).map((vehicle) =>
      normalizeBulkVehicle({
        ...blankVehicle,
        ...vehicle,
        id: vehicle.id || `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        isDirty: true,
      }),
    );

    if (!extracted.length) {
      setNotice("No vehicle rows were found in those screenshots.");
      setExtracting(false);
      return;
    }

    setVehicles((current) => [...extracted, ...current]);
    setHasUnsavedChanges(true);
    setExtracting(false);
    setNotice(
      `Imported ${extracted.length} draft row${extracted.length === 1 ? "" : "s"} from screenshots. Review before publishing.`,
    );
  }

  return (
    <section className="bulk-admin-shell">
      <div className="bulk-toolbar">
        <div>
          <p className="eyebrow">Bulk inventory table</p>
          <h2>{vehicles.length} rows</h2>
          <p className={`admin-save-state ${hasUnsavedChanges ? "is-unsaved" : "is-saved"}`}>
            {hasUnsavedChanges ? "Unpublished bulk edits" : "Saved to Supabase"}
          </p>
        </div>
        <div className="admin-actions">
          <label className="button secondary file-button">
            {extracting ? "Reading screenshots..." : "Import Screenshots"}
            <input
              accept="image/*"
              disabled={extracting}
              multiple
              onChange={extractFromScreenshots}
              type="file"
            />
          </label>
          <button className="button secondary" onClick={() => addRow()} type="button">
            Add Row
          </button>
          <button className="button secondary" onClick={reloadInventory} type="button">
            Reload from Supabase
          </button>
          <button
            className="button primary"
            disabled={saving}
            onClick={requestPublishConfirmation}
            type="button"
          >
            {saving ? "Publishing..." : "Publish to Inventory"}
          </button>
        </div>
      </div>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="bulk-filter-bar">
        <label>
          <span>Search</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search year, make, model, stock, VIN"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span>New / Used</span>
          <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            <option value="all">All inventory</option>
            <option value="new">New</option>
            <option value="used">Used</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="incoming">Incoming</option>
            <option value="sold">Sold</option>
          </select>
        </label>
      </div>

      <div className="bulk-table-wrap">
        <table className="bulk-table">
          <thead>
            <tr>
              <th>Featured</th>
              <th>Type</th>
              <th>Status</th>
              <th>Year</th>
              <th>Make</th>
              <th>Model</th>
              <th>Trim</th>
              <th>Price</th>
              <th>Mileage</th>
              <th>Stock #</th>
              <th>VIN</th>
              <th>Class</th>
              <th>Color</th>
              <th>Drivetrain</th>
              <th>Trans.</th>
              <th>Fuel</th>
              <th>Claim</th>
              <th>Highlights</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((vehicle) => (
              <tr key={vehicle.id} className={vehicle.isDirty ? "is-dirty" : ""}>
                <td>
                  <input
                    checked={vehicle.isFeatured !== false}
                    onChange={(event) =>
                      updateVehicle(vehicle.id, { isFeatured: event.target.checked })
                    }
                    type="checkbox"
                  />
                </td>
                <td>
                  <select
                    onChange={(event) =>
                      updateVehicle(vehicle.id, {
                        type: event.target.value as VehicleType,
                      })
                    }
                    value={vehicle.type}
                  >
                    <option value="used">Used</option>
                    <option value="new">New</option>
                  </select>
                </td>
                <td>
                  <select
                    onChange={(event) =>
                      updateVehicle(vehicle.id, {
                        status: event.target.value as Vehicle["status"],
                      })
                    }
                    value={vehicle.status}
                  >
                    <option value="available">Available</option>
                    <option value="incoming">Incoming</option>
                    <option value="sold">Sold</option>
                  </select>
                </td>
                <EditableCell
                  inputMode="numeric"
                  onChange={(value) => updateVehicle(vehicle.id, { year: Number(value) || 0 })}
                  value={String(vehicle.year || "")}
                />
                <EditableCell onChange={(value) => updateVehicle(vehicle.id, { make: value })} value={vehicle.make} />
                <EditableCell onChange={(value) => updateVehicle(vehicle.id, { model: value })} value={vehicle.model} />
                <EditableCell onChange={(value) => updateVehicle(vehicle.id, { trim: value })} value={vehicle.trim} />
                <EditableCell
                  inputMode="numeric"
                  onBlur={(value) =>
                    updateVehicle(vehicle.id, { priceLabel: normalizePriceLabel(value) })
                  }
                  onChange={(value) => updateVehicle(vehicle.id, { priceLabel: value })}
                  value={vehicle.priceLabel}
                />
                <EditableCell
                  onChange={(value) => updateVehicle(vehicle.id, { mileageLabel: value })}
                  value={vehicle.mileageLabel}
                />
                <EditableCell
                  onChange={(value) => updateVehicle(vehicle.id, { stockNumber: value })}
                  value={vehicle.stockNumber ?? ""}
                />
                <EditableCell
                  onChange={(value) => updateVehicle(vehicle.id, { vin: value })}
                  value={vehicle.vin ?? ""}
                />
                <td>
                  <select
                    onChange={(event) =>
                      updateVehicle(vehicle.id, { className: event.target.value })
                    }
                    value={vehicle.className ?? ""}
                  >
                    {classNameOptions.map((option) => (
                      <option key={option || "blank"} value={option}>
                        {option || "Select"}
                      </option>
                    ))}
                  </select>
                </td>
                <EditableCell
                  onChange={(value) => updateVehicle(vehicle.id, { exteriorColor: value })}
                  value={vehicle.exteriorColor}
                />
                <SelectCell
                  onChange={(value) => updateVehicle(vehicle.id, { drivetrain: value })}
                  options={drivetrainOptions}
                  value={vehicle.drivetrain ?? ""}
                />
                <SelectCell
                  onChange={(value) => updateVehicle(vehicle.id, { transmission: value })}
                  options={transmissionOptions}
                  value={vehicle.transmission ?? ""}
                />
                <SelectCell
                  onChange={(value) => updateVehicle(vehicle.id, { fuel: value })}
                  options={fuelOptions}
                  value={vehicle.fuel ?? ""}
                />
                <td>
                  <select
                    onChange={(event) =>
                      updateVehicle(vehicle.id, {
                        claimStatus: event.target.value as ClaimStatus,
                      })
                    }
                    value={vehicle.claimStatus ?? "unknown"}
                  >
                    {claimStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <EditableCell
                  className="wide-cell"
                  onChange={(value) => updateVehicle(vehicle.id, { highlights: value })}
                  value={vehicle.highlights ?? ""}
                />
                <td>
                  <button
                    className="bulk-remove-button"
                    onClick={() => removeRow(vehicle.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {publishSummary ? (
        <div
          aria-modal="true"
          className="bulk-confirm-modal"
          role="dialog"
          aria-label="Confirm inventory publish"
        >
          <div className="bulk-confirm-backdrop" onClick={() => setPublishSummary(null)} />
          <div className="bulk-confirm-dialog">
            <div className="bulk-confirm-head">
              <div>
                <p className="eyebrow">Review changes</p>
                <h3>Confirm publish</h3>
              </div>
              <button
                aria-label="Close publish confirmation"
                className="vehicle-modal-close"
                onClick={() => setPublishSummary(null)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="bulk-confirm-stats">
              <span>{publishSummary.added.length} added</span>
              <span>{publishSummary.changed.length} changed</span>
              <span>{publishSummary.removed.length} removed</span>
            </div>

            <div className="bulk-confirm-list">
              {renderChangeGroup("Added", publishSummary.added)}
              {renderChangeGroup("Changed", publishSummary.changed)}
              {renderChangeGroup("Removed", publishSummary.removed)}
            </div>

            <div className="bulk-confirm-actions">
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => setPublishSummary(null)}
                type="button"
              >
                Keep Editing
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={publishInventory}
                type="button"
              >
                {saving ? "Publishing..." : "Confirm Publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function renderChangeGroup(label: string, changes: PublishChange[]) {
  if (!changes.length) {
    return null;
  }

  return (
    <section>
      <h4>
        {label} <span>{changes.length}</span>
      </h4>
      <ul>
        {changes.slice(0, 12).map((change) => (
          <li key={`${change.type}-${change.label}-${change.fields?.join(",") ?? ""}`}>
            <strong>{change.label}</strong>
            {change.fields?.length ? <span>{change.fields.join(", ")}</span> : null}
          </li>
        ))}
      </ul>
      {changes.length > 12 ? (
        <p className="bulk-confirm-more">+ {changes.length - 12} more</p>
      ) : null}
    </section>
  );
}

function EditableCell({
  className = "",
  inputMode,
  onBlur,
  onChange,
  value,
}: {
  className?: string;
  inputMode?: "numeric";
  onBlur?: (value: string) => void;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <td className={className}>
      <input
        inputMode={inputMode}
        onBlur={(event) => onBlur?.(event.target.value)}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </td>
  );
}

function SelectCell({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <td>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option || "blank"} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </td>
  );
}

function normalizeBulkVehicle(vehicle: Partial<BulkVehicle>): BulkVehicle {
  const priceLabel = normalizePriceLabel(vehicle.priceLabel);

  return {
    ...blankVehicle,
    ...vehicle,
    claimStatus: normalizeClaimStatus(vehicle.claimStatus),
    exteriorColor: vehicle.exteriorColor ?? "",
    id: vehicle.id || `bulk-${Date.now()}`,
    isFeatured: vehicle.isFeatured !== false,
    mileageLabel: vehicle.mileageLabel || "",
    priceLabel,
    status: vehicle.status ?? (hasListedPrice(priceLabel) ? "available" : "incoming"),
    type: vehicle.type ?? "used",
    year: Number(vehicle.year) || new Date().getFullYear(),
  };
}

function stripBulkFields(vehicle: BulkVehicle): Vehicle {
  return {
    claimStatus: vehicle.claimStatus,
    className: vehicle.className,
    deletedAt: vehicle.deletedAt,
    details: vehicle.details,
    drivetrain: vehicle.drivetrain,
    exteriorColor: vehicle.exteriorColor,
    fuel: vehicle.fuel,
    highlights: vehicle.highlights,
    id: vehicle.id,
    imageUrls: vehicle.imageUrls,
    isFeatured: vehicle.isFeatured,
    make: vehicle.make,
    mileageLabel: vehicle.mileageLabel,
    model: vehicle.model,
    priceLabel: vehicle.priceLabel,
    sourceVehicle: vehicle.sourceVehicle,
    status: vehicle.status,
    stockNumber: vehicle.stockNumber,
    transmission: vehicle.transmission,
    trim: vehicle.trim,
    type: vehicle.type,
    vehiclePhotos: vehicle.vehiclePhotos,
    vin: vehicle.vin,
    year: vehicle.year,
  };
}

function getPublishSummary(
  baselineVehicles: Vehicle[],
  currentVehicles: BulkVehicle[],
): PublishSummary {
  const baselineByKey = new Map(
    baselineVehicles.map((vehicle) => [getVehicleChangeKey(vehicle), vehicle]),
  );
  const currentByKey = new Map(
    currentVehicles.map((vehicle) => [getVehicleChangeKey(vehicle), vehicle]),
  );
  const added: PublishChange[] = [];
  const changed: PublishChange[] = [];
  const removed: PublishChange[] = [];

  for (const currentVehicle of currentVehicles) {
    const key = getVehicleChangeKey(currentVehicle);
    const baselineVehicle = baselineByKey.get(key);

    if (!baselineVehicle) {
      added.push({
        label: getVehicleChangeLabel(currentVehicle),
        type: "added",
      });
      continue;
    }

    const fields = getChangedFields(baselineVehicle, currentVehicle);

    if (fields.length) {
      changed.push({
        fields,
        label: getVehicleChangeLabel(currentVehicle),
        type: "changed",
      });
    }
  }

  for (const baselineVehicle of baselineVehicles) {
    const key = getVehicleChangeKey(baselineVehicle);

    if (!currentByKey.has(key)) {
      removed.push({
        label: getVehicleChangeLabel(baselineVehicle),
        type: "removed",
      });
    }
  }

  return {
    added,
    changed,
    removed,
    total: added.length + changed.length + removed.length,
  };
}

const bulkCompareFields: {
  key: keyof Vehicle;
  label: string;
}[] = [
  { key: "type", label: "New / Used" },
  { key: "status", label: "Status" },
  { key: "year", label: "Year" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "trim", label: "Trim" },
  { key: "priceLabel", label: "Price" },
  { key: "mileageLabel", label: "Mileage" },
  { key: "stockNumber", label: "Stock #" },
  { key: "vin", label: "VIN" },
  { key: "className", label: "Class" },
  { key: "exteriorColor", label: "Color" },
  { key: "drivetrain", label: "Drivetrain" },
  { key: "transmission", label: "Transmission" },
  { key: "fuel", label: "Fuel" },
  { key: "claimStatus", label: "Claim" },
  { key: "isFeatured", label: "Featured" },
  { key: "highlights", label: "Highlights" },
];

function getChangedFields(before: Vehicle, after: Vehicle) {
  return bulkCompareFields
    .filter(({ key }) => normalizeCompareValue(before[key]) !== normalizeCompareValue(after[key]))
    .map(({ label }) => label);
}

function normalizeCompareValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value ?? "").trim();
}

function getVehicleChangeKey(vehicle: Pick<Vehicle, "id" | "stockNumber" | "vin">) {
  return (
    String(vehicle.id ?? "").trim().toLowerCase() ||
    String(vehicle.stockNumber ?? "").trim().toLowerCase() ||
    String(vehicle.vin ?? "").trim().toLowerCase()
  );
}

function getVehicleChangeLabel(vehicle: Pick<Vehicle, "make" | "model" | "stockNumber" | "trim" | "year">) {
  const title = [vehicle.year || "", vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");
  const trim = vehicle.trim ? ` ${vehicle.trim}` : "";
  const stock = vehicle.stockNumber ? ` - Stock ${vehicle.stockNumber}` : "";

  return `${title || "Untitled vehicle"}${trim}${stock}`;
}

function normalizeClaimStatus(value: unknown): ClaimStatus {
  if (
    value === "no-claim" ||
    value === "minor-claim" ||
    value === "claim-over-5k" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizePriceLabel(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  if (/[a-z]/i.test(raw)) {
    return raw;
  }

  const digits = raw.replace(/[^\d]/g, "");

  if (!digits) {
    return raw;
  }

  const amount = Number(digits);

  if (!Number.isFinite(amount) || amount <= 0) {
    return raw;
  }

  return new Intl.NumberFormat("en-CA", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function hasListedPrice(value: string | undefined) {
  const text = String(value ?? "").trim();

  return Boolean(text) && !/call|ask|tbd|pricing/i.test(text);
}

async function compressScreenshotFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image file.`);
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxScreenshotSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Browser could not prepare the screenshot for upload.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", screenshotQuality),
  );

  if (!blob) {
    throw new Error(`Could not compress ${file.name}.`);
  }

  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "") || "screenshot"}.jpg`,
    {
      lastModified: Date.now(),
      type: "image/jpeg",
    },
  );
}

async function loadImage(file: File) {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return image;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
