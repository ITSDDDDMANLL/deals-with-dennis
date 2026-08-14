"use client";

import {
  ChangeEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ClaimStatus,
  Vehicle,
  VehiclePhoto,
  VehicleType,
} from "../data/inventory";
import { readErrorMessage } from "../utils/read-error-message";

type EditableVehicle = Vehicle & {
  isFeatured?: boolean;
};

const maxVehicleImages = 40;
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
  vehiclePhotos: [],
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
const classNameOptions = [
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
      vehiclePhotos: getVehiclePhotos(vehicle),
    })),
  );
  const [selectedId, setSelectedId] = useState(initialVehicles[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasUnsavedVehicleChanges, setHasUnsavedVehicleChanges] =
    useState(false);
  const [watermarking, setWatermarking] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminTypeFilter, setAdminTypeFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminFeaturedFilter, setAdminFeaturedFilter] = useState("all");
  const [adminYearFilter, setAdminYearFilter] = useState("all");
  const [adminMakeFilter, setAdminMakeFilter] = useState("all");
  const [deletedVehicles, setDeletedVehicles] = useState<EditableVehicle[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [photoPreviewMode, setPhotoPreviewMode] = useState<
    "original" | "watermarked"
  >("watermarked");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const vehicleImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadInventory();
  }, []);

  useEffect(() => {
    if (!hasUnsavedVehicleChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedVehicleChanges]);

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
    setHasUnsavedVehicleChanges(true);
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, ...patch } : vehicle,
      ),
    );
  }

  function closeVehicleEditor() {
    if (
      hasUnsavedVehicleChanges &&
      !window.confirm(
        "Close editor? Your changes will stay on this admin page, but they are not saved to Supabase yet. Use Save All Vehicle Changes to publish them.",
      )
    ) {
      return;
    }

    setIsEditorOpen(false);
  }

  function openVehicleEditor(id: string) {
    setSelectedId(id);
    setIsEditorOpen(true);
  }

  async function uploadVehicleImages(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    await uploadVehicleImageFiles(id, files);
  }

  async function uploadVehicleImageFiles(id: string, files: File[]) {
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
      setNotice(
        `Image upload failed before reaching the server: ${getErrorMessage(error)}`,
      );
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
        contentType?: string;
        fileName?: string;
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

      setNotice(
        `Uploading ${file.name} (${index + 1}/${uploads.length}) to Supabase...`,
      );

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
      imageUrls: [
        ...currentPhotos.map(getPublicPhotoUrl),
        ...imageUrls,
      ],
      vehiclePhotos: nextPhotos,
    });
    setNotice(
      `Added ${imageUrls.length} image${imageUrls.length === 1 ? "" : "s"}${
        result.mode === "supabase" ? " to Supabase Storage" : ""
      }. Applying watermark now...`,
    );
    await processVehicleWatermarks(id, nextPhotos, "auto");
  }

  function removeVehicleImage(id: string, imageIndex: number) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = getVehiclePhotos(vehicle);
    const nextPhotos = currentPhotos.filter((_, index) => index !== imageIndex);

    updateVehicle(id, {
      imageUrls: nextPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: nextPhotos,
    });
    setNotice("Image removed.");
  }

  function setCoverImage(id: string, imageIndex: number) {
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
    const currentPhotos = [...getVehiclePhotos(vehicle)];
    const [movedImage] = currentPhotos.splice(fromIndex, 1);

    if (!movedImage) {
      setDraggedImageIndex(null);
      return;
    }

    currentPhotos.splice(toIndex, 0, movedImage);
    updateVehicle(id, {
      imageUrls: currentPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: currentPhotos,
    });
    setDraggedImageIndex(null);
    setNotice("Image order updated. Click Save All Vehicle Changes to publish it.");
  }

  async function applyWatermarkToVehicleImages(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = getVehiclePhotos(vehicle);

    if (!currentPhotos.length) {
      setNotice("Upload original photos before applying a watermark.");
      return;
    }

    await processVehicleWatermarks(id, currentPhotos, "manual");
  }

  async function applyWatermarkToAllVehicles() {
    const vehiclesWithPhotos = vehicles.filter(
      (vehicle) => getVehiclePhotos(vehicle).length,
    );

    if (!vehiclesWithPhotos.length) {
      setNotice("No vehicle photos found to watermark.");
      return;
    }

    const confirmed = window.confirm(
      `Apply or regenerate watermarks for ${vehiclesWithPhotos.length} vehicle${vehiclesWithPhotos.length === 1 ? "" : "s"}? This uses each original photo and keeps originals untouched.`,
    );

    if (!confirmed) {
      return;
    }

    setWatermarking(true);
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (let index = 0; index < vehiclesWithPhotos.length; index += 1) {
      const vehicle = vehiclesWithPhotos[index];
      const result = await processVehicleWatermarks(
        vehicle.id,
        getVehiclePhotos(vehicle),
        "bulk",
        `Watermarking ${index + 1}/${vehiclesWithPhotos.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      );

      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
    }

    setWatermarking(false);
    setPhotoPreviewMode("watermarked");
    setNotice(
      `Watermark all complete: ${totalSucceeded} photo${totalSucceeded === 1 ? "" : "s"} succeeded, ${totalFailed} failed. Click Save All Vehicle Changes to publish.`,
    );
  }

  function removeWatermarksFromVehicle(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);
    const currentPhotos = getVehiclePhotos(vehicle);
    const nextPhotos = currentPhotos.map((photo) => ({
      ...photo,
      watermarkError: "",
      watermarkedUrl: "",
      watermarkStatus: "idle" as const,
    }));

    if (!nextPhotos.some((photo, index) => currentPhotos[index]?.watermarkedUrl)) {
      setNotice("This vehicle is already using original photos.");
      return;
    }

    updateVehicle(id, {
      imageUrls: nextPhotos.map((photo) => photo.originalUrl),
      vehiclePhotos: nextPhotos,
    });
    setPhotoPreviewMode("original");
    setNotice(
      "Watermarks removed for this vehicle. Click Save All Vehicle Changes to publish originals.",
    );
  }

  function removeWatermarksFromAllVehicles() {
    const vehiclesWithWatermarks = vehicles.filter((vehicle) =>
      getVehiclePhotos(vehicle).some((photo) => photo.watermarkedUrl),
    );

    if (!vehiclesWithWatermarks.length) {
      setNotice("All vehicles are already using original photos.");
      return;
    }

    const confirmed = window.confirm(
      `Remove watermarked versions from ${vehiclesWithWatermarks.length} vehicle${vehiclesWithWatermarks.length === 1 ? "" : "s"} and publish originals after saving? Original photos will stay untouched.`,
    );

    if (!confirmed) {
      return;
    }

    setHasUnsavedVehicleChanges(true);
    setVehicles((currentVehicles) =>
      currentVehicles.map((vehicle) => {
        const photos = getVehiclePhotos(vehicle);

        if (!photos.some((photo) => photo.watermarkedUrl)) {
          return vehicle;
        }

        const nextPhotos = photos.map((photo) => ({
          ...photo,
          watermarkError: "",
          watermarkedUrl: "",
          watermarkStatus: "idle" as const,
        }));

        return {
          ...vehicle,
          imageUrls: nextPhotos.map((photo) => photo.originalUrl),
          vehiclePhotos: nextPhotos,
        };
      }),
    );
    setPhotoPreviewMode("original");
    setNotice(
      "Watermarks removed from all vehicles. Click Save All Vehicle Changes to publish originals.",
    );
  }

  async function processVehicleWatermarks(
    id: string,
    currentPhotos: VehiclePhoto[],
    mode: "auto" | "bulk" | "manual",
    progressMessage?: string,
  ) {
    setNotice(
      progressMessage ??
        `Applying watermark to ${currentPhotos.length} photo${currentPhotos.length === 1 ? "" : "s"}...`,
    );
    updateVehicle(id, {
      vehiclePhotos: currentPhotos.map((photo) => ({
        ...photo,
        watermarkError: "",
        watermarkStatus: "processing",
      })),
    });

    let response: Response;

    try {
      response = await fetch("/api/admin/images/watermark", {
        body: JSON.stringify({
          photos: currentPhotos.map((photo) => ({
            id: photo.id,
            originalUrl: photo.originalUrl,
          })),
          vehicleId: id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      setNotice(
        `Watermark failed before reaching the server: ${getErrorMessage(error)}`,
      );
      updateVehicle(id, { vehiclePhotos: currentPhotos });
      return { failed: currentPhotos.length, succeeded: 0 };
    }

    if (!response.ok) {
      setNotice(await readErrorMessage(response, "Watermark processing failed."));
      updateVehicle(id, { vehiclePhotos: currentPhotos });
      return { failed: currentPhotos.length, succeeded: 0 };
    }

    const result = (await response.json()) as {
      failed?: number;
      results?: {
        error?: string;
        id?: string;
        originalUrl: string;
        watermarkedUrl?: string;
      }[];
      succeeded?: number;
    };
    const resultMap = new Map(
      (result.results ?? []).map((photoResult) => [
        getPhotoKey(photoResult),
        photoResult,
      ]),
    );
    const nextPhotos = currentPhotos.map((photo) => {
      const photoResult = resultMap.get(getPhotoKey(photo));

      if (!photoResult) {
        return {
          ...photo,
          watermarkError: "No result returned for this photo.",
          watermarkStatus: "failed" as const,
        };
      }

      if (photoResult.error || !photoResult.watermarkedUrl) {
        return {
          ...photo,
          watermarkError: photoResult.error ?? "Watermarked URL was not returned.",
          watermarkStatus: "failed" as const,
        };
      }

      return {
        ...photo,
        watermarkError: "",
        watermarkedUrl: photoResult.watermarkedUrl,
        watermarkStatus: "done" as const,
      };
    });

    updateVehicle(id, {
      imageUrls: nextPhotos.map(getPublicPhotoUrl),
      vehiclePhotos: nextPhotos,
    });
    setPhotoPreviewMode("watermarked");

    if (mode !== "bulk") {
      setNotice(
        `${mode === "auto" ? "Upload and watermark complete" : "Watermark complete"}: ${result.succeeded ?? 0} succeeded, ${result.failed ?? 0} failed. Click Save All Vehicle Changes to publish.`,
      );
    }

    return {
      failed: result.failed ?? 0,
      succeeded: result.succeeded ?? 0,
    };
  }

  async function loadInventory(preferredSelectedId = selectedId) {
    const response = await fetch("/api/admin/inventory");

    if (!response.ok) {
      setNotice(await readErrorMessage(response, "Inventory load failed."));
      return;
    }

    const data = (await response.json()) as { vehicles?: EditableVehicle[] };

    if (data.vehicles?.length) {
      const loadedVehicles = data.vehicles.map((vehicle) => ({
          ...vehicle,
          claimStatus: vehicle.claimStatus ?? "unknown",
          isFeatured: vehicle.isFeatured ?? true,
          vehiclePhotos: getVehiclePhotos(vehicle),
        }));

      setVehicles(loadedVehicles);
      setSelectedId(
        loadedVehicles.some((vehicle) => vehicle.id === preferredSelectedId)
          ? preferredSelectedId
          : loadedVehicles[0].id,
      );
    }
  }

  async function saveVehiclesOnly() {
    setSaving(true);
    const vehiclesToSave = normalizeVehiclePrices(vehicles);

    setVehicles(vehiclesToSave);

    let inventoryResponse: Response;

    try {
      inventoryResponse = await fetch("/api/admin/inventory", {
        body: JSON.stringify({ vehicles: vehiclesToSave }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
    } catch (error) {
      setNotice(
        `Vehicle save failed before reaching the server: ${getErrorMessage(error)}`,
      );
      setSaving(false);
      return;
    }

    if (!inventoryResponse.ok) {
      setNotice(await readErrorMessage(inventoryResponse, "Vehicle save failed."));
      setSaving(false);
      return;
    }

    const inventoryResult = (await inventoryResponse.json()) as {
      mode?: string;
      count?: number;
      deleted?: number;
    };
    const deletedCount = inventoryResult.deleted ?? deletedVehicles.length;
    const didSaveToSupabase = inventoryResult.mode === "supabase";

    setNotice(
      didSaveToSupabase
        ? `Saved ${inventoryResult.count ?? vehiclesToSave.length} vehicles to Supabase${deletedCount ? `, including ${deletedCount} deletion${deletedCount === 1 ? "" : "s"}` : ""}.`
        : "Vehicle save did not reach Supabase. Check server environment variables.",
    );
    if (didSaveToSupabase) {
      setDeletedVehicles([]);
      setHasUnsavedVehicleChanges(false);
    }
    setSaving(false);
  }

  async function reloadVehicles() {
    const confirmed =
      !hasUnsavedVehicleChanges ||
      window.confirm(
        "Reload vehicles from Supabase? Unsaved vehicle edits on this page will be discarded.",
      );

    if (!confirmed) {
      return;
    }

    await loadInventory(selectedId);
    setDeletedVehicles([]);
    setHasUnsavedVehicleChanges(false);
    setNotice("Vehicles reloaded from Supabase.");
  }

  function addVehicle() {
    const id = `vehicle-${Date.now()}`;
    const next = { ...blankVehicle, id };
    setHasUnsavedVehicleChanges(true);
    setVehicles((current) => [next, ...current]);
    setSelectedId(id);
    setIsEditorOpen(true);
    setNotice("New vehicle added. Click Save All Vehicle Changes to publish it.");
  }

  function removeVehicle(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);

    if (!vehicle) {
      return;
    }

    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
    const confirmed = window.confirm(
      `Remove ${vehicleName || "this vehicle"} from inventory? It will move to Pending deletions until you save all vehicle changes.`,
    );

    if (!confirmed) {
      return;
    }

    setHasUnsavedVehicleChanges(true);
    setVehicles((current) => {
      const next = current.filter((vehicle) => vehicle.id !== id);
      setSelectedId(next[0]?.id ?? "");
      setIsEditorOpen(false);
      return next;
    });
    setDeletedVehicles((current) =>
      current.some((deleted) => deleted.id === id) ? current : [vehicle, ...current],
    );
    setNotice(
      "Vehicle moved to Pending deletions. Click Save All Vehicle Changes to delete it from Supabase.",
    );
  }

  function restoreVehicle(id: string) {
    const vehicle = deletedVehicles.find((item) => item.id === id);

    if (!vehicle) {
      return;
    }

    setHasUnsavedVehicleChanges(true);
    setVehicles((current) =>
      current.some((item) => item.id === id) ? current : [vehicle, ...current],
    );
    setDeletedVehicles((current) => current.filter((item) => item.id !== id));
    setSelectedId(id);
    setIsEditorOpen(true);
    setNotice("Vehicle restored.");
  }

  function restoreAllDeletedVehicles() {
    const confirmed = window.confirm(
      "Restore all pending deletions back to the vehicle list?",
    );

    if (!confirmed) {
      return;
    }

    setHasUnsavedVehicleChanges(true);
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
        vehiclePhotos: getVehiclePhotos(vehicle as EditableVehicle),
      }),
    );

    setHasUnsavedVehicleChanges(true);
    setVehicles(normalized);
    setSelectedId(normalized[0]?.id ?? "");
    setDeletedVehicles([]);
    setNotice(
      `Imported ${normalized.length} vehicles. Click Save All Vehicle Changes to publish them.`,
    );
    event.target.value = "";
  }

  const selectedVehiclePhotos = getVehiclePhotos(selectedVehicle);
  const selectedWatermarkedCount = selectedVehiclePhotos.filter(
    (photo) => photo.watermarkedUrl,
  ).length;
  const selectedFailedWatermarkCount = selectedVehiclePhotos.filter(
    (photo) => photo.watermarkStatus === "failed",
  ).length;

  return (
    <section className="admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Supabase inventory</p>
          <h2>{vehicles.length} vehicles</h2>
          <p
            className={`admin-save-state ${
              hasUnsavedVehicleChanges ? "is-unsaved" : "is-saved"
            }`}
          >
            {hasUnsavedVehicleChanges
              ? "Unsaved vehicle changes"
              : "Saved to Supabase"}
          </p>
        </div>
        <div className="admin-actions">
          <label className="button secondary file-button">
            Import CSV/JSON
            <input accept=".csv,.json" onChange={importFile} type="file" />
          </label>
          <button className="button secondary" onClick={exportVehicles} type="button">
            Export
          </button>
          <button
            className="button secondary"
            onClick={reloadVehicles}
            type="button"
          >
            Reload from Supabase
          </button>
          <button className="button secondary" onClick={addVehicle} type="button">
            Add Vehicle
          </button>
          <button
            className="button secondary"
            disabled={watermarking}
            onClick={applyWatermarkToAllVehicles}
            type="button"
          >
            {watermarking ? "Watermarking..." : "Watermark All Vehicles"}
          </button>
          <button
            className="button secondary"
            onClick={removeWatermarksFromAllVehicles}
            type="button"
          >
            Remove All Watermarks
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
            {saving ? "Saving to Supabase..." : "Save All Vehicle Changes"}
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
              <span>New / Used</span>
              <select
                value={adminTypeFilter}
                onChange={(event) => setAdminTypeFilter(event.target.value)}
              >
                <option value="all">All inventory</option>
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

        <div className="admin-inventory-board">
          <div className="admin-inventory-board-head">
            <div>
              <p className="eyebrow">Inventory view</p>
              <h3>{filteredAdminVehicles.length} matching vehicles</h3>
            </div>
            <p>
              Browse like the public site, then use Edit to manage photos,
              details, status, and featured placement.
            </p>
          </div>

          {filteredAdminVehicles.length ? (
            <div className="vehicle-grid admin-vehicle-grid">
              {filteredAdminVehicles.map((vehicle) => (
                <AdminVehicleCard
                  isSelected={vehicle.id === selectedVehicle?.id && isEditorOpen}
                  key={vehicle.id}
                  onEdit={() => openVehicleEditor(vehicle.id)}
                  vehicle={vehicle}
                />
              ))}
            </div>
          ) : (
            <p className="admin-empty">No vehicles match these filters.</p>
          )}

          {selectedVehicle && isEditorOpen ? (
            <div
              aria-modal="true"
              className="admin-editor-modal"
              role="dialog"
            >
              <button
                aria-label="Close editor"
                className="admin-editor-backdrop"
                onClick={closeVehicleEditor}
                type="button"
              />
              <form className="admin-editor admin-editor-dialog">
            <div className="editor-head">
              <div>
                <p className="eyebrow">Edit vehicle</p>
                <h3>
                  {selectedVehicle.year} {selectedVehicle.make}{" "}
                  {selectedVehicle.model}
                </h3>
              </div>
              <div className="editor-head-actions">
                <button
                  className="button primary"
                  disabled={saving}
                  onClick={saveVehiclesOnly}
                  type="button"
                >
                  {saving ? "Saving..." : "Save All Vehicle Changes"}
                </button>
                <button
                  className="button danger"
                  onClick={() => removeVehicle(selectedVehicle.id)}
                  type="button"
                >
                  Remove
                </button>
                <button
                  className="button secondary"
                  onClick={closeVehicleEditor}
                  type="button"
                >
                  Close Editor
                </button>
              </div>
            </div>

            <div className="editor-grid">
              <div className="editor-wide image-manager">
                <div className="image-manager-head">
                  <div>
                    <span>Vehicle images</span>
                    <p>
                      {selectedVehiclePhotos.length} / {maxVehicleImages} uploaded
                      {selectedWatermarkedCount
                        ? ` · ${selectedWatermarkedCount} watermarked`
                        : ""}
                    </p>
                  </div>
                  <div className="image-manager-actions">
                    <div className="segmented-control photo-preview-toggle">
                      <button
                        aria-pressed={photoPreviewMode === "original"}
                        className={photoPreviewMode === "original" ? "active" : ""}
                        onClick={() => setPhotoPreviewMode("original")}
                        type="button"
                      >
                        Original
                      </button>
                      <button
                        aria-pressed={photoPreviewMode === "watermarked"}
                        className={photoPreviewMode === "watermarked" ? "active" : ""}
                        onClick={() => setPhotoPreviewMode("watermarked")}
                        type="button"
                      >
                        Watermarked
                      </button>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => vehicleImageInputRef.current?.click()}
                      type="button"
                    >
                      Upload Images
                    </button>
                    <button
                      className="button primary"
                      disabled={!selectedVehiclePhotos.length || watermarking}
                      onClick={() => applyWatermarkToVehicleImages(selectedVehicle.id)}
                      type="button"
                    >
                      Apply Watermark to All Photos
                    </button>
                    <button
                      className="button secondary"
                      disabled={!selectedWatermarkedCount}
                      onClick={() => removeWatermarksFromVehicle(selectedVehicle.id)}
                      type="button"
                    >
                      Remove Watermarks
                    </button>
                  </div>
                  <input
                    accept="image/*"
                    className="admin-file-input"
                    multiple
                    onChange={(event) =>
                      uploadVehicleImages(selectedVehicle.id, event)
                    }
                    ref={vehicleImageInputRef}
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
                    void uploadVehicleImageFiles(
                      selectedVehicle.id,
                      Array.from(event.dataTransfer.files),
                    );
                  }}
                >
                  <strong>Drop photos here</strong>
                  <span>Or click Upload Images. JPG, PNG, WebP, HEIC up to 12 MB each. Up to 20 photos per upload.</span>
                </div>
                {selectedFailedWatermarkCount ? (
                  <p className="image-warning">
                    {selectedFailedWatermarkCount} photo
                    {selectedFailedWatermarkCount === 1 ? "" : "s"} failed.
                    Retry by pressing Apply Watermark to All Photos again.
                  </p>
                ) : null}

                {selectedVehiclePhotos.length > 0 ? (
                  <div className="image-grid">
                    {selectedVehiclePhotos.map((photo, index) => {
                      const imageUrl =
                        photoPreviewMode === "original"
                          ? photo.originalUrl
                          : getPublicPhotoUrl(photo);

                      return (
                      <div
                        className={`image-tile ${
                          draggedImageIndex === index ? "dragging" : ""
                        }`}
                        draggable
                        key={`${photo.id ?? photo.originalUrl}-${index}`}
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
                        <div className="image-status-row">
                          <span className={`photo-status ${photo.watermarkStatus ?? "idle"}`}>
                            {photoStatusLabel(photo)}
                          </span>
                        </div>
                        <div className="image-drag-handle">
                          <span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
                          <small>Drag to reorder</small>
                        </div>
                        {photo.watermarkError ? (
                          <p className="image-error">{photo.watermarkError}</p>
                        ) : null}
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
                      );
                    })}
                  </div>
                ) : (
                  <p className="image-empty">
                    Upload up to 40 photos. The first image becomes the public
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
                <Fragment key={field}>
                  <label>
                    <span>{fieldLabel(field)}</span>
                    <input
                      inputMode={field === "priceLabel" ? "numeric" : undefined}
                      value={String(selectedVehicle[field] ?? "")}
                      onChange={(event) =>
                        updateVehicle(selectedVehicle.id, {
                          [field]:
                            field === "year"
                              ? Number(event.target.value)
                              : event.target.value,
                        })
                      }
                      onBlur={(event) => {
                        if (field !== "priceLabel") {
                          return;
                        }

                        updateVehicle(selectedVehicle.id, {
                          priceLabel: normalizePriceLabel(event.target.value),
                        });
                      }}
                      placeholder={
                        field === "priceLabel" ? "$24,995" : undefined
                      }
                      type={field === "year" ? "number" : "text"}
                    />
                  </label>

                  {field === "vin" ? (
                    <SelectWithOther
                      label="Class"
                      onChange={(value) =>
                        updateVehicle(selectedVehicle.id, { className: value })
                      }
                      options={classNameOptions}
                      value={selectedVehicle.className ?? ""}
                    />
                  ) : null}
                </Fragment>
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
              <button
                className="button primary"
                disabled={saving}
                onClick={saveVehiclesOnly}
                type="button"
              >
                {saving ? "Saving to Supabase..." : "Save All Vehicle Changes"}
              </button>
            </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AdminVehicleCard({
  isSelected,
  onEdit,
  vehicle,
}: {
  isSelected: boolean;
  onEdit: () => void;
  vehicle: EditableVehicle;
}) {
  const imageCount = vehicle.imageUrls?.length ?? 0;

  return (
    <article className={`vehicle-card admin-vehicle-card ${isSelected ? "active" : ""}`}>
      <div className="vehicle-photo" aria-hidden="true">
        {vehicle.imageUrls?.[0] ? (
          <img src={vehicle.imageUrls[0]} alt="" />
        ) : (
          <span>{vehicle.make || "No photo"}</span>
        )}
        {vehicle.status !== "available" ? (
          <div className={`vehicle-photo-status ${vehicle.status}`}>
            {vehicle.status === "incoming" ? "Incoming" : "Sold"}
          </div>
        ) : null}
      </div>
      <div className="vehicle-body">
        <div className="vehicle-summary">
          <div className="admin-card-tags">
            <span className={`status ${vehicle.status}`}>
              {vehicleStatusLabel(vehicle.status)}
            </span>
            <span className={`type-label ${vehicle.type}`}>
              {vehicleTypeLabel(vehicle.type)}
            </span>
            <span className={`claim-label ${vehicle.claimStatus ?? "unknown"}`}>
              {claimStatusLabel(vehicle.claimStatus)}
            </span>
            <span className="stock-label">
              {vehicle.isFeatured === false ? "Not featured" : "Featured"}
            </span>
          </div>
          <h3>
            {vehicle.year} {vehicle.make || "Make TBD"} {vehicle.model || "Model TBD"}
          </h3>
          <p className="vehicle-trim">
            {vehicle.trim || "Trim details coming soon"}
          </p>
          <div className="vehicle-price-row">
            <strong>{vehicle.priceLabel || "Ask for pricing"}</strong>
          </div>
        </div>
        <dl className="vehicle-specs">
          <div>
            <dt>Mileage</dt>
            <dd>{vehicle.mileageLabel || "Mileage TBD"}</dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>{vehicle.className || "Class TBD"}</dd>
          </div>
          <div>
            <dt>Stock #</dt>
            <dd>{vehicle.stockNumber || "No stock #"}</dd>
          </div>
          <div>
            <dt>Photos</dt>
            <dd>{imageCount} / {maxVehicleImages}</dd>
          </div>
        </dl>
        <div className="admin-card-actions">
          <button className="button primary" onClick={onEdit} type="button">
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getVehiclePhotos(vehicle: Partial<EditableVehicle> | undefined | null) {
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

function getPhotoKey(photo: Pick<VehiclePhoto, "id" | "originalUrl">) {
  return photo.id || photo.originalUrl;
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

function fieldLabel(field: EditableField) {
  const labels: Record<EditableField, string> = {
    year: "Year",
    make: "Brand",
    model: "Model",
    trim: "Trim",
    stockNumber: "Stock #",
    vin: "VIN",
    exteriorColor: "Color",
    priceLabel: "Price",
    mileageLabel: "Mileage",
  };

  return labels[field];
}

function claimStatusLabel(value: ClaimStatus | undefined) {
  const option = claimStatusOptions.find(
    (currentOption) => currentOption.value === value,
  );

  return option?.label ?? "Claim TBD";
}

function vehicleStatusLabel(value: EditableVehicle["status"]) {
  if (value === "incoming") return "Incoming";
  if (value === "sold") return "Sold";

  return "Available";
}

function vehicleTypeLabel(value: VehicleType) {
  return value === "new" ? "New" : "Used";
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

function normalizeVehiclePrices(vehicles: EditableVehicle[]) {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    priceLabel: normalizePriceLabel(vehicle.priceLabel),
  }));
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
