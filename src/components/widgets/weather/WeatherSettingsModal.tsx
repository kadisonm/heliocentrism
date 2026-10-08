'use client';

import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TemperatureUnit, WeatherLocation } from '../../../lib/types';
import { searchPlaces } from '../../../lib/weather/openMeteo';
import Modal from '../../common/Modal';
import Tabs from '../../common/Tabs';
import { useWidgetContext } from '../../grid/widgetContext';

type WeatherSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const UNIT_OPTIONS: { value: TemperatureUnit; label: string }[] = [
  { value: 'celsius', label: '°C' },
  { value: 'fahrenheit', label: '°F' },
];

const SEARCH_DELAY_MS = 300;

type SearchState = { query: string; results: WeatherLocation[] } | { query: string; error: string };

export default function WeatherSettingsModal({ isOpen, onClose }: WeatherSettingsModalProps) {
  const { widget, onUpdate } = useWidgetContext();
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit>('celsius');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState | null>(null);

  // Re-seed from the saved config on every open, so closing without saving discards edits.
  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLocation(widget.weather?.location ?? null);
    setUnit(widget.weather?.unit ?? 'celsius');
    setQuery('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, widget.weather]);

  // Debounced place search; results are tagged with their query so a slow response can't overwrite a newer one.
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const timeoutId = setTimeout(() => {
      searchPlaces(trimmedQuery)
        .then((results) => setSearch({ query: trimmedQuery, results }))
        .catch((error: Error) => setSearch({ query: trimmedQuery, error: error.message }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [trimmedQuery]);
  const currentSearch = search?.query === trimmedQuery ? search : null;

  const handleSave = () => {
    onUpdate({ weather: { location, unit } });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Weather Settings" scope="instance" scopeLabel="Only this widget is affected">
      <div className="settings-section">
        <div className="settings-field">
          <label>City</label>
          <p className="weather-settings__current">
            <MapPin size={14} />
            {location ? location.label : 'No city chosen yet'}
          </p>
          <input
            type="text"
            className="settings-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for a city"
          />
          {trimmedQuery.length >= 2 &&
            (!currentSearch ? (
              <p className="settings-hint">Searching…</p>
            ) : 'error' in currentSearch ? (
              <p className="settings-hint">Search failed: {currentSearch.error}</p>
            ) : currentSearch.results.length === 0 ? (
              <p className="settings-hint">No places match &quot;{trimmedQuery}&quot;.</p>
            ) : (
              <ul className="weather-settings__results">
                {currentSearch.results.map((place) => (
                  <li key={`${place.latitude},${place.longitude}`}>
                    <button
                      type="button"
                      className="weather-settings__result"
                      onClick={() => {
                        setLocation(place);
                        setQuery('');
                      }}
                    >
                      {place.label}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>

        <div className="settings-field">
          <label>Temperature unit</label>
          <Tabs options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Temperature unit" />
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-button settings-button-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
