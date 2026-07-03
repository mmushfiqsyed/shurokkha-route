export interface Coordinates {
  lat: number;
  lng: number;
}

export type ShelterStatus = "Active" | "At Risk" | "Full";

export interface ShelterInventory {
  food: number;
  water: number;
  medicine: number;
}

export interface Shelter {
  id: string;
  name: string;
  coordinates: Coordinates;
  currentCapacity: number;
  maxCapacity: number;
  inventory: ShelterInventory;
  status: ShelterStatus;
}

export type RouteStatus = "Safe" | "Blocked" | "Flooded";

export interface Route {
  id: string;
  name: string;
  path: Coordinates[];
  status: RouteStatus;
  lastUpdated: string;
}

export type AssetType = "Food Truck" | "Ambulance" | "Rescue Team";

export type AssetStatus = "In Transit" | "Available" | "Deployed";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  coordinates: Coordinates;
  status: AssetStatus;
  destinationId?: string;
}

export type DisasterType = "Flood" | "Earthquake" | "Cyclone" | "Fire";

export type DisasterSeverity = "Low" | "Medium" | "High" | "Critical";

export interface DisasterEvent {
  id: string;
  type: DisasterType;
  severity: DisasterSeverity;
  coordinates: Coordinates;
  timestamp: string;
  description: string;
}
