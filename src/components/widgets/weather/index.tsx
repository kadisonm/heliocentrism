'use client';

import { ArrowDown, ArrowUp, CloudOff, Droplets, ExternalLink, MapPin, Sun } from 'lucide-react';
import { createElement } from 'react';
import { meteoblueForecastUrl, OPEN_METEO_SITE_URL } from '../../../lib/weather/openMeteo';
import { uvLevel, weatherCondition, type UvLevel } from '../../../lib/weather/weatherCodes';
import Badge, { type BadgeColor } from '../../common/Badge';
import WidgetPlaceholder from '../../common/WidgetPlaceholder';
import { useWidgetContext } from '../../grid/widgetContext';
import { useWeather } from './useWeather';
import { weatherIcon } from './weatherIcons';

const UV_COLORS: Record<UvLevel, BadgeColor> = {
  Low: 'success',
  Moderate: 'warning',
  High: 'warning',
  'Very high': 'error',
  Extreme: 'error',
};

const degrees = (value: number) => `${Math.round(value)}°`;

export default function WeatherWidget() {
  const { widget } = useWidgetContext();
  const location = widget.weather?.location ?? null;
  const unit = widget.weather?.unit ?? 'celsius';
  const { status, snapshot, error } = useWeather(location, unit);

  if (!location) return <WidgetPlaceholder icon={MapPin} message="Set a city via widget settings." />;

  const condition = snapshot ? weatherCondition(snapshot.code) : null;
  const uv = snapshot ? uvLevel(snapshot.uvMax) : null;

  return (
    <aside className="widget-content-shell">
      <div className="widget-content weather-widget">
        <div className="widget-content-header">
          <h2 title={location.label}>{location.name}</h2>
          <a
            className="weather-widget__forecast-link"
            href={meteoblueForecastUrl(location)}
            target="_blank"
            rel="noreferrer"
            title={`Full forecast for ${location.name} on Meteoblue`}
            aria-label={`Full forecast for ${location.name} on Meteoblue`}
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {status === 'loading' && <p className="widget-empty">Loading weather…</p>}

        {status === 'error' && (
          <div className="weather-widget__error">
            <CloudOff size={18} />
            <span>Couldn&apos;t load the forecast: {error}</span>
          </div>
        )}

        {snapshot && condition && uv && (
          <>
            <div className="weather-widget__hero">
              {createElement(weatherIcon(condition.icon, snapshot.isDay), { size: 44, className: 'weather-widget__icon' })}
              <div>
                <div className="weather-widget__temperature">{degrees(snapshot.temperature)}</div>
                <div className="weather-widget__condition">{condition.label}</div>
              </div>
            </div>

            <div className="weather-widget__stats">
              <span className="weather-widget__stat" title="Today's high and low">
                <ArrowUp size={13} />
                {degrees(snapshot.high)}
                <ArrowDown size={13} />
                {degrees(snapshot.low)}
              </span>
              <span className="weather-widget__stat" title="Chance of rain today">
                <Droplets size={13} />
                {snapshot.rainChance}%
              </span>
              <Badge icon={Sun} title={`UV ${Math.round(snapshot.uvMax)} · ${uv}`} ariaLabel={`Max UV index today: ${snapshot.uvMax} (${uv})`} color={UV_COLORS[uv]} />
            </div>

            {/* Open-Meteo's CC BY 4.0 licence asks for this attribution. */}
            <div className="weather-widget__footer">
              <span>Updated {new Date(snapshot.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
              <a className="weather-widget__source" href={OPEN_METEO_SITE_URL} target="_blank" rel="noreferrer" title="Weather data by Open-Meteo.com">
                Data: Open-Meteo
              </a>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
