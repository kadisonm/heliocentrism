import type { TemperatureUnit, WeatherLocation } from '../types';

// Open-Meteo is free and keyless, so it's safe to call straight from the browser of a static site.
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
// Where the data's attribution links to.
export const OPEN_METEO_SITE_URL = 'https://open-meteo.com/';

// A human-readable 7-day forecast page for the location (Open-Meteo itself has no per-place pages).
// Meteoblue takes coordinates as e.g. "33.868S151.207E".
export function meteoblueForecastUrl({ latitude, longitude }: WeatherLocation): string {
  const lat = `${Math.abs(latitude).toFixed(3)}${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(3)}${longitude < 0 ? 'W' : 'E'}`;
  return `https://www.meteoblue.com/en/weather/week/${lat}${lon}`;
}

export type WeatherSnapshot = {
  temperature: number;
  code: number; // WMO weather code — see weatherCodes.ts
  isDay: boolean;
  high: number;
  low: number;
  uvMax: number;
  rainChance: number; // 0..100
  fetchedAt: string; // ISO 8601
};

type GeocodingResult = { name: string; latitude: number; longitude: number; admin1?: string; country?: string };

export function parsePlaces(json: { results?: GeocodingResult[] }): WeatherLocation[] {
  return (json.results ?? []).map((result) => ({
    name: result.name,
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

export async function searchPlaces(query: string): Promise<WeatherLocation[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en' });
  const response = await fetch(`${GEOCODING_URL}?${params}`);
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  return parsePlaces(await response.json());
}

type ForecastResponse = {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    uv_index_max: number[];
    precipitation_probability_max: (number | null)[];
  };
};

export function parseForecast(json: ForecastResponse, fetchedAt: string): WeatherSnapshot {
  const { current, daily } = json;
  return {
    temperature: current.temperature_2m,
    code: current.weather_code,
    isDay: current.is_day === 1,
    high: daily.temperature_2m_max[0],
    low: daily.temperature_2m_min[0],
    uvMax: daily.uv_index_max[0] ?? 0,
    rainChance: daily.precipitation_probability_max[0] ?? 0,
    fetchedAt,
  };
}

export async function fetchForecast(location: WeatherLocation, unit: TemperatureUnit): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
    temperature_unit: unit,
  });
  const response = await fetch(`${FORECAST_URL}?${params}`);
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`);
  return parseForecast(await response.json(), new Date().toISOString());
}
