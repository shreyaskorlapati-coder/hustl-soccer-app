import axios from "axios";
import Constants from "expo-constants";

import { GeocodeResult, PlacesResponse, Sport } from "../types";

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const { data } = await client.get<GeocodeResult>("/geocode", {
    params: { q: query },
  });
  return data;
}

export async function searchPlaces(
  lat: number,
  lon: number,
  sport: Sport,
  radius: number
): Promise<PlacesResponse> {
  const { data } = await client.get<PlacesResponse>("/places", {
    params: { lat, lon, sport, radius },
  });
  return data;
}
