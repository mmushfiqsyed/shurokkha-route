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

export interface CalculationStep {
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface WaterBody {
  id: string;
  name: string;
  path: Coordinates[];
}

export type AgentThoughtKind =
  | "crew_start"
  | "crew_end"
  | "agent_start"
  | "agent_end"
  | "thought"
  | "tool_start"
  | "tool_end"
  | "info"
  | "error";

export interface AgentThoughtEvent {
  kind: AgentThoughtKind;
  agent?: string;
  thought?: string | null;
  tool?: string | null;
  toolInput?: string | null;
  text?: string | null;
  output?: string | null;
  message?: string;
  ts: number;
}

export interface CrewResultPayload {
  scenario: {
    disasterType: string;
    location: string;
    coords: Coordinates | null;
    people: number;
    mobility: string;
  };
  hazard: Record<string, unknown> | null;
  shelter: Record<string, unknown> | null;
  routing: Record<string, unknown> | null;
  commander: Record<string, unknown> | null;
  advisory: Record<string, unknown> | null;
  advisoryText: string;
  summary: string;
}

export interface Recommendation {
  shelter: Shelter | null;
  route: Route | null;
  assets: Asset[];
  summary: string;
}
