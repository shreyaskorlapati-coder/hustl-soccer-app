export type Sport =
  | "soccer"
  | "basketball"
  | "tennis"
  | "baseball"
  | "volleyball"
  | "golf"
  | "swimming"
  | "general";

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  osm_type: string;
  osm_id: number;
  sport: string | null;
  distance_miles: number;
  distance_km: number;
  tags: Record<string, string>;
}

export interface PlacesResponse {
  count: number;
  results: Place[];
}

export type RootStackParamList = {
  Home: undefined;
  Results: { lat: number; lon: number; sport: Sport; radius: number; locationLabel: string };
  Map: { lat: number; lon: number; places: Place[]; locationLabel: string };
};
