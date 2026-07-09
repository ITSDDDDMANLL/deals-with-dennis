import usedInventory from "./used-inventory.json";

export type VehicleType = "new" | "used";
export type ClaimStatus = "unknown" | "no-claim" | "minor-claim" | "claim-over-5k";

export type Vehicle = {
  id: string;
  type: VehicleType;
  year: number;
  make: string;
  model: string;
  trim: string;
  stockNumber?: string;
  vin?: string;
  className?: string;
  priceLabel: string;
  mileageLabel: string;
  drivetrain: string;
  transmission?: string;
  fuel?: string;
  exteriorColor: string;
  status: "available" | "incoming" | "sold";
  claimStatus?: ClaimStatus;
  sourceVehicle?: string;
  isFeatured?: boolean;
  imageUrls?: string[];
  details?: string;
  highlights?: string;
};

const newVehiclePlaceholders: Vehicle[] = [
  {
    id: "sample-f150-xlt",
    type: "new",
    year: 2026,
    make: "Ford",
    model: "F-150",
    trim: "XLT SuperCrew",
    priceLabel: "Ask for pricing",
    mileageLabel: "New",
    drivetrain: "4x4",
    exteriorColor: "Oxford White",
    status: "available",
  },
  {
    id: "sample-bronco-sport",
    type: "new",
    year: 2026,
    make: "Ford",
    model: "Bronco Sport",
    trim: "Big Bend",
    priceLabel: "Ask for pricing",
    mileageLabel: "New",
    drivetrain: "AWD",
    exteriorColor: "Carbonized Gray",
    status: "incoming",
  },
];

export function getFeaturedVehicles() {
  return [...newVehiclePlaceholders, ...(usedInventory as Vehicle[])];
}
