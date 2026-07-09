"use client";

import { useMemo, useState } from "react";
import type { ClaimStatus, Vehicle, VehicleType } from "../data/inventory";

type InventoryFilter = "all" | VehicleType;
type ClaimFilter = "all" | ClaimStatus;
type InventorySort = "featured" | "price-low" | "price-high" | "year-new" | "mileage-low";

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
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("all");
  const [sort, setSort] = useState<InventorySort>("featured");

  const filteredVehicles = useMemo(() => {
    const next = vehicles.filter((vehicle) => {
      const typeMatches = filter === "all" || vehicle.type === filter;
      const claimMatches =
        claimFilter === "all" ||
        (vehicle.claimStatus ?? "unknown") === claimFilter;

      return typeMatches && claimMatches;
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
  }, [claimFilter, filter, sort, vehicles]);

  return (
    <div className="inventory-browser">
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

        {showAdvancedControls ? (
          <div className="inventory-selectors">
            <label>
              <span>Claim</span>
              <select
                value={claimFilter}
                onChange={(event) => setClaimFilter(event.target.value as ClaimFilter)}
              >
                <option value="all">All claim status</option>
                <option value="no-claim">No claim</option>
                <option value="minor-claim">Minor claim</option>
                <option value="claim-over-5k">Claim over $5k</option>
                <option value="unknown">Not listed</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
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
        ) : null}
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="empty-state">
          <p>No vehicles match this filter yet.</p>
        </div>
      ) : (
        <div className="vehicle-grid">
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
                <div className="vehicle-topline">
                  <span className={`status ${vehicle.status}`}>
                    {vehicle.status}
                  </span>
                  <span className="type-label">{vehicle.type}</span>
                  {vehicle.stockNumber ? (
                    <span className="stock-label">Stock {vehicle.stockNumber}</span>
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

function numberFromLabel(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(parsed) || parsed === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parsed;
}
