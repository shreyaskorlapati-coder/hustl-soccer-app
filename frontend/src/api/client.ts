import axios from "axios";
import type { AxiosError } from "axios";
import Constants from "expo-constants";

import { GeocodeResult, PlacesResponse, Sport } from "../types";

function resolveApiBaseUrl(): string {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl;
  }

  const configuredApiUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim();
  const configuredUsesLocalhost =
    configuredApiUrl?.includes("localhost") || configuredApiUrl?.includes("127.0.0.1");

  const expoConfigWithHost = Constants.expoConfig as
    | (typeof Constants.expoConfig & { hostUri?: string })
    | null;
  const hostUri = expoConfigWithHost?.hostUri;
  if (hostUri) {
    const [host] = hostUri.split(":");
    if (host && configuredUsesLocalhost) {
      return `http://${host}:8000`;
    }
  }

  return configuredApiUrl ?? "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

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

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>;
  const detail = axiosError.response?.data?.detail;

  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  if (axiosError.code === "ECONNABORTED") {
    return "The request timed out. Please retry in a moment.";
  }

  if (axiosError.message && axiosError.message.toLowerCase().includes("network error")) {
    return "Network error: could not reach the backend API.";
  }

  return fallbackMessage;
}
