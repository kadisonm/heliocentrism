'use client';

import { useEffect, useState } from 'react';
import type { TemperatureUnit, WeatherLocation } from '../../../lib/types';
import { fetchForecast, type WeatherSnapshot } from '../../../lib/weather/openMeteo';

const FRESH_MS = 30 * 60_000;
const STORAGE_PREFIX = 'heliocentrism:weather:';

type CacheEntry<T> = { value: T; at: number };

// Shared by every weather widget: same city + unit = one request, and a reload reuses localStorage.
const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function readCache<T>(key: string): CacheEntry<T> | null {
  const hit = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (hit) return hit;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (!stored) return null;
    const entry = JSON.parse(stored) as CacheEntry<T>;
    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  const entry = { value, at: Date.now() };
  memoryCache.set(key, entry);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or blocked — the in-memory copy still works for this session.
  }
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.value);
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const request = load()
    .then((value) => {
      writeCache(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

type Loaded = { key: string; snapshot: WeatherSnapshot } | { key: string; error: string };

export type WeatherState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  snapshot: WeatherSnapshot | null;
  error: string | null;
};

// Results are keyed by request so a location/unit change shows "loading" rather than the previous city's data.
export function useWeather(location: WeatherLocation | null, unit: TemperatureUnit): WeatherState {
  const forecastKey = location ? `forecast:${location.latitude},${location.longitude}:${unit}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!location || !forecastKey) return;
    let cancelled = false;

    const load = () => {
      cached(forecastKey, () => fetchForecast(location, unit))
        .then((snapshot) => !cancelled && setLoaded({ key: forecastKey, snapshot }))
        .catch((error) => !cancelled && setLoaded({ key: forecastKey, error: error instanceof Error ? error.message : 'Something went wrong' }));
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const intervalId = setInterval(load, FRESH_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // location is tracked through forecastKey (its coordinates), so a new-but-equal object doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastKey]);

  const current = loaded?.key === forecastKey ? loaded : null;
  return {
    status: !forecastKey ? 'idle' : !current ? 'loading' : 'error' in current ? 'error' : 'ready',
    snapshot: current && 'snapshot' in current ? current.snapshot : null,
    error: current && 'error' in current ? current.error : null,
  };
}
