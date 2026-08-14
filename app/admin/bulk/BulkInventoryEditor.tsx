"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClaimStatus,
  Vehicle,
  VehiclePhoto,
  VehicleType,
} from "../../data/inventory";
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
const maxVehicleImages = 40;
const maxImagesPerBulkUpload = 20;
const maxImageSizeBytes = 12_000_000;
const claimStatusOptions: { label: string; value: ClaimStatus }[] = [
  { label: "Unknown", value: "unknown" },
  { label: "No claim", value: "no-claim" },
  { label: "Minor claim", value: "minor-claim" },
  { label: "Claim over $5k", value: "claim-over-5k" },
];

const chatGptVehiclePrompt = `You are helping extract vehicle inventory for Deals with Dennis.

I will upload one or more screenshots. Read every visible vehicle and return JSON only.

Return exactly this shape:
{
  "vehicles": [
    {
      "type": "used",
      "status": "available",
      "year": 2024,
      "make": "Ford",
      "model": "F-150",
      "trim": "Lariat",
      "priceLabel": "$49,995",
      "mileageLabel": "42000",
      "stockNumber": "T12345",
      "vin": "",
      "className": "Truck",
      "exteriorColor": "White",
      "drivetrain": "4x4",
      "transmission": "Auto",
      "fuel": "Gasoline",
      "claimStatus": "unknown",
      "highlights": "",
      "details": ""
    }
  ]
}

Rules:
- Return JSON only. Do not wrap it in markdown.
- If a real price is visible, status is "available".
- If price is missing, CALL, TBD, or Ask for pricing, status is "incoming".
- type must be "new" or "used". Default to "used" if unclear.
- claimStatus must be one of: "unknown", "no-claim", "minor-claim", "claim-over-5k".
- drivetrain should be FWD, RWD, AWD, 4x4, Other, or empty.
- transmission should be Manual, Auto, Other, or empty.
- fuel should be Diesel, Gasoline, Hybrid, EV, PHEV, Other, or empty.
- className should be SUV, Crossover, Sedan, Coupe, Hatchback, Wagon, Convertible, Truck, Pickup Truck, Van, Minivan, Cargo Van, Passenger Van, Commercial, Chassis Cab, Other, or empty.
- mileageLabel should contain digits only. Do not include "km" or commas.
- Unknown fields should be empty strings, except year can be 0.`;

type BulkColumnKey =
  | "featured"
  | "type"
  | "status"
  | "year"
  | "make"
  | "model"
  | "trim"
  | "price"
  | "mileage"
  | "stock"
  | "vin"
  | "class"
  | "color"
  | "drivetrain"
  | "transmission"
  | "fuel"
  | "claim"
  | "highlights";

const bulkColumnOptions: { key: BulkColumnKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "type", label: "New / Used" },
  { key: "status", label: "Status" },
  { key: "year", label: "Year" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "trim", label: "Trim" },
  { key: "price", label: "Price" },
  { key: "mileage", label: "Mileage" },
  { key: "stock", label: "Stock #" },
  { key: "vin", label: "VIN" },
  { key: "class", label: "Class" },
  { key: "color", label: "Color" },
  { key: "drivetrain", label: "Drivetrain" },
  { key: "transmission", label: "Transmission" },
  { key: "fuel", label: "Fuel" },
  { key: "claim", label: "Claim" },
  { key: "highlights", label: "Highlights" },
];

const defaultVisibleColumns: BulkColumnKey[] = [
  "featured",
  "type",
  "status",
  "year",
  "make",
  "model",
  "trim",
  "price",
  "mileage",
  "stock",
  "class",
  "color",
  "drivetrain",
  "fuel",
  "claim",
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const tableScrollTopRef = useRef<HTMLDivElement | null>(null);
  const tableScrollBottomRef = useRef<HTMLDivElement | null>(null);
  const [baselineVehicles, setBaselineVehicles] = useState<Vehicle[]>(initialVehicles);
  const [vehicles, setVehicles] = useState<BulkVehicle[]>(() =>
    initialVehicles.map((vehicle) => ({ ...vehicle, isDirty: false })),
  );
  const [notice, setNotice] = useState("");
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isChatGptModalOpen, setIsChatGptModalOpen] = useState(false);
  const [chatGptResult, setChatGptResult] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedImageVehicleId, setSelectedImageVehicleId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<BulkColumnKey>>(
    () => new Set(defaultVisibleColumns),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const selectedImageVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedImageVehicleId) ?? null,
    [selectedImageVehicleId, vehicles],
  );
  const selectedImageVehiclePhotos = useMemo(
    () => getVehiclePhotos(selectedImageVehicle),
    [selectedImageVehicle],
  );

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
  const bulkTableMinWidth = Math.max(760, visibleColumns.size * 190 + 240);

  function syncTableScroll(source: "bottom" | "top") {
    const from = source === "top" ? tableScrollTopRef.current : tableScrollBottomRef.current;
    const to = source === "top" ? tableScrollBottomRef.current : tableScrollTopRef.current;

    if (!from || !to || to.scrollLeft === from.scrollLeft) {
      return;
    }

    to.scrollLeft = from.scrollLeft;
  }

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

  function toggleColumn(key: BulkColumnKey) {
    setVisibleColumns((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function isColumnVisible(key: BulkColumnKey) {
    return visibleColumns.has(key);
  }

  function showAllColumns() {
    setVisibleColumns(new Set(bulkColumnOptions.map((column) => column.key)));
  }

  function showCoreColumns() {
    setVisibleColumns(new Set(defaultVisibleColumns));
  }

  async function copyChatGptPrompt() {
    try {
      await navigator.clipboard.writeText(chatGptVehiclePrompt);
      setNotice("ChatGPT prompt copied. Upload screenshots to ChatGPT, then paste the returned JSON here.");
    } catch (error) {
      setNotice(`Could not copy prompt automatically: ${getErrorMessage(error)}`);
    }
  }

  function importChatGptResult() {
    let extractedVehicles: ExtractedVehicle[];

    try {
      extractedVehicles = parseChatGptVehicleResult(chatGptResult);
    } catch (error) {
      setNotice(`ChatGPT import failed: ${getErrorMessage(error)}`);
      return;
    }

    if (!extractedVehicles.length) {
      setNotice("ChatGPT import failed: no vehicle rows were found in the pasted result.");
      return;
    }

    const importedVehicles = extractedVehicles.map((vehicle) =>
      normalizeBulkVehicle({
        ...blankVehicle,
        ...vehicle,
        id: vehicle.id || `chatgpt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        isDirty: true,
      }),
    );

    setVehicles((current) => [...importedVehicles, ...current]);
    setHasUnsavedChanges(true);
    setChatGptResult("");
    setIsChatGptModalOpen(false);
    setNotice(
      `Imported ${importedVehicles.length} draft row${importedVehicles.length === 1 ? "" : "s"} from ChatGPT. Review before publishing.`,
    );
  }

  async function uploadBulkVehicleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!selectedImageVehicleId) {
      setNotice("Choose a vehicle row before uploading images.");
      return;
    }

    await uploadBulkVehicleImageFiles(selectedImageVehicleId, files);
  }

  async function uploadBulkVehicleImageFiles(id: string, files: File[]) {
    if (!files.length) {
      return;
    }

    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = getVehiclePhotos(vehicle);
    const openSlots = maxVehicleImages - currentPhotos.length;

    if (openSlots <= 0) {
      setNotice("This vehicle already has the 40 image maximum.");
      return;
    }

    const acceptedFiles = files
      .filter(isAllowedImageFile)
      .slice(0, Math.min(openSlots, maxImagesPerBulkUpload));

    if (!acceptedFiles.length) {
      setNotice("Image upload failed: choose JPG, PNG, WebP, GIF, HEIC, or HEIF files.");
      return;
    }

    const oversized = acceptedFiles.find((file) => file.size > maxImageSizeBytes);

    if (oversized) {
      setNotice(
        `Image upload failed: ${oversized.name} is ${formatBytes(oversized.size)}. Maximum is ${formatBytes(maxImageSizeBytes)} per image.`,
      );
      return;
    }

    setNotice(`Preparing ${acceptedFiles.length} image${acceptedFiles.length === 1 ? "" : "s"}...`);

    let response: Response;

    try {
      response = await fetch("/api/admin/images", {
        body: JSON.stringify({
          files: acceptedFiles.map((file) => ({
            contentType: file.type || getImageContentType(file.name),
            fileName: file.name,
            fileSize: file.size,
          })),
          vehicleId: id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      setNotice(`Image upload failed before reaching the server: ${getErrorMessage(error)}`);
      return;
    }

    if (!response.ok) {
      setNotice(await readErrorMessage(response, "Image upload failed."));
      return;
    }

    const result = (await response.json()) as {
      imageUrls?: string[];
      mode?: string;
      uploads?: {
        imageUrl?: string;
        signedUrl?: string;
      }[];
    };
    const uploads = result.uploads ?? [];
    const imageUrls: string[] = [...(result.imageUrls ?? [])];

    for (let index = 0; index < uploads.length; index += 1) {
      const upload = uploads[index];
      const file = acceptedFiles[index];

      if (!upload.signedUrl || !upload.imageUrl || !file) {
        setNotice(`Image upload failed: missing upload URL for ${file?.name ?? "file"}.`);
        return;
      }

      setNotice(`Uploading ${file.name} (${index + 1}/${uploads.length})...`);

      const uploadForm = new FormData();
      uploadForm.append("cacheControl", "3600");
      uploadForm.append("", file);

      const uploadResponse = await fetch(upload.signedUrl, {
        body: uploadForm,
        headers: { "x-upsert": "false" },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        setNotice(
          await readErrorMessage(
            uploadResponse,
            `Image upload failed while sending ${file.name} to Supabase.`,
          ),
        );
        return;
      }

      imageUrls.push(upload.imageUrl);
    }

    const nextPhotos = [
      ...currentPhotos,
      ...imageUrls.map((imageUrl) => createVehiclePhoto(imageUrl)),
    ];

    updateVehicle(id, {
      imageUrls: nextPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: nextPhotos,
    });
    setNotice(
      `Added ${imageUrls.length} image${imageUrls.length === 1 ? "" : "s"}. Publish to Inventory to save the image order and cover.`,
    );
  }

  function removeBulkVehicleImage(id: string, imageIndex: number) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = getVehiclePhotos(vehicle);
    const nextPhotos = currentPhotos.filter((_, index) => index !== imageIndex);

    updateVehicle(id, {
      imageUrls: nextPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: nextPhotos,
    });
    setNotice("Image removed from this row. Publish to Inventory to save.");
  }

  function setBulkCoverImage(id: string, imageIndex: number) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = [...getVehiclePhotos(vehicle)];
    const [selected] = currentPhotos.splice(imageIndex, 1);

    if (!selected) {
      return;
    }

    const nextPhotos = [selected, ...currentPhotos];

    updateVehicle(id, {
      imageUrls: nextPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: nextPhotos,
    });
    setNotice("Cover image updated. Publish to Inventory to save.");
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
          <button
            className="button secondary"
            onClick={() => setIsChatGptModalOpen(true)}
            type="button"
          >
            Prepare for ChatGPT
          </button>
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

      <div className="bulk-column-panel">
        <div>
          <p className="eyebrow">Visible columns</p>
          <strong>{visibleColumns.size} shown</strong>
        </div>
        <div className="bulk-column-actions">
          <button className="button secondary" onClick={showCoreColumns} type="button">
            Core
          </button>
          <button className="button secondary" onClick={showAllColumns} type="button">
            Show All
          </button>
        </div>
        <div className="bulk-column-options">
          {bulkColumnOptions.map((column) => (
            <label key={column.key}>
              <input
                checked={visibleColumns.has(column.key)}
                onChange={() => toggleColumn(column.key)}
                type="checkbox"
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div
        className="bulk-table-scroll-top"
        onScroll={() => syncTableScroll("top")}
        ref={tableScrollTopRef}
      >
        <div style={{ width: `${bulkTableMinWidth}px` }} />
      </div>

      <div
        className="bulk-table-wrap"
        onScroll={() => syncTableScroll("bottom")}
        ref={tableScrollBottomRef}
      >
        <table
          className={`bulk-table ${visibleColumns.size <= 6 ? "is-compact" : ""}`}
          style={{ minWidth: `${bulkTableMinWidth}px` }}
        >
          <thead>
            <tr>
              {isColumnVisible("featured") ? <th>Featured</th> : null}
              {isColumnVisible("type") ? <th>Type</th> : null}
              {isColumnVisible("status") ? <th>Status</th> : null}
              {isColumnVisible("year") ? <th>Year</th> : null}
              {isColumnVisible("make") ? <th>Make</th> : null}
              {isColumnVisible("model") ? <th>Model</th> : null}
              {isColumnVisible("trim") ? <th>Trim</th> : null}
              {isColumnVisible("price") ? <th>Price</th> : null}
              {isColumnVisible("mileage") ? <th>Mileage</th> : null}
              {isColumnVisible("stock") ? <th>Stock #</th> : null}
              {isColumnVisible("vin") ? <th>VIN</th> : null}
              {isColumnVisible("class") ? <th>Class</th> : null}
              {isColumnVisible("color") ? <th>Color</th> : null}
              {isColumnVisible("drivetrain") ? <th>Drivetrain</th> : null}
              {isColumnVisible("transmission") ? <th>Trans.</th> : null}
              {isColumnVisible("fuel") ? <th>Fuel</th> : null}
              {isColumnVisible("claim") ? <th>Claim</th> : null}
              {isColumnVisible("highlights") ? <th>Highlights</th> : null}
              <th>Images</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((vehicle) => (
              <tr key={vehicle.id} className={vehicle.isDirty ? "is-dirty" : ""}>
                {isColumnVisible("featured") ? (
                  <td>
                    <input
                      checked={vehicle.isFeatured !== false}
                      onChange={(event) =>
                        updateVehicle(vehicle.id, { isFeatured: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                ) : null}
                {isColumnVisible("type") ? (
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
                ) : null}
                {isColumnVisible("status") ? (
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
                ) : null}
                {isColumnVisible("year") ? (
                  <EditableCell
                    inputMode="numeric"
                    onChange={(value) => updateVehicle(vehicle.id, { year: Number(value) || 0 })}
                    value={String(vehicle.year || "")}
                  />
                ) : null}
                {isColumnVisible("make") ? (
                  <EditableCell onChange={(value) => updateVehicle(vehicle.id, { make: value })} value={vehicle.make} />
                ) : null}
                {isColumnVisible("model") ? (
                  <EditableCell onChange={(value) => updateVehicle(vehicle.id, { model: value })} value={vehicle.model} />
                ) : null}
                {isColumnVisible("trim") ? (
                  <EditableCell onChange={(value) => updateVehicle(vehicle.id, { trim: value })} value={vehicle.trim} />
                ) : null}
                {isColumnVisible("price") ? (
                  <EditableCell
                    inputMode="numeric"
                    onBlur={(value) =>
                      updateVehicle(vehicle.id, { priceLabel: normalizePriceLabel(value) })
                    }
                    onChange={(value) => updateVehicle(vehicle.id, { priceLabel: value })}
                    value={vehicle.priceLabel}
                  />
                ) : null}
                {isColumnVisible("mileage") ? (
                  <EditableCell
                    onChange={(value) => updateVehicle(vehicle.id, { mileageLabel: value })}
                    value={vehicle.mileageLabel}
                  />
                ) : null}
                {isColumnVisible("stock") ? (
                  <EditableCell
                    onChange={(value) => updateVehicle(vehicle.id, { stockNumber: value })}
                    value={vehicle.stockNumber ?? ""}
                  />
                ) : null}
                {isColumnVisible("vin") ? (
                  <EditableCell
                    onChange={(value) => updateVehicle(vehicle.id, { vin: value })}
                    value={vehicle.vin ?? ""}
                  />
                ) : null}
                {isColumnVisible("class") ? (
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
                ) : null}
                {isColumnVisible("color") ? (
                  <EditableCell
                    onChange={(value) => updateVehicle(vehicle.id, { exteriorColor: value })}
                    value={vehicle.exteriorColor}
                  />
                ) : null}
                {isColumnVisible("drivetrain") ? (
                  <SelectCell
                    onChange={(value) => updateVehicle(vehicle.id, { drivetrain: value })}
                    options={drivetrainOptions}
                    value={vehicle.drivetrain ?? ""}
                  />
                ) : null}
                {isColumnVisible("transmission") ? (
                  <SelectCell
                    onChange={(value) => updateVehicle(vehicle.id, { transmission: value })}
                    options={transmissionOptions}
                    value={vehicle.transmission ?? ""}
                  />
                ) : null}
                {isColumnVisible("fuel") ? (
                  <SelectCell
                    onChange={(value) => updateVehicle(vehicle.id, { fuel: value })}
                    options={fuelOptions}
                    value={vehicle.fuel ?? ""}
                  />
                ) : null}
                {isColumnVisible("claim") ? (
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
                ) : null}
                {isColumnVisible("highlights") ? (
                  <EditableCell
                    className="wide-cell"
                    onChange={(value) => updateVehicle(vehicle.id, { highlights: value })}
                    value={vehicle.highlights ?? ""}
                  />
                ) : null}
                <td>
                  <button
                    className="bulk-image-button"
                    onClick={() => setSelectedImageVehicleId(vehicle.id)}
                    type="button"
                  >
                    Images {getVehiclePhotos(vehicle).length}/{maxVehicleImages}
                  </button>
                </td>
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

      {selectedImageVehicle ? (
        <div
          aria-label="Manage row images"
          aria-modal="true"
          className="bulk-confirm-modal"
          role="dialog"
        >
          <div
            className="bulk-confirm-backdrop"
            onClick={() => setSelectedImageVehicleId(null)}
          />
          <div className="bulk-confirm-dialog bulk-image-dialog">
            <div className="bulk-confirm-head">
              <div>
                <p className="eyebrow">Images</p>
                <h3>{getVehicleChangeLabel(selectedImageVehicle)}</h3>
                <p>
                  {selectedImageVehiclePhotos.length} / {maxVehicleImages} uploaded
                </p>
              </div>
              <button
                aria-label="Close image manager"
                className="vehicle-modal-close"
                onClick={() => setSelectedImageVehicleId(null)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="bulk-image-toolbar">
              <button
                className="button secondary"
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                Upload Images
              </button>
              <input
                accept="image/*"
                className="admin-file-input"
                multiple
                onChange={uploadBulkVehicleImages}
                ref={imageInputRef}
                type="file"
              />
            </div>

            <div
              className="image-drop-zone"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => {
                event.preventDefault();
                void uploadBulkVehicleImageFiles(
                  selectedImageVehicle.id,
                  Array.from(event.dataTransfer.files),
                );
              }}
            >
              <strong>Drop photos here</strong>
              <span>JPG, PNG, WebP, HEIC up to 12 MB each. Up to 20 photos per upload.</span>
            </div>

            {selectedImageVehiclePhotos.length ? (
              <div className="image-grid bulk-image-grid">
                {selectedImageVehiclePhotos.map((photo, index) => (
                  <div className="image-tile" key={`${photo.id ?? photo.originalUrl}-${index}`}>
                    <img alt="" src={getPublicPhotoUrl(photo)} />
                    <div className="image-drag-handle">
                      <span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
                      <small>{photoStatusLabel(photo)}</small>
                    </div>
                    {photo.watermarkError ? (
                      <p className="image-error">{photo.watermarkError}</p>
                    ) : null}
                    <div className="image-actions">
                      <button
                        onClick={() => setBulkCoverImage(selectedImageVehicle.id, index)}
                        type="button"
                      >
                        {index === 0 ? "Cover" : "Make Cover"}
                      </button>
                      <button
                        onClick={() => removeBulkVehicleImage(selectedImageVehicle.id, index)}
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
                No images yet. Upload or drop photos here, then publish the bulk table.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {isChatGptModalOpen ? (
        <div
          aria-label="Prepare ChatGPT import"
          aria-modal="true"
          className="bulk-confirm-modal"
          role="dialog"
        >
          <div
            className="bulk-confirm-backdrop"
            onClick={() => setIsChatGptModalOpen(false)}
          />
          <div className="bulk-confirm-dialog chatgpt-import-dialog">
            <div className="bulk-confirm-head">
              <div>
                <p className="eyebrow">No API needed</p>
                <h3>Prepare for ChatGPT</h3>
              </div>
              <button
                aria-label="Close ChatGPT import"
                className="vehicle-modal-close"
                onClick={() => setIsChatGptModalOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="chatgpt-import-grid">
              <section className="chatgpt-import-panel">
                <div>
                  <strong>1. Copy this prompt</strong>
                  <p>Open ChatGPT, paste this prompt, then upload your screenshots there.</p>
                </div>
                <textarea readOnly value={chatGptVehiclePrompt} />
                <div className="chatgpt-import-actions">
                  <button className="button secondary" onClick={copyChatGptPrompt} type="button">
                    Copy Prompt
                  </button>
                  <a
                    className="button primary"
                    href="https://chatgpt.com/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open ChatGPT
                  </a>
                </div>
              </section>

              <section className="chatgpt-import-panel">
                <div>
                  <strong>2. Paste ChatGPT result</strong>
                  <p>Paste the JSON response here. Imported rows stay as drafts until publishing.</p>
                </div>
                <textarea
                  onChange={(event) => setChatGptResult(event.target.value)}
                  placeholder='{"vehicles":[{"year":2024,"make":"Ford","model":"F-150"}]}'
                  value={chatGptResult}
                />
                <div className="chatgpt-import-actions">
                  <button
                    className="button secondary"
                    onClick={() => setIsChatGptModalOpen(false)}
                    type="button"
                  >
                    Close
                  </button>
                  <button
                    className="button primary"
                    disabled={!chatGptResult.trim()}
                    onClick={importChatGptResult}
                    type="button"
                  >
                    Import Rows
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

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

function parseChatGptVehicleResult(value: string): ExtractedVehicle[] {
  const cleaned = stripCodeFence(value.trim());

  if (!cleaned) {
    return [];
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { vehicles?: unknown }).vehicles)
        ? (parsed as { vehicles: unknown[] }).vehicles
        : [];

    return rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map(normalizeImportedVehicle);
  } catch {
    return parseDelimitedVehicleResult(cleaned);
  }
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json|csv)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseDelimitedVehicleResult(value: string): ExtractedVehicle[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Paste JSON from ChatGPT, or CSV with a header row.");
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter).map(normalizeImportKey);

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return normalizeImportedVehicle(row);
  });
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());

  return values;
}

function normalizeImportedVehicle(row: Record<string, unknown>): ExtractedVehicle {
  const priceLabel = getImportedValue(row, "priceLabel", "price", "retail", "askingPrice");
  const normalizedPrice = normalizePriceLabel(priceLabel);

  return {
    claimStatus: normalizeImportedClaim(
      getImportedValue(row, "claimStatus", "claim", "claims", "accident"),
    ),
    className: getImportedValue(row, "className", "class", "bodyStyle", "body", "vehicleClass"),
    details: getImportedValue(row, "details", "description", "notes"),
    drivetrain: normalizeImportedOption(
      getImportedValue(row, "drivetrain", "driveTrain", "drive"),
      drivetrainOptions,
    ),
    exteriorColor: getImportedValue(row, "exteriorColor", "color", "colour", "exteriorColour"),
    fuel: normalizeImportedOption(getImportedValue(row, "fuel", "fuelType"), fuelOptions),
    highlights: getImportedValue(row, "highlights", "highlight"),
    make: getImportedValue(row, "make", "brand"),
    mileageLabel: normalizeMileageLabel(getImportedValue(row, "mileageLabel", "mileage", "km")),
    model: getImportedValue(row, "model"),
    priceLabel: normalizedPrice,
    status: normalizeImportedStatus(getImportedValue(row, "status"), normalizedPrice),
    stockNumber: getImportedValue(row, "stockNumber", "stock", "stock #", "stockNo"),
    transmission: normalizeImportedOption(
      getImportedValue(row, "transmission", "trans"),
      transmissionOptions,
    ),
    trim: getImportedValue(row, "trim"),
    type: normalizeImportedType(getImportedValue(row, "type", "condition", "newUsed")),
    vin: getImportedValue(row, "vin"),
    year: Number(getImportedValue(row, "year")) || 0,
  };
}

function getImportedValue(row: Record<string, unknown>, ...keys: string[]) {
  const normalizedRow = new Map(
    Object.entries(row).map(([key, value]) => [normalizeImportKey(key), value]),
  );

  for (const key of keys) {
    const value = normalizedRow.get(normalizeImportKey(key));
    const text = String(value ?? "").trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeImportKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeImportedType(value: string): VehicleType {
  return /new/i.test(value) ? "new" : "used";
}

function normalizeImportedStatus(value: string, priceLabel: string): Vehicle["status"] {
  if (/sold/i.test(value)) {
    return "sold";
  }

  if (/available|active|in stock/i.test(value)) {
    return "available";
  }

  if (/incoming|coming|call|ask|tbd/i.test(value)) {
    return "incoming";
  }

  return hasListedPrice(priceLabel) ? "available" : "incoming";
}

function normalizeImportedClaim(value: string): ClaimStatus {
  const text = value.toLowerCase();

  if (/over|5k|\$5|major/.test(text)) {
    return "claim-over-5k";
  }

  if (/minor/.test(text)) {
    return "minor-claim";
  }

  if (/no claim|no accident|clean|none/.test(text)) {
    return "no-claim";
  }

  return normalizeClaimStatus(value);
}

function normalizeImportedOption(value: string, options: string[]) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  const exactMatch = options.find((option) => option.toLowerCase() === text.toLowerCase());

  if (exactMatch) {
    return exactMatch;
  }

  if (/all wheel|awd/i.test(text)) {
    return "AWD";
  }

  if (/four|4x4|4wd/i.test(text)) {
    return "4x4";
  }

  if (/front|fwd/i.test(text)) {
    return "FWD";
  }

  if (/rear|rwd/i.test(text)) {
    return "RWD";
  }

  if (/automatic|auto|dct/i.test(text)) {
    return "Auto";
  }

  if (/manual/i.test(text)) {
    return "Manual";
  }

  if (/gas|petrol/i.test(text)) {
    return "Gasoline";
  }

  if (/diesel/i.test(text)) {
    return "Diesel";
  }

  if (/plug|phev/i.test(text)) {
    return "PHEV";
  }

  if (/electric|ev/i.test(text)) {
    return "EV";
  }

  if (/hybrid/i.test(text)) {
    return "Hybrid";
  }

  return options.includes("Other") ? "Other" : text;
}

function normalizeMileageLabel(value: string) {
  const raw = value.trim();

  if (!raw) {
    return "";
  }

  const digits = raw.replace(/[^\d]/g, "");

  return digits || raw;
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
  { key: "imageUrls", label: "Images" },
  { key: "vehiclePhotos", label: "Photos" },
];

function getChangedFields(before: Vehicle, after: Vehicle) {
  return bulkCompareFields
    .filter(({ key }) => normalizeCompareValue(before[key]) !== normalizeCompareValue(after[key]))
    .map(({ label }) => label);
}

function normalizeCompareValue(value: unknown) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value ?? null);
  }

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

function getVehiclePhotos(vehicle: Partial<BulkVehicle> | undefined | null) {
  const photos = Array.isArray(vehicle?.vehiclePhotos)
    ? vehicle.vehiclePhotos
        .map((photo, index) => normalizeVehiclePhoto(photo, index))
        .filter((photo): photo is VehiclePhoto => Boolean(photo))
    : [];

  if (photos.length) {
    return photos;
  }

  return (vehicle?.imageUrls ?? [])
    .filter(Boolean)
    .map((imageUrl) => createVehiclePhoto(imageUrl));
}

function createVehiclePhoto(originalUrl: string): VehiclePhoto {
  return {
    id: `photo-${Date.now()}-${hashText(originalUrl)}`,
    originalUrl,
    watermarkStatus: "idle",
  };
}

function normalizeVehiclePhoto(photo: VehiclePhoto, index: number): VehiclePhoto | null {
  const originalUrl = String(photo.originalUrl ?? "").trim();

  if (!originalUrl) {
    return null;
  }

  return {
    id: String(photo.id ?? `photo-${index}-${hashText(originalUrl)}`),
    originalUrl,
    watermarkError: String(photo.watermarkError ?? "") || undefined,
    watermarkedUrl: String(photo.watermarkedUrl ?? "") || undefined,
    watermarkStatus: normalizeWatermarkStatus(photo.watermarkStatus),
  };
}

function normalizeWatermarkStatus(
  value: VehiclePhoto["watermarkStatus"],
): VehiclePhoto["watermarkStatus"] {
  if (value === "processing" || value === "done" || value === "failed") {
    return value;
  }

  return "idle";
}

function getPublicPhotoUrl(photo: VehiclePhoto) {
  return photo.watermarkedUrl || photo.originalUrl;
}

function photoStatusLabel(photo: VehiclePhoto) {
  if (photo.watermarkStatus === "processing") return "Watermarking";
  if (photo.watermarkStatus === "failed") return "Watermark failed";
  if (photo.watermarkedUrl) return "Watermarked";

  return "Original";
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function getImageContentType(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  if (lowerName.endsWith(".heic")) return "image/heic";
  if (lowerName.endsWith(".heif")) return "image/heif";

  return "image/jpeg";
}

function isAllowedImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(file.name)
  );
}
