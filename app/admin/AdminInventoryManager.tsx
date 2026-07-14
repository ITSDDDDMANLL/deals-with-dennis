"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";

type EditableVehicle = Vehicle & {
  isFeatured?: boolean;
};

const maxVehicleImages = 20;
const maxImageSizeBytes = 12_000_000;

const blankVehicle: EditableVehicle = {
  id: "new-vehicle",
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
  details: "",
  highlights: "",
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
] as const;

type EditableField = (typeof editableFields)[number];

const claimStatusOptions: { label: string; value: ClaimStatus }[] = [
  { label: "Unknown / not listed", value: "unknown" },
  { label: "No claim", value: "no-claim" },
  { label: "Minor claim", value: "minor-claim" },
  { label: "Claim over $5k", value: "claim-over-5k" },
];
const drivetrainOptions = ["FWD", "RWD", "AWD", "4x4"];
const transmissionOptions = ["Manual", "Auto"];
const fuelOptions = ["Diesel", "Gasoline", "Hybrid", "EV", "PHEV"];

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
  const [adminSearch, setAdminSearch] = useState("");
  const [adminTypeFilter, setAdminTypeFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminFeaturedFilter, setAdminFeaturedFilter] = useState("all");
  const [adminYearFilter, setAdminYearFilter] = useState("all");
  const [adminMakeFilter, setAdminMakeFilter] = useState("all");
  const [deletedVehicles, setDeletedVehicles] = useState<EditableVehicle[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const vehicleImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadInventory();
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0],
    [selectedId, vehicles],
  );
  const adminYearOptions = useMemo(
    () => uniqueAdminValues(vehicles.map((vehicle) => vehicle.year)).sort(
      (a, b) => Number(b) - Number(a),
    ),
    [vehicles],
  );
  const adminMakeOptions = useMemo(
    () => uniqueAdminValues(vehicles.map((vehicle) => vehicle.make)),
    [vehicles],
  );
  const filteredAdminVehicles = useMemo(() => {
    const searchNeedle = adminSearch.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const searchMatches =
        !searchNeedle ||
        [
          vehicle.year,
          vehicle.make,
          vehicle.model,
          vehicle.trim,
          vehicle.stockNumber,
          vehicle.vin,
          vehicle.className,
          vehicle.exteriorColor,
          vehicle.drivetrain,
          vehicle.transmission,
          vehicle.fuel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchNeedle);
      const typeMatches =
        adminTypeFilter === "all" || vehicle.type === adminTypeFilter;
      const statusMatches =
        adminStatusFilter === "all" || vehicle.status === adminStatusFilter;
      const featuredMatches =
        adminFeaturedFilter === "all" ||
        (adminFeaturedFilter === "yes"
          ? vehicle.isFeatured !== false
          : vehicle.isFeatured === false);
      const yearMatches =
        adminYearFilter === "all" || String(vehicle.year) === adminYearFilter;
      const makeMatches =
        adminMakeFilter === "all" || vehicle.make === adminMakeFilter;

      return (
        searchMatches &&
        typeMatches &&
        statusMatches &&
        featuredMatches &&
        yearMatches &&
        makeMatches
      );
    });
  }, [
    adminFeaturedFilter,
    adminMakeFilter,
    adminSearch,
    adminStatusFilter,
    adminTypeFilter,
    adminYearFilter,
    vehicles,
  ]);

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

    const acceptedFiles = files.filter(isAllowedImageFile).slice(0, openSlots);

    if (!acceptedFiles.length) {
      setNotice("Please choose image files from your photo library.");
      return;
    }

    const oversized = acceptedFiles.find(
      (file) => file.size > maxImageSizeBytes,
    );

    if (oversized) {
      setNotice("Each image must be 12 MB or smaller.");
      return;
    }

    setNotice(`Uploading ${acceptedFiles.length} image${acceptedFiles.length === 1 ? "" : "s"}...`);

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

  function reorderVehicleImage(
    id: string,
    fromIndex: number | null,
    toIndex: number,
  ) {
    if (fromIndex === null || fromIndex === toIndex) {
      setDraggedImageIndex(null);
      return;
    }

    const vehicle = vehicles.find((item) => item.id === id);
    const currentImages = [...(vehicle?.imageUrls ?? [])];
    const [movedImage] = currentImages.splice(fromIndex, 1);

    if (!movedImage) {
      setDraggedImageIndex(null);
      return;
    }

    currentImages.splice(toIndex, 0, movedImage);
    updateVehicle(id, { imageUrls: currentImages });
    setDraggedImageIndex(null);
    setNotice("Image order updated. Click Save Vehicles to publish it.");
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

  async function saveVehiclesOnly() {
    setSaving(true);

    const inventoryResponse = await fetch("/api/admin/inventory", {
      body: JSON.stringify({ vehicles }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    if (!inventoryResponse.ok) {
      const result = (await inventoryResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Vehicle save failed.");
      setSaving(false);
      return;
    }

    const inventoryResult = (await inventoryResponse.json()) as {
      mode?: string;
      count?: number;
      deleted?: number;
    };
    const deletedCount = inventoryResult.deleted ?? deletedVehicles.length;

    setNotice(
      inventoryResult.mode === "supabase"
        ? `Saved ${inventoryResult.count ?? vehicles.length} vehicles to Supabase${deletedCount ? `, including ${deletedCount} deletion${deletedCount === 1 ? "" : "s"}` : ""}.`
        : "Vehicle save did not reach Supabase. Check server environment variables.",
    );
    setDeletedVehicles([]);
    setSaving(false);
  }

  async function reloadVehicles() {
    await loadInventory();
    setDeletedVehicles([]);
    setNotice("Vehicles reloaded from Supabase.");
  }

  function addVehicle() {
    const id = `vehicle-${Date.now()}`;
    const next = { ...blankVehicle, id };
    setVehicles((current) => [next, ...current]);
    setSelectedId(id);
    setNotice("New vehicle added. Click Save Vehicles to publish it.");
  }

  function removeVehicle(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);

    if (!vehicle) {
      return;
    }

    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
    const confirmed = window.confirm(
      `Remove ${vehicleName || "this vehicle"} from inventory? It will move to Pending deletions until you save vehicles.`,
    );

    if (!confirmed) {
      return;
    }

    setVehicles((current) => {
      const next = current.filter((vehicle) => vehicle.id !== id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
    setDeletedVehicles((current) =>
      current.some((deleted) => deleted.id === id) ? current : [vehicle, ...current],
    );
    setNotice(
      "Vehicle moved to Pending deletions. Click Save Vehicles to delete it from Supabase.",
    );
  }

  function restoreVehicle(id: string) {
    const vehicle = deletedVehicles.find((item) => item.id === id);

    if (!vehicle) {
      return;
    }

    setVehicles((current) =>
      current.some((item) => item.id === id) ? current : [vehicle, ...current],
    );
    setDeletedVehicles((current) => current.filter((item) => item.id !== id));
    setSelectedId(id);
    setNotice("Vehicle restored.");
  }

  function restoreAllDeletedVehicles() {
    const confirmed = window.confirm(
      "Restore all pending deletions back to the vehicle list?",
    );

    if (!confirmed) {
      return;
    }

    setVehicles((current) => {
      const currentIds = new Set(current.map((vehicle) => vehicle.id));
      const vehiclesToRestore = deletedVehicles.filter(
        (vehicle) => !currentIds.has(vehicle.id),
      );

      return [...vehiclesToRestore, ...current];
    });
    setDeletedVehicles([]);
    setNotice("All pending deletions were restored.");
  }

  function exportVehicles() {
    const blob = new Blob([JSON.stringify(vehicles, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory-export.json";
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
    setDeletedVehicles([]);
    setNotice(`Imported ${normalized.length} vehicles. Click Save Vehicles to publish them.`);
    event.target.value = "";
  }

  return (
    <section className="admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Supabase inventory</p>
          <h2>{vehicles.length} vehicles</h2>
        </div>
        <div className="admin-actions">
          <label className="button secondary file-button">
            Import CSV/JSON
            <input accept=".csv,.json" onChange={importFile} type="file" />
          </label>
          <button className="button secondary" onClick={exportVehicles} type="button">
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
            onClick={saveVehiclesOnly}
            type="button"
          >
            {saving ? "Saving..." : "Save Vehicles"}
          </button>
        </div>
      </div>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="admin-workspace">
        <div className="admin-sidebar">
          <div className="admin-list-filters">
            <label>
              <span>Search</span>
              <input
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Search vehicles"
                type="search"
              />
            </label>
            <label>
              <span>Year</span>
              <select
                value={adminYearFilter}
                onChange={(event) => setAdminYearFilter(event.target.value)}
              >
                <option value="all">All years</option>
                {adminYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Make</span>
              <select
                value={adminMakeFilter}
                onChange={(event) => setAdminMakeFilter(event.target.value)}
              >
                <option value="all">All makes</option>
                {adminMakeOptions.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select
                value={adminTypeFilter}
                onChange={(event) => setAdminTypeFilter(event.target.value)}
              >
                <option value="all">All types</option>
                <option value="used">Used</option>
                <option value="new">New</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={adminStatusFilter}
                onChange={(event) => setAdminStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="incoming">Incoming</option>
                <option value="sold">Sold</option>
              </select>
            </label>
            <label>
              <span>Featured</span>
              <select
                value={adminFeaturedFilter}
                onChange={(event) => setAdminFeaturedFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="yes">Featured</option>
                <option value="no">Not featured</option>
              </select>
            </label>
          </div>

          <div className="admin-list" aria-label="Inventory vehicles">
            {filteredAdminVehicles.map((vehicle) => (
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
            {!filteredAdminVehicles.length ? (
              <p className="admin-empty">No vehicles match these filters.</p>
            ) : null}
          </div>

          <div className="deleted-vehicles-panel">
            <div className="deleted-vehicles-head">
              <span>Pending deletions</span>
              {deletedVehicles.length ? (
                <button onClick={restoreAllDeletedVehicles} type="button">
                  Restore All
                </button>
              ) : null}
            </div>
            {deletedVehicles.length ? (
              <div className="deleted-vehicles-list">
                {deletedVehicles.map((vehicle) => (
                  <div className="deleted-vehicle-row" key={vehicle.id}>
                    <div>
                      <strong>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </strong>
                      <small>{vehicle.stockNumber || "No stock #"}</small>
                    </div>
                    <button onClick={() => restoreVehicle(vehicle.id)} type="button">
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>No pending deletions.</p>
            )}
          </div>
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
                  <button
                    className="button secondary"
                    onClick={() => vehicleImageInputRef.current?.click()}
                    type="button"
                  >
                    Upload Images
                  </button>
                  <input
                    accept="image/*"
                    className="visually-hidden-file"
                    multiple
                    onChange={(event) =>
                      uploadVehicleImages(selectedVehicle.id, event)
                    }
                    ref={vehicleImageInputRef}
                    type="file"
                  />
                </div>

                {(selectedVehicle.imageUrls?.length ?? 0) > 0 ? (
                  <div className="image-grid">
                    {selectedVehicle.imageUrls?.map((imageUrl, index) => (
                      <div
                        className={`image-tile ${
                          draggedImageIndex === index ? "dragging" : ""
                        }`}
                        draggable
                        key={`${imageUrl}-${index}`}
                        onDragEnd={() => setDraggedImageIndex(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDragStart={() => setDraggedImageIndex(index)}
                        onDrop={(event) => {
                          event.preventDefault();
                          reorderVehicleImage(
                            selectedVehicle.id,
                            draggedImageIndex,
                            index,
                          );
                        }}
                      >
                        <img alt="" src={imageUrl} />
                        <div className="image-drag-handle">
                          <span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
                          <small>Drag to reorder</small>
                        </div>
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

              <SelectWithOther
                label="Drivetrain"
                onChange={(value) =>
                  updateVehicle(selectedVehicle.id, { drivetrain: value })
                }
                options={drivetrainOptions}
                value={selectedVehicle.drivetrain ?? ""}
              />

              <SelectWithOther
                label="Transmission"
                onChange={(value) =>
                  updateVehicle(selectedVehicle.id, { transmission: value })
                }
                options={transmissionOptions}
                value={selectedVehicle.transmission ?? ""}
              />

              <SelectWithOther
                label="Fuel"
                onChange={(value) =>
                  updateVehicle(selectedVehicle.id, { fuel: value })
                }
                options={fuelOptions}
                value={selectedVehicle.fuel ?? ""}
              />

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

              <label className="editor-wide">
                <span>Highlights</span>
                <textarea
                  value={selectedVehicle.highlights ?? ""}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      highlights: event.target.value,
                    })
                  }
                  placeholder="One highlight per line, such as No accidents, Local BC car, One owner"
                  rows={4}
                />
              </label>

              <label className="editor-wide">
                <span>Details</span>
                <textarea
                  value={selectedVehicle.details ?? ""}
                  onChange={(event) =>
                    updateVehicle(selectedVehicle.id, {
                      details: event.target.value,
                    })
                  }
                  placeholder="Describe condition, packages, service history, inspection notes, or anything customers should know."
                  rows={7}
                />
              </label>
            </div>

            <div className="admin-actions bottom-actions">
              <button className="button secondary" onClick={reloadVehicles} type="button">
                Reload Vehicles
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={saveVehiclesOnly}
                type="button"
              >
                {saving ? "Saving..." : "Save Vehicles"}
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
  };

  return labels[field];
}

function SelectWithOther({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const [isOther, setIsOther] = useState(
    Boolean(value) && !options.includes(value),
  );

  useEffect(() => {
    setIsOther(Boolean(value) && !options.includes(value));
  }, [options, value]);

  return (
    <label>
      <span>{label}</span>
      <select
        value={isOther ? "__other" : value}
        onChange={(event) => {
          if (event.target.value === "__other") {
            setIsOther(true);
            onChange(options.includes(value) ? "" : value);
            return;
          }

          setIsOther(false);
          onChange(event.target.value);
        }}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="__other">Other</option>
      </select>
      {isOther ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          type="text"
        />
      ) : null}
    </label>
  );
}

function uniqueAdminValues(values: Array<string | number | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => String(value ?? "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

function isAllowedImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(file.name)
  );
}
