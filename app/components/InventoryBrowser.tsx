"use client";

import { useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";

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
            <article className="vehicle-card" key={vehicle.id}>
              <div className="vehicle-photo" aria-hidden="true">
                {vehicle.imageUrls?.[0] ? (
                  <img src={vehicle.imageUrls[0]} alt="" />
                ) : (
                  <span>{vehicle.make}</span>
                )}
              </div>
              <div className="vehicle-body">
                <div className="vehicle-summary">
                  <div className="vehicle-topline">
                    <span className={`status ${vehicle.status}`}>
                      {vehicle.status}
                    </span>
                    <span className="type-label">{vehicle.type}</span>
                    {vehicle.stockNumber ? (
                      <span className="stock-label">
                        Stock {vehicle.stockNumber}
                      </span>
                    ) : null}
                    {(vehicle.claimStatus ?? "unknown") !== "unknown" ? (
                      <span className="claim-label">
                        {claimStatusLabels[vehicle.claimStatus ?? "unknown"]}
                      </span>
                    ) : null}
                  </div>
                  <h3>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <p>{vehicle.trim || "Trim details coming soon"}</p>
                  <strong>{vehicle.priceLabel}</strong>
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
                    <div className="wide-spec">
                      <dt>VIN</dt>
                      <dd>{vehicle.vin}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
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
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
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
