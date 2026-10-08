import { meteoblueForecastUrl, parseForecast, parsePlaces } from '../../lib/weather/openMeteo';
import { uvLevel, weatherCondition } from '../../lib/weather/weatherCodes';

describe('parseForecast', () => {
  it("reads current conditions and today's daily values", () => {
    // Trimmed from a real Open-Meteo response for Sydney.
    const json = {
      current: { temperature_2m: 17.3, weather_code: 2, is_day: 1 },
      daily: { temperature_2m_max: [17.6], temperature_2m_min: [12.1], uv_index_max: [7.4], precipitation_probability_max: [71] },
    };
    expect(parseForecast(json, 'at')).toEqual({
      temperature: 17.3,
      code: 2,
      isDay: true,
      high: 17.6,
      low: 12.1,
      uvMax: 7.4,
      rainChance: 71,
      fetchedAt: 'at',
    });
  });

  it('treats a missing rain probability as 0%', () => {
    const json = {
      current: { temperature_2m: 5, weather_code: 0, is_day: 0 },
      daily: { temperature_2m_max: [8], temperature_2m_min: [1], uv_index_max: [1], precipitation_probability_max: [null] },
    };
    expect(parseForecast(json, 'at').rainChance).toBe(0);
  });
});

describe('parsePlaces', () => {
  it('builds a readable label from the place hierarchy', () => {
    const places = parsePlaces({ results: [{ name: 'Sydney', latitude: -33.9, longitude: 151.2, admin1: 'New South Wales', country: 'Australia' }] });
    expect(places[0].label).toBe('Sydney, New South Wales, Australia');
  });

  it('handles no results', () => {
    expect(parsePlaces({})).toEqual([]);
  });
});

describe('weather codes', () => {
  it('maps WMO codes to labels and falls back for unknown ones', () => {
    expect(weatherCondition(2)).toEqual({ label: 'Partly cloudy', icon: 'partly-cloudy' });
    expect(weatherCondition(95).icon).toBe('thunder');
    expect(weatherCondition(1234).label).toBe('Unknown');
  });

  it('bands UV by the WHO scale', () => {
    expect([0, 2.9, 3, 5.9, 6, 7.9, 8, 10.9, 11].map(uvLevel)).toEqual([
      'Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Very high', 'Very high', 'Extreme',
    ]);
  });
});

describe('meteoblueForecastUrl', () => {
  it('writes coordinates with hemisphere letters', () => {
    const sydney = { name: 'Sydney', label: 'Sydney', latitude: -33.86785, longitude: 151.20732 };
    const newYork = { name: 'New York', label: 'New York', latitude: 40.71427, longitude: -74.00597 };
    expect(meteoblueForecastUrl(sydney)).toBe('https://www.meteoblue.com/en/weather/week/33.868S151.207E');
    expect(meteoblueForecastUrl(newYork)).toBe('https://www.meteoblue.com/en/weather/week/40.714N74.006W');
  });
});
