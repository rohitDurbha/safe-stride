import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type LatLon = [number, number];

interface Suggestion {
  name: string;
  coords: LatLon;
}

interface DestinationInputProps {
  destination: string;
  setDestination: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  // Coordinates of a picked suggestion, or null once the text is edited
  setSourceCoords: (coords: LatLon | null) => void;
  setDestinationCoords: (coords: LatLon | null) => void;
  onCalculateRoute: () => void;
  isLoading: boolean;
}

const DestinationInput: React.FC<DestinationInputProps> = ({
  destination,
  setDestination,
  source,
  setSource,
  setSourceCoords,
  setDestinationCoords,
  onCalculateRoute,
  isLoading,
}) => {
  const [destinationSuggestions, setDestinationSuggestions] = useState<Suggestion[]>([]);
  const [sourceSuggestions, setSourceSuggestions] = useState<Suggestion[]>([]);
  const destinationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const sourceDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = async (query: string, setSuggestions: (suggestions: Suggestion[]) => void) => {
    if (query.length < 3) return setSuggestions([]);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            format: 'json',
            q: query,
            viewbox: '-122.35,37.90,-122.15,37.70',
            bounded: 1,
          },
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'SafeStrideApp/1.0',
          },
        }
      );
      const suggestions: Suggestion[] = response.data
        .map((item: { display_name: string; lat: string; lon: string }) => ({
          name: item.display_name,
          coords: [Number(item.lat), Number(item.lon)] as LatLon,
        }))
        .filter((item: Suggestion) => item.coords.every(Number.isFinite));
      setSuggestions(suggestions.slice(0, 5));
    } catch (err) {
      console.error('Error fetching suggestions', err);
      setSuggestions([]);
    }
  };

  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    setDestinationCoords(null);
    if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    destinationDebounceRef.current = setTimeout(() => fetchSuggestions(val, setDestinationSuggestions), 300);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSource(val);
    setSourceCoords(null);
    if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    sourceDebounceRef.current = setTimeout(() => fetchSuggestions(val, setSourceSuggestions), 300);
  };

  const handleSuggestionClick = (
    suggestion: Suggestion,
    setValue: (value: string) => void,
    setCoords: (coords: LatLon | null) => void,
    setSuggestions: (suggestions: Suggestion[]) => void
  ) => {
    setValue(suggestion.name);
    setCoords(suggestion.coords);
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDestinationSuggestions([]);
    setSourceSuggestions([]);
    onCalculateRoute();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white shadow-md rounded-lg p-2 flex gap-2 w-[80%] max-w-md"
    >
      <div className="flex flex-col w-full relative">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input
              value={source}
              onChange={handleSourceChange}
              placeholder="Starting point (leave empty to use your location)"
              className="w-full text-sm h-8"
              autoComplete="off"
            />
            {sourceSuggestions.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-white border border-input rounded shadow-lg z-[1000] max-h-40 overflow-auto">
                {sourceSuggestions.map((s, idx) => (
                  <li
                    key={idx}
                    onClick={() => handleSuggestionClick(s, setSource, setSourceCoords, setSourceSuggestions)}
                    className="px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative">
            <Input
              value={destination}
              onChange={handleDestinationChange}
              placeholder="Enter destination..."
              className="w-full text-sm h-8"
              autoComplete="off"
            />
            {destinationSuggestions.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-white border border-input rounded shadow-lg z-[1000] max-h-40 overflow-auto">
                {destinationSuggestions.map((s, idx) => (
                  <li
                    key={idx}
                    onClick={() => handleSuggestionClick(s, setDestination, setDestinationCoords, setDestinationSuggestions)}
                    className="px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <Button type="submit" disabled={isLoading} size="sm" className="h-8">
        Go
      </Button>
    </form>
  );
};

export default DestinationInput;
