import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, Circle, Loader2, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Place, searchPlaces, shortName } from '@/lib/places';
import type { LatLon } from '@/lib/mapSetup';

export type Period = 'auto' | 'day' | 'night';

export interface DirectionsValue {
  source: string;
  destination: string;
  sourceCoords: LatLon | null;
  destinationCoords: LatLon | null;
  period: Period;
}

type Field = 'source' | 'destination';

interface SearchPanelProps {
  mode: 'pill' | 'edit' | 'route';
  value: DirectionsValue;
  onChange: (next: DirectionsValue) => void;
  onOpen: () => void;
  onClose: () => void;
  onClear: () => void;
  onSubmit: () => void;
  isRouting: boolean;
  /** The avatar or sign in button shown at the end of the pill. */
  accessory: React.ReactNode;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'auto', label: 'Leave now' },
  { value: 'day', label: 'Daytime' },
  { value: 'night', label: 'Night' },
];

const SearchPanel: React.FC<SearchPanelProps> = ({
  mode, value, onChange, onOpen, onClose, onClear, onSubmit, isRouting, accessory,
}) => {
  const [activeField, setActiveField] = useState<Field>('destination');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);

  const lookUp = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const id = ++searchIdRef.current;
    if (query.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query);
        if (id === searchIdRef.current) setSuggestions(places);
      } catch (err) {
        console.warn('Address suggestions are unavailable right now', err);
        if (id === searchIdRef.current) setSuggestions([]);
      } finally {
        if (id === searchIdRef.current) setSearching(false);
      }
    }, 450);
  };

  const editField = (field: Field, text: string) => {
    setActiveField(field);
    onChange(field === 'source'
      ? { ...value, source: text, sourceCoords: null }
      : { ...value, destination: text, destinationCoords: null });
    lookUp(text);
  };

  const pick = (place: Place) => {
    onChange(activeField === 'source'
      ? { ...value, source: place.name, sourceCoords: place.coords }
      : { ...value, destination: place.name, destinationCoords: place.coords });
    searchIdRef.current++;
    setSuggestions([]);
    setSearching(false);
  };

  const swap = () => {
    onChange({
      ...value,
      source: value.destination,
      sourceCoords: value.destinationCoords,
      destination: value.source,
      destinationCoords: value.sourceCoords,
    });
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    searchIdRef.current++;
    setSuggestions([]);
    setSearching(false);
    onSubmit();
  };

  if (mode === 'pill') {
    return (
      <div className="surface flex h-14 items-center gap-1 rounded-full pl-2 pr-1.5 animate-blur-in">
        <button
          type="button"
          onClick={onOpen}
          className="press flex h-11 flex-1 items-center gap-3 rounded-full px-3 text-left text-[15px] text-muted-foreground"
        >
          <Search className="h-5 w-5 shrink-0 text-foreground" />
          <span className="truncate">Where are you walking to?</span>
        </button>
        {accessory}
      </div>
    );
  }

  if (mode === 'route') {
    return (
      <div className="surface flex h-14 items-center gap-1 rounded-full pl-1.5 pr-1.5 animate-blur-in">
        <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear route" className="shrink-0">
          <X className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={onOpen}
          className="press flex min-w-0 flex-1 flex-col justify-center rounded-full px-1 text-left leading-tight"
        >
          <span className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            From {value.source.trim() ? shortName(value.source) : 'your location'}
          </span>
          <span className="truncate text-[15px] font-medium">{shortName(value.destination)}</span>
        </button>
        {accessory}
      </div>
    );
  }

  const showList = suggestions.length > 0 || searching;

  return (
    <form
      onSubmit={submit}
      className="surface-solid flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[28px] animate-blur-in"
    >
      <div className="flex items-center gap-2 px-2 pt-2">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close directions">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-[15px] font-semibold">Safer walking route</h2>
      </div>

      <div className="flex items-stretch gap-3 px-4 pb-3 pt-2">
        <div className="flex flex-col items-center pt-[18px]" aria-hidden>
          <Circle className="h-3.5 w-3.5" strokeWidth={3} />
          <div className="my-1 w-px flex-1 border-l-2 border-dotted border-muted-foreground/50" />
          <MapPin className="mb-[16px] h-4 w-4 fill-foreground text-foreground" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FieldInput
            label="Starting point"
            placeholder="Your location"
            value={value.source}
            picked={!!value.sourceCoords}
            onFocus={() => setActiveField('source')}
            onText={(t) => editField('source', t)}
          />
          <FieldInput
            label="Destination"
            placeholder="Choose destination"
            value={value.destination}
            picked={!!value.destinationCoords}
            autoFocus={!value.destination}
            onFocus={() => setActiveField('destination')}
            onText={(t) => editField('destination', t)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={swap}
          aria-label="Swap start and destination"
          className="self-center"
        >
          <ArrowUpDown className="h-5 w-5" />
        </Button>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" role="radiogroup" aria-label="Time of walk">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value.period === p.value}
            onClick={() => onChange({ ...value, period: p.value })}
            className={cn(
              'press h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors',
              value.period === p.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-transparent text-foreground hover:bg-accent',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showList && (
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 py-1.5" aria-label="Suggested places">
          {searching && suggestions.length === 0 && (
            <li className="flex items-center gap-3 px-5 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching Oakland
            </li>
          )}
          {suggestions.map((s, i) => {
            const [title, ...rest] = s.name.split(', ');
            return (
              <li key={`${s.name}-${i}`} className="animate-blur-in" style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-4 px-5 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{title}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{rest.slice(0, 3).join(', ')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-border/70 p-3">
        <Button type="submit" size="lg" className="w-full" disabled={isRouting || !value.destination.trim()}>
          {isRouting ? <Loader2 className="animate-spin" /> : null}
          {isRouting ? 'Finding a safer route' : 'Find safer route'}
        </Button>
      </div>
    </form>
  );
};

interface FieldInputProps {
  label: string;
  placeholder: string;
  value: string;
  picked: boolean;
  autoFocus?: boolean;
  onFocus: () => void;
  onText: (text: string) => void;
}

const FieldInput = ({ label, placeholder, value, picked, autoFocus, onFocus, onText }: FieldInputProps) => (
  <div className="relative">
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      enterKeyHint="search"
      onFocus={onFocus}
      onChange={(e) => onText(e.target.value)}
      className={cn(
        'h-12 w-full rounded-xl border border-transparent bg-muted px-4 pr-10 text-base outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:bg-accent focus:border-foreground/80 focus:bg-background focus:ring-4 focus:ring-foreground/10',
        picked && 'font-medium',
      )}
    />
    {value && (
      <button
        type="button"
        aria-label={`Clear ${label.toLowerCase()}`}
        onClick={() => onText('')}
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

export default SearchPanel;
