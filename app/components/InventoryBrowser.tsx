"use client";

import { useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";
import { ContactForm } from "./ContactForm";

type InventoryFilter = "all" | VehicleType;
type ClaimFilter = "all" | ClaimStatus;
type InventorySort =
  | "featured"
  | "price-low"
  | "price-high"
  | "year-new"
  | "mileage-low";
type PriceFilter = "all" | "under-25" | "25-40" | "40-60" | "60-plus" | "ask";
type ViewMode = "grid" | "list";
type SelectFilterKey =
  | "year"
  | "make"
  | "model"
  | "bodyStyle"
  | "condition"
  | "colour"
  | "drivetrain"
  | "fuel"
  | "transmission"
  | "claim";

type SelectFilters = Record<SelectFilterKey, string>;

const claimStatusLabels: Record<ClaimStatus, string> = {
  unknown: "Claim status TBD",
  "no-claim": "No claim",
  "minor-claim": "Minor claim",
  "claim-over-5k": "Claim over $5k",
};

export function InventoryBrowser({
  vehicles,
  showAdvancedControls = false,
}: {
  vehicles: Vehicle[];
  showAdvancedControls?: boolean;
}) {
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [sort, setSort] = useState<InventorySort>("featured");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectFilters, setSelectFilters] = useState<SelectFilters>({
    bodyStyle: "all",
    claim: "all",
    colour: "all",
    condition: "all",
    drivetrain: "all",
    fuel: "all",
    make: "all",
    model: "all",
    transmission: "all",
    year: "all",
  });

  const filterOptions = useMemo(
    () => ({
      bodyStyle: uniqueValues(vehicles.map((vehicle) => vehicle.className)),
      colour: uniqueValues(vehicles.map((vehicle) => vehicle.exteriorColor)),
      drivetrain: uniqueValues(vehicles.map((vehicle) => vehicle.drivetrain)),
      fuel: uniqueValues(vehicles.map(inferFuel)),
      make: uniqueValues(vehicles.map((vehicle) => vehicle.make)),
      model: uniqueValues(vehicles.map((vehicle) => vehicle.model)),
      transmission: uniqueValues(vehicles.map(inferTransmission)),
      year: uniqueYearValues(vehicles.map((vehicle) => vehicle.year)),
    }),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const next = vehicles.filter((vehicle) => {
      const condition = showAdvancedControls
        ? (selectFilters.condition as InventoryFilter)
        : filter;
      const typeMatches = condition === "all" || vehicle.type === condition;
      const searchMatches = searchVehicle(vehicle, search);
      const priceMatches = matchesPriceFilter(vehicle.priceLabel, priceFilter);
      const claimMatches =
        selectFilters.claim === "all" ||
        (vehicle.claimStatus ?? "unknown") === selectFilters.claim;
      const selectMatches =
        matchesSelect(selectFilters.year, String(vehicle.year)) &&
        matchesSelect(selectFilters.make, vehicle.make) &&
        matchesSelect(selectFilters.model, vehicle.model) &&
        matchesSelect(selectFilters.bodyStyle, vehicle.className) &&
        matchesSelect(selectFilters.colour, vehicle.exteriorColor) &&
        matchesSelect(selectFilters.drivetrain, vehicle.drivetrain) &&
        matchesSelect(selectFilters.fuel, inferFuel(vehicle)) &&
        matchesSelect(selectFilters.transmission, inferTransmission(vehicle));

      return (
        typeMatches &&
        claimMatches &&
        priceMatches &&
        searchMatches &&
        selectMatches
      );
    });

    return next.sort((a, b) => {
      if (sort === "price-low") {
        return numberFromLabel(a.priceLabel) - numberFromLabel(b.priceLabel);
      }

      if (sort === "price-high") {
        return numberFromLabel(b.priceLabel) - numberFromLabel(a.priceLabel);
      }

      if (sort === "year-new") {
        return b.year - a.year;
      }

      if (sort === "mileage-low") {
        return numberFromLabel(a.mileageLabel) - numberFromLabel(b.mileageLabel);
      }

      return Number(b.isFeatured === true) - Number(a.isFeatured === true);
    });
  }, [filter, priceFilter, search, selectFilters, showAdvancedControls, sort, vehicles]);

  function updateSelectFilter(key: SelectFilterKey, value: string) {
    setSelectFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilter("all");
    setPriceFilter("all");
    setSearch("");
    setSelectFilters({
      bodyStyle: "all",
      claim: "all",
      colour: "all",
      condition: "all",
      drivetrain: "all",
      fuel: "all",
      make: "all",
      model: "all",
      transmission: "all",
      year: "all",
    });
  }

  function openVehicle(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setSelectedImageIndex(0);
    trackVehicleEvent("vehicle_view", vehicle);
  }

  function closeVehicle() {
    setSelectedVehicle(null);
    setSelectedImageIndex(0);
  }

  return (
    <div className="inventory-browser">
      {showAdvancedControls ? (
        <div className="inventory-filter-panel">
          <div className="filter-grid">
            <FilterSelect
              label="Year"
              value={selectFilters.year}
              options={filterOptions.year}
              onChange={(value) => updateSelectFilter("year", value)}
            />
            <FilterSelect
              label="Make"
              value={selectFilters.make}
              options={filterOptions.make}
              onChange={(value) => updateSelectFilter("make", value)}
            />
            <FilterSelect
              label="Model"
              value={selectFilters.model}
              options={filterOptions.model}
              onChange={(value) => updateSelectFilter("model", value)}
            />
            <FilterSelect
              label="Body Style"
              value={selectFilters.bodyStyle}
              options={filterOptions.bodyStyle}
              onChange={(value) => updateSelectFilter("bodyStyle", value)}
            />
            <label className="filter-control">
              <span>Price</span>
              <select
                value={priceFilter}
                onChange={(event) =>
                  setPriceFilter(event.target.value as PriceFilter)
                }
              >
                <option value="all">Any price</option>
                <option value="under-25">Under $25k</option>
                <option value="25-40">$25k - $40k</option>
                <option value="40-60">$40k - $60k</option>
                <option value="60-plus">$60k+</option>
                <option value="ask">Ask for pricing</option>
              </select>
            </label>
            <FilterSelect
              label="Condition"
              value={selectFilters.condition}
              options={["New", "Used"]}
              onChange={(value) => updateSelectFilter("condition", value)}
              values={["new", "used"]}
            />
            <FilterSelect
              label="Colour"
              value={selectFilters.colour}
              options={filterOptions.colour}
              onChange={(value) => updateSelectFilter("colour", value)}
            />
            <FilterSelect
              label="Drivetrain"
              value={selectFilters.drivetrain}
              options={filterOptions.drivetrain}
              onChange={(value) => updateSelectFilter("drivetrain", value)}
            />
            <FilterSelect
              label="Fuel"
              value={selectFilters.fuel}
              options={filterOptions.fuel}
              onChange={(value) => updateSelectFilter("fuel", value)}
            />
            <FilterSelect
              label="Transmission"
              value={selectFilters.transmission}
              options={filterOptions.transmission}
              onChange={(value) => updateSelectFilter("transmission", value)}
            />
            <FilterSelect
              label="Claim"
              value={selectFilters.claim}
              options={["No claim", "Minor claim", "Claim over $5k", "Not listed"]}
              onChange={(value) => updateSelectFilter("claim", value)}
              values={["no-claim", "minor-claim", "claim-over-5k", "unknown"]}
            />
          </div>

          <div className="inventory-toolbar">
            <label className="filter-search toolbar-search">
              <span>Search Inventory</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Inventory"
                type="search"
              />
            </label>
            <button className="text-button" onClick={resetFilters} type="button">
              Reset Filters
            </button>
            <div className="view-setting" aria-label="View setting">
              <span>View Setting:</span>
              <button
                aria-pressed={viewMode === "list"}
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                title="List view"
                type="button"
              >
                <span aria-hidden="true">☰</span>
              </button>
              <button
                aria-pressed={viewMode === "grid"}
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                title="Grid view"
                type="button"
              >
                <span aria-hidden="true">▦</span>
              </button>
            </div>
            <label className="sort-control">
              <span>Sort By</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as InventorySort)}
              >
                <option value="featured">Featured first</option>
                <option value="year-new">Newest year</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="mileage-low">Mileage low to high</option>
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="inventory-controls">
          <div className="segmented-control" aria-label="Filter inventory">
            {(["all", "new", "used"] as const).map((option) => (
              <button
                aria-pressed={filter === option}
                className={filter === option ? "active" : ""}
                key={option}
                onClick={() => setFilter(option)}
                type="button"
              >
                {option === "all" ? "All" : option === "new" ? "New" : "Used"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredVehicles.length === 0 ? (
        <div className="empty-state">
          <p>No vehicles match this filter yet.</p>
        </div>
      ) : (
        <div className={`vehicle-grid ${viewMode === "list" ? "list-view" : ""}`}>
          {filteredVehicles.map((vehicle) => (
            <article
              className="vehicle-card vehicle-card-clickable"
              key={vehicle.id}
              onClick={() => openVehicle(vehicle)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openVehicle(vehicle);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="vehicle-photo" aria-hidden="true">
                {vehicle.imageUrls?.[0] ? (
                  <img src={vehicle.imageUrls[0]} alt="" />
                ) : (
                  <span>{vehicle.make}</span>
                )}
                {vehicle.status !== "available" ? (
                  <div className={`vehicle-photo-status ${vehicle.status}`}>
                    {vehicle.status === "incoming" ? "Incoming" : "Sold"}
                  </div>
                ) : null}
              </div>
              <div className="vehicle-body">
                <div className="vehicle-summary">
                  <h3>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <p className="vehicle-trim">
                    {vehicle.trim || "Trim details coming soon"}
                  </p>
                  <div className="vehicle-price-row">
                    <strong>{vehicle.priceLabel}</strong>
                    <VehicleCardTags vehicle={vehicle} />
                  </div>
                </div>
                <dl className="vehicle-specs">
                  <div>
                    <dt>Mileage</dt>
                    <dd>{vehicle.mileageLabel}</dd>
                  </div>
                  <div>
                    <dt>Class</dt>
                    <dd>{vehicle.className || "Class TBD"}</dd>
                  </div>
                  <div>
                    <dt>Drivetrain</dt>
                    <dd>{vehicle.drivetrain || "TBD"}</dd>
                  </div>
                  <div>
                    <dt>Fuel</dt>
                    <dd>{inferFuel(vehicle) || "TBD"}</dd>
                  </div>
                </dl>
                <span className="vehicle-card-hint">View details</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedVehicle ? (
        <VehicleDetailModal
          imageIndex={selectedImageIndex}
          onClose={closeVehicle}
          onContactClick={(vehicle) => trackVehicleEvent("contact_click", vehicle)}
          onImageIndexChange={setSelectedImageIndex}
          vehicle={selectedVehicle}
        />
      ) : null}
    </div>
  );
}

function VehicleDetailModal({
  imageIndex,
  onClose,
  onContactClick,
  onImageIndexChange,
  vehicle,
}: {
  imageIndex: number;
  onClose: () => void;
  onContactClick: (vehicle: Vehicle) => void;
  onImageIndexChange: (index: number) => void;
  vehicle: Vehicle;
}) {
  const images = vehicle.imageUrls?.length ? vehicle.imageUrls : [];
  const activeImage = images[imageIndex];
  const highlights = splitContentLines(vehicle.highlights);
  const details = splitContentLines(vehicle.details);
  const [showContactForm, setShowContactForm] = useState(false);
  const contactPrefill = getVehicleContactPrefill(vehicle);
  const canBrowseImages = images.length > 1;

  function showPreviousImage() {
    if (!canBrowseImages) {
      return;
    }

    onImageIndexChange((imageIndex - 1 + images.length) % images.length);
  }

  function showNextImage() {
    if (!canBrowseImages) {
      return;
    }

    onImageIndexChange((imageIndex + 1) % images.length);
  }

  return (
    <div
      aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model} details`}
      aria-modal="true"
      className="vehicle-modal"
      role="dialog"
    >
      <div className="vehicle-modal-backdrop" onClick={onClose} />
      <div className="vehicle-modal-panel">
        <button
          aria-label="Close vehicle details"
          className="vehicle-modal-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>

        <div className="vehicle-modal-gallery">
          <div className="vehicle-modal-main-image">
            {activeImage ? (
              <img
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                src={activeImage}
              />
            ) : (
              <span>{vehicle.make}</span>
            )}
            {vehicle.status !== "available" ? (
              <div className={`vehicle-photo-status ${vehicle.status}`}>
                {vehicle.status === "incoming" ? "Incoming" : "Sold"}
              </div>
            ) : null}
            {canBrowseImages ? (
              <>
                <button
                  aria-label="Show previous photo"
                  className="vehicle-gallery-arrow previous"
                  onClick={showPreviousImage}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Show next photo"
                  className="vehicle-gallery-arrow next"
                  onClick={showNextImage}
                  type="button"
                >
                  ›
                </button>
                <span className="vehicle-gallery-count">
                  {imageIndex + 1} / {images.length}
                </span>
              </>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="vehicle-modal-thumbs" aria-label="Vehicle photos">
              {images.map((imageUrl, index) => (
                <button
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={index === imageIndex}
                  className={index === imageIndex ? "active" : ""}
                  key={`${imageUrl}-${index}`}
                  onClick={() => onImageIndexChange(index)}
                  type="button"
                >
                  <img alt="" src={imageUrl} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="vehicle-modal-content">
          <div className="vehicle-modal-title">
            <div>
              <h2>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <p className="vehicle-trim">
                {vehicle.trim || "Trim details coming soon"}
              </p>
            </div>
            <div className="vehicle-modal-price">
              <div className="vehicle-price-row">
                <strong>{vehicle.priceLabel}</strong>
                <VehicleCardTags vehicle={vehicle} />
              </div>
              <p className="vehicle-price-note">
                Dealer #: 10904
                <br />
                Price does not include $699 documentation fee, $789 prep fee,
                any added accessories, or applicable taxes. Contact Dennis for
                details.
              </p>
              <button
                className="button primary"
                onClick={() => {
                  onContactClick(vehicle);
                  setShowContactForm(true);
                }}
                type="button"
              >
                Contact Dennis
              </button>
            </div>
          </div>

          {highlights.length ? (
            <section className="vehicle-modal-section">
              <h3>Highlights</h3>
              <ul className="vehicle-highlights">
                {highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <dl className="vehicle-modal-specs">
            {vehicle.stockNumber ? (
              <div>
                <dt>Stock #</dt>
                <dd>{vehicle.stockNumber}</dd>
              </div>
            ) : null}
            <div>
              <dt>Mileage</dt>
              <dd>{vehicle.mileageLabel}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{vehicle.className || "Class TBD"}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{vehicle.exteriorColor}</dd>
            </div>
            <div>
              <dt>Drivetrain</dt>
              <dd>{vehicle.drivetrain || "TBD"}</dd>
            </div>
            <div>
              <dt>Transmission</dt>
              <dd>{inferTransmission(vehicle) || "TBD"}</dd>
            </div>
            <div>
              <dt>Fuel</dt>
              <dd>{inferFuel(vehicle) || "TBD"}</dd>
            </div>
            {vehicle.vin ? (
              <div>
                <dt>VIN</dt>
                <dd>{vehicle.vin}</dd>
              </div>
            ) : null}
          </dl>

          <section className="vehicle-modal-section">
            <h3>Details</h3>
            {details.length ? (
              details.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>Message me to confirm details, availability, and next steps.</p>
            )}
          </section>
        </div>

        {showContactForm ? (
          <div className="vehicle-contact-panel">
            <div className="vehicle-contact-card">
              <button
                aria-label="Close contact form"
                className="vehicle-modal-close"
                onClick={() => setShowContactForm(false)}
                type="button"
              >
                ×
              </button>
              <div className="vehicle-contact-head">
                <p className="eyebrow">Contact Dennis</p>
                <h3>
                  Ask about {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
              </div>
              <ContactForm
                initialMessage={contactPrefill.message}
                initialVehicleType={contactPrefill.vehicleType}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function trackVehicleEvent(
  eventType: "vehicle_view" | "contact_click",
  vehicle: Vehicle,
) {
  if (typeof window === "undefined") {
    return;
  }

  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();

  void fetch("/api/analytics", {
    body: JSON.stringify({
      eventType,
      metadata: {
        priceLabel: vehicle.priceLabel,
        status: vehicle.status,
        type: vehicle.type,
      },
      pagePath: window.location.pathname,
      vehicle: {
        id: vehicle.id,
        label: vehicleLabel,
        stockNumber: vehicle.stockNumber,
      },
    }),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

function VehicleCardTags({ vehicle }: { vehicle: Vehicle }) {
  return (
    <span className="vehicle-inline-tags">
      <span className="type-label">{vehicle.type}</span>
      {(vehicle.claimStatus ?? "unknown") !== "unknown" ? (
        <span className={`claim-label ${vehicle.claimStatus ?? "unknown"}`}>
          {claimStatusLabels[vehicle.claimStatus ?? "unknown"]}
        </span>
      ) : null}
    </span>
  );
}

function getVehicleContactPrefill(vehicle: Vehicle) {
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  const lines = [
    `I am interested in the ${vehicleName}${vehicle.trim ? ` ${vehicle.trim}` : ""}.`,
    vehicle.stockNumber ? `Stock #: ${vehicle.stockNumber}` : "",
    vehicle.vin ? `VIN: ${vehicle.vin}` : "",
    `Price: ${vehicle.priceLabel}`,
  ].filter(Boolean);

  return {
    message: lines.join("\n"),
    vehicleType: vehicle.type,
  };
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
  values,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
  values?: string[];
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{label}</option>
        {options.map((option, index) => (
          <option key={`${label}-${option}`} value={values?.[index] ?? option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function numberFromLabel(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(parsed) || parsed === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parsed;
}

function uniqueValues(values: Array<string | number | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function uniqueYearValues(values: Array<number | null | undefined>) {
  return [...new Set(values.filter((value): value is number => Number.isFinite(value)))]
    .sort((a, b) => b - a)
    .map(String);
}

function matchesSelect(filterValue: string, vehicleValue?: string) {
  return filterValue === "all" || filterValue === String(vehicleValue ?? "").trim();
}

function matchesPriceFilter(priceLabel: string, priceFilter: PriceFilter) {
  if (priceFilter === "all") {
    return true;
  }

  const lower = priceLabel.toLowerCase();

  if (priceFilter === "ask") {
    return lower.includes("ask") || !numberFromPrice(priceLabel);
  }

  const price = numberFromPrice(priceLabel);

  if (!price) {
    return false;
  }

  if (priceFilter === "under-25") {
    return price < 25000;
  }

  if (priceFilter === "25-40") {
    return price >= 25000 && price < 40000;
  }

  if (priceFilter === "40-60") {
    return price >= 40000 && price < 60000;
  }

  return price >= 60000;
}

function numberFromPrice(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function searchVehicle(vehicle: Vehicle, search: string) {
  const needle = search.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.stockNumber,
    vehicle.vin,
    vehicle.className,
    vehicle.drivetrain,
    inferTransmission(vehicle),
    inferFuel(vehicle),
    vehicle.exteriorColor,
    vehicle.priceLabel,
    vehicle.mileageLabel,
    vehicle.highlights,
    vehicle.details,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function splitContentLines(value?: string) {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferFuel(vehicle: Vehicle) {
  if (vehicle.fuel?.trim()) {
    return vehicle.fuel.trim();
  }

  const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.trim}`.toLowerCase();

  if (haystack.includes("diesel")) {
    return "Diesel";
  }

  if (haystack.includes("phev") || haystack.includes("plug-in")) {
    return "PHEV";
  }

  if (haystack.includes("tesla") || haystack.includes("electric")) {
    return "EV";
  }

  if (haystack.includes("hybrid")) {
    return "Hybrid";
  }

  return "Gasoline";
}

function inferTransmission(vehicle: Vehicle) {
  if (vehicle.transmission?.trim()) {
    return vehicle.transmission.trim();
  }

  const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.trim}`.toLowerCase();

  if (haystack.includes("manual") || haystack.includes("6-speed")) {
    return "Manual";
  }

  return "Auto";
}
