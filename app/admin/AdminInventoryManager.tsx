"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";
import type { SiteVideo } from "../../lib/video-store";
import { SiteVideoFrame } from "../components/SiteVideoFrame";

type EditableVehicle = Vehicle & {
  isFeatured?: boolean;
};

const storageKey = "deals-with-dennis-admin-inventory";
const videoStorageKey = "deals-with-dennis-admin-videos";
const maxVehicleImages = 20;
const maxImageSizeBytes = 2_500_000;
const maxVideoSizeBytes = 250_000_000;
const maxThumbnailSizeBytes = 2_500_000;

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

const blankVideo: SiteVideo = {
  id: "draft-new-video",
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  isFeatured: true,
  sortOrder: 0,
};

export function AdminInventoryManager({
  initialVehicles,
  initialVideos,
}: {
  initialVehicles: Vehicle[];
  initialVideos: SiteVideo[];
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
  const [videos, setVideos] = useState<SiteVideo[]>(initialVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(
    initialVideos[0]?.id ?? "",
  );
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState("");

  useEffect(() => {
    void loadInventory();
    void loadVideos();

    const saved = window.localStorage.getItem(storageKey);

    if (saved && !initialVehicles.length) {
      try {
        const parsed = JSON.parse(saved) as EditableVehicle[];
        setVehicles(parsed);
        setSelectedId(parsed[0]?.id ?? "");
      } catch {
        setNotice("Saved draft could not be loaded.");
      }
    }

    const savedVideos = window.localStorage.getItem(videoStorageKey);

    if (savedVideos && !initialVideos.length) {
      try {
        const parsed = JSON.parse(savedVideos) as SiteVideo[];
        setVideos(parsed);
        setSelectedVideoId(parsed[0]?.id ?? "");
      } catch {
        setNotice("Saved video draft could not be loaded.");
      }
    }
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0],
    [selectedId, vehicles],
  );
  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0],
    [selectedVideoId, videos],
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

  function updateVideo(id: string, patch: Partial<SiteVideo>) {
    setVideos((current) =>
      current.map((video) => (video.id === id ? { ...video, ...patch } : video)),
    );
  }

  async function uploadSiteVideo(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isAllowedVideoFile(file) || file.size > maxVideoSizeBytes) {
      setNotice("Video must be a .mov, .mp4, .m4v, or .webm file and 250 MB or smaller.");
      return;
    }

    setVideoUploadStatus(`Preparing upload for ${file.name}...`);

    const response = await fetch("/api/admin/videos/upload", {
      body: JSON.stringify({
        contentType: file.type || getVideoContentType(file.name),
        fileName: file.name,
        fileSize: file.size,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Video upload failed.");
      setVideoUploadStatus("");
      return;
    }

    const result = (await response.json()) as {
      contentType?: string;
      signedUrl?: string;
      videoUrl?: string;
      mode?: string;
    };

    if (result.signedUrl) {
      setVideoUploadStatus("Uploading video to Supabase...");
      const uploadForm = new FormData();
      uploadForm.append("cacheControl", "3600");
      uploadForm.append("", file);
      const uploadResponse = await fetch(result.signedUrl, {
        body: uploadForm,
        headers: { "x-upsert": "false" },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        setNotice("Video upload failed while sending the file to Supabase.");
        setVideoUploadStatus("");
        return;
      }
    }

    if (result.videoUrl) {
      updateVideo(id, { videoUrl: result.videoUrl });
      window.localStorage.setItem(
        videoStorageKey,
        JSON.stringify(
          videos.map((video) =>
            video.id === id ? { ...video, videoUrl: result.videoUrl ?? "" } : video,
          ),
        ),
      );
      setNotice(
        `Video uploaded${result.mode === "supabase" ? " to Supabase Storage" : ""}. Click Save Videos to publish it.`,
      );
      setVideoUploadStatus("Upload complete. Click Save Videos to publish.");
    }
  }

  async function uploadVideoThumbnail(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isAllowedImageFile(file) || file.size > maxThumbnailSizeBytes) {
      setNotice("Thumbnail must be an image file and 2.5 MB or smaller.");
      return;
    }

    setVideoUploadStatus(`Uploading thumbnail ${file.name}...`);

    const formData = new FormData();
    formData.append("vehicleId", `video-${id}`);
    formData.append("images", file);

    const response = await fetch("/api/admin/images", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Thumbnail upload failed.");
      setVideoUploadStatus("");
      return;
    }

    const result = (await response.json()) as {
      imageUrls?: string[];
      mode?: string;
    };
    const thumbnailUrl = result.imageUrls?.[0] ?? "";

    if (!thumbnailUrl) {
      setNotice("Thumbnail upload did not return an image URL.");
      setVideoUploadStatus("");
      return;
    }

    updateVideo(id, { thumbnailUrl });
    window.localStorage.setItem(
      videoStorageKey,
      JSON.stringify(
        videos.map((video) =>
          video.id === id ? { ...video, thumbnailUrl } : video,
        ),
      ),
    );
    setNotice(
      `Thumbnail uploaded${result.mode === "supabase" ? " to Supabase Storage" : ""}. Click Save Videos to publish it.`,
    );
    setVideoUploadStatus("Thumbnail uploaded. Click Save Videos to publish.");
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
      window.localStorage.removeItem(storageKey);
    }
  }

  async function loadVideos() {
    const response = await fetch("/api/admin/videos");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { videos?: SiteVideo[] };

    if (data.videos?.length) {
      setVideos(data.videos);
      setSelectedVideoId(data.videos[0].id);
      window.localStorage.removeItem(videoStorageKey);
    }
  }

  async function saveDraft() {
    setSaving(true);
    window.localStorage.setItem(storageKey, JSON.stringify(vehicles));
    window.localStorage.setItem(videoStorageKey, JSON.stringify(videos));

    const [inventoryResponse, videosResponse] = await Promise.all([
      fetch("/api/admin/inventory", {
        body: JSON.stringify({ vehicles }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      fetch("/api/admin/videos", {
        body: JSON.stringify({ videos }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
    ]);

    if (!inventoryResponse.ok || !videosResponse.ok) {
      setNotice("Draft saved locally, but server save failed.");
      setSaving(false);
      return;
    }

    const [inventoryResult, videosResult] = (await Promise.all([
      inventoryResponse.json(),
      videosResponse.json(),
    ])) as Array<{ mode?: string; count?: number }>;

    const savedToSupabase =
      inventoryResult.mode === "supabase" || videosResult.mode === "supabase";

    setNotice(
      savedToSupabase
        ? `Saved ${inventoryResult.count ?? vehicles.length} vehicles and ${
            videosResult.count ?? videos.length
          } videos to Supabase.`
        : "Draft saved locally. Add Supabase env vars for remote persistence.",
    );
    setSaving(false);
  }

  async function saveVideosOnly() {
    setVideoSaving(true);
    window.localStorage.setItem(videoStorageKey, JSON.stringify(videos));

    const response = await fetch("/api/admin/videos", {
      body: JSON.stringify({ videos }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Video save failed.");
      setVideoSaving(false);
      return;
    }

    const result = (await response.json()) as {
      databaseError?: string;
      mode?: string;
      count?: number;
    };
    setNotice(
      result.mode === "supabase" || result.mode === "supabase-storage"
        ? `Saved ${result.count ?? videos.length} homepage videos${
            result.databaseError ? " using Storage fallback" : ""
          }.`
        : "Videos saved locally. Add Supabase env vars for remote persistence.",
    );
    setVideoUploadStatus("");
    setVideoSaving(false);
  }

  function resetDraft() {
    const next = initialVehicles.map((vehicle) => ({
      ...vehicle,
      claimStatus: vehicle.claimStatus ?? "unknown",
      isFeatured: vehicle.isFeatured ?? true,
    }));
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(videoStorageKey);
    setVehicles(next);
    setVideos(initialVideos);
    setSelectedId(next[0]?.id ?? "");
    setSelectedVideoId(initialVideos[0]?.id ?? "");
    setNotice("Draft reset to source content.");
  }

  function addVehicle() {
    const id = `draft-${Date.now()}`;
    const next = { ...blankVehicle, id };
    setVehicles((current) => [next, ...current]);
    setSelectedId(id);
    setNotice("New vehicle draft added.");
  }

  function addVideo() {
    const id = `video-${Date.now()}`;
    const next = { ...blankVideo, id, sortOrder: videos.length };
    setVideos((current) => [next, ...current]);
    setSelectedVideoId(id);
    setNotice("New video draft added.");
  }

  function removeVideo(id: string) {
    setVideos((current) => {
      const next = current.filter((video) => video.id !== id);
      setSelectedVideoId(next[0]?.id ?? "");
      return next;
    });
    setNotice("Video removed from draft.");
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

      <div className="admin-video-panel">
        <div className="editor-head">
          <div>
            <p className="eyebrow">Social media</p>
            <h3>Homepage videos</h3>
          </div>
          <div className="admin-actions">
            <button className="button secondary" onClick={addVideo} type="button">
              Add Video
            </button>
            <button
              className="button primary"
              disabled={videoSaving}
              onClick={saveVideosOnly}
              type="button"
            >
              {videoSaving ? "Saving..." : "Save Videos"}
            </button>
          </div>
        </div>
        <p className="admin-video-help">
          Upload a .mov/.mp4 file or paste a TikTok/YouTube URL. Click Save
          Videos after changes so the homepage can show it.
        </p>

        <div className="video-admin-workspace">
          <div className="admin-list video-list" aria-label="Homepage videos">
            {videos.map((video) => (
              <button
                className={video.id === selectedVideo?.id ? "active" : ""}
                key={video.id}
                onClick={() => setSelectedVideoId(video.id)}
                type="button"
              >
                <span>{video.title || "Untitled video"}</span>
                <small>
                  {video.isFeatured === false ? "Hidden" : "Featured"} ·{" "}
                  {video.videoUrl ? "Video ready" : "No video yet"}
                </small>
              </button>
            ))}
            {!videos.length ? (
              <p className="admin-empty">No videos yet. Add one to start.</p>
            ) : null}
          </div>

          {selectedVideo ? (
            <form className="admin-editor video-editor">
              <div className="video-upload-card">
                {selectedVideo.videoUrl ? (
                  <SiteVideoFrame video={selectedVideo} />
                ) : (
                  <div className="video-upload-empty">
                    <span>Deals with Dennis</span>
                    <p>Upload a short walk-around or paste a direct video URL.</p>
                  </div>
                )}
                {videoUploadStatus ? (
                  <p className="video-upload-status">{videoUploadStatus}</p>
                ) : null}
                <div className="admin-actions">
                  <label className="button secondary file-button">
                    Upload Video
                    <input
                      accept="video/*,.mov,.mp4,.m4v,.webm"
                      onChange={(event) => uploadSiteVideo(selectedVideo.id, event)}
                      type="file"
                    />
                  </label>
                  <button
                    className="button danger"
                    onClick={() => removeVideo(selectedVideo.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="editor-grid">
                <label>
                  <span>Title</span>
                  <input
                    value={selectedVideo.title}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, { title: event.target.value })
                    }
                    placeholder="Fresh trade-in walk-around"
                    type="text"
                  />
                </label>
                <label>
                  <span>Featured on homepage</span>
                  <select
                    value={selectedVideo.isFeatured === false ? "no" : "yes"}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        isFeatured: event.target.value === "yes",
                      })
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="editor-wide">
                  <span>Video URL</span>
                  <input
                    value={selectedVideo.videoUrl}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        videoUrl: event.target.value,
                      })
                    }
                    placeholder="Paste a TikTok/YouTube link or direct .mp4/.mov URL"
                    type="text"
                  />
                </label>
                <div className="editor-wide thumbnail-uploader">
                  <span>Thumbnail image</span>
                  {selectedVideo.thumbnailUrl ? (
                    <img
                      alt={`${selectedVideo.title || "Video"} thumbnail`}
                      src={selectedVideo.thumbnailUrl}
                    />
                  ) : (
                    <div className="thumbnail-empty">No thumbnail uploaded</div>
                  )}
                  <div className="admin-actions">
                    <label className="button secondary file-button">
                      Upload Thumbnail
                      <input
                        accept="image/*"
                        onChange={(event) =>
                          uploadVideoThumbnail(selectedVideo.id, event)
                        }
                        type="file"
                      />
                    </label>
                    {selectedVideo.thumbnailUrl ? (
                      <button
                        className="button ghost"
                        onClick={() =>
                          updateVideo(selectedVideo.id, { thumbnailUrl: "" })
                        }
                        type="button"
                      >
                        Remove Thumbnail
                      </button>
                    ) : null}
                  </div>
                </div>
                <label>
                  <span>Sort order</span>
                  <input
                    value={selectedVideo.sortOrder ?? 0}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        sortOrder: Number(event.target.value),
                      })
                    }
                    type="number"
                  />
                </label>
                <label className="editor-wide">
                  <span>Description</span>
                  <textarea
                    value={selectedVideo.description}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder="A quick note to show below the video."
                    rows={4}
                  />
                </label>
              </div>
            </form>
          ) : null}
        </div>
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

function getVideoContentType(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (lowerName.endsWith(".webm")) {
    return "video/webm";
  }

  if (lowerName.endsWith(".m4v")) {
    return "video/x-m4v";
  }

  return "video/mp4";
}

function isAllowedVideoFile(file: File) {
  const lowerName = file.name.toLowerCase();

  return (
    file.type.startsWith("video/") ||
    lowerName.endsWith(".mov") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".m4v") ||
    lowerName.endsWith(".webm")
  );
}

function isAllowedImageFile(file: File) {
  return file.type.startsWith("image/");
}
