'use client';

import * as React from 'react';

/** Stable reference for LoadScript - avoids "LoadScript has been reloaded unintentionally" */
const LIBRARIES: ['places'] = ['places'];
import { useJsApiLoader } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Parsed address from Google Places selection */
export interface ParsedAddress {
  streetNumber: string;
  route: string;
  addressLine1: string;
  locality: string;
  administrativeArea: string;
  /** State/province code (e.g. "CA", "ON") */
  administrativeAreaShort: string;
  postalCode: string;
  country: string;
  countryShort: string;
  formattedAddress: string;
}

// New Places API AddressComponent uses longText/shortText
interface NewAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function parseNewAddressComponents(
  components: NewAddressComponent[] | undefined
): Partial<ParsedAddress> {
  if (!components || components.length === 0) return {};

  const getByType = (type: string, useShort = false) => {
    const comp = components.find((c) => c.types?.includes(type));
    if (!comp) return '';
    return useShort ? (comp.shortText || comp.longText || '') : (comp.longText || comp.shortText || '');
  };

  const streetNumber = getByType('street_number');
  const route = getByType('route');
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim();

  return {
    streetNumber,
    route,
    addressLine1: addressLine1 || getByType('premise') || getByType('subpremise'),
    locality: getByType('locality') || getByType('sublocality') || getByType('sublocality_level_1'),
    administrativeArea: getByType('administrative_area_level_1'),
    administrativeAreaShort: getByType('administrative_area_level_1', true),
    postalCode: getByType('postal_code'),
    country: getByType('country'),
    countryShort: getByType('country', true),
    formattedAddress: '',
  };
}

// Place Autocomplete Data API types (from google.maps.places)
interface PlacePredictionLike {
  text: { toString: () => string };
  toPlace: () => Promise<unknown>;
}
interface SuggestionLike {
  placePrediction: PlacePredictionLike;
}

export interface AddressAutocompleteProps
  extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** Called when user selects an address from autocomplete with parsed components */
  onAddressSelect?: (address: ParsedAddress) => void;
  /** Restrict predictions to specific country codes (e.g. ['us']) */
  countryRestrictions?: string[];
  /** Optional: override API key (defaults to NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) */
  apiKey?: string;
  /** Optional: id for the input (for accessibility) */
  id?: string;
  /** Debounce delay in ms before fetching suggestions (default 500). Higher = fewer API calls. */
  debounceMs?: number;
  /** Minimum characters before fetching (default 3) */
  minLength?: number;
  /** Enable console logs for debugging */
  debug?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  countryRestrictions,
  apiKey,
  className,
  id,
  debounceMs = 500,
  minLength = 3,
  debug = false,
  ...inputProps
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = React.useState<SuggestionLike[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = React.useRef<unknown>(null);
  const lastInputRef = React.useRef('');

  const mapsApiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = Boolean(mapsApiKey?.trim());

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-address-autocomplete',
    googleMapsApiKey: mapsApiKey || '',
    libraries: LIBRARIES,
  });

  // Create new session token (call after user selects a place, or on first fetch)
  const getOrCreateSessionToken = React.useCallback(async () => {
    const lib = await google.maps.importLibrary('places') as Record<string, new () => unknown>;
    const Token = lib.AutocompleteSessionToken;
    if (!Token) return null;
    const token = new Token();
    sessionTokenRef.current = token;
    return token;
  }, []);

  // Fetch autocomplete suggestions (debounced)
  const fetchSuggestions = React.useCallback(async (input: string) => {
    if (!input.trim() || input.length < minLength || !window.google?.maps?.importLibrary) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const lib = await google.maps.importLibrary('places') as Record<string, { fetchAutocompleteSuggestions: (req: object) => Promise<{ suggestions: SuggestionLike[] }> }>;
      const AutocompleteSuggestion = lib.AutocompleteSuggestion;
      if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        if (debug) console.warn('[AddressAutocomplete] fetchAutocompleteSuggestions not found');
        setSuggestions([]);
        return;
      }

      const token = sessionTokenRef.current ?? await getOrCreateSessionToken();
      const request: Record<string, unknown> = {
        input: input.trim(),
        sessionToken: token,
        language: 'en',
      };
      if (countryRestrictions && countryRestrictions.length > 0) {
        request.includedRegionCodes = countryRestrictions;
      }

      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      setSuggestions(results ?? []);
      setActiveIndex(-1);
      setIsOpen(true);
    } catch (err) {
      if (debug) console.error('[AddressAutocomplete] fetchAutocompleteSuggestions error:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [minLength, countryRestrictions, getOrCreateSessionToken, debug]);

  // Debounced input handler
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (newValue.trim().length < minLength) {
      setSuggestions([]);
      setIsOpen(false);
      if (newValue.trim().length === 0) sessionTokenRef.current = null; // Reset session when cleared
      return;
    }

    debounceRef.current = setTimeout(() => {
      lastInputRef.current = newValue;
      fetchSuggestions(newValue);
      debounceRef.current = null;
    }, debounceMs);
  }, [onChange, minLength, debounceMs, fetchSuggestions]);

  // Select a suggestion
  const selectSuggestion = React.useCallback(async (suggestion: SuggestionLike) => {
    const pred = suggestion.placePrediction;
    if (!pred?.toPlace) return;

    setIsOpen(false);
    setSuggestions([]);
    sessionTokenRef.current = null; // End session; next fetch will create new token

    try {
      const place = await pred.toPlace();
      await (place as { fetchFields: (opts: { fields: string[] }) => Promise<void> }).fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
      const components = (place as { addressComponents?: NewAddressComponent[] }).addressComponents;
      const formatted = (place as { formattedAddress?: string }).formattedAddress || '';
      const displayText = pred.text?.toString?.() ?? formatted;

      const parsed = parseNewAddressComponents(components);
      const fullParsed: ParsedAddress = {
        ...parsed,
        formattedAddress: formatted,
      } as ParsedAddress;

      onChange(parsed.addressLine1 || displayText || '');
      onAddressSelect?.(fullParsed);
    } catch (err) {
      if (debug) console.error('[AddressAutocomplete] selectSuggestion error:', err);
    }
  }, [onChange, onAddressSelect, debug]);

  // Close on outside click
  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Keyboard nav
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }, [isOpen, suggestions, activeIndex, selectSuggestion]);

  // Scroll active into view
  React.useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Cleanup debounce on unmount
  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const debugStatus = debug ? (
    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
      {!hasApiKey && 'No API key'}
      {hasApiKey && loadError && `Error: ${loadError.message}`}
      {hasApiKey && !loadError && !isLoaded && 'Loading…'}
      {hasApiKey && !loadError && isLoaded && `✓ Ready (debounce ${debounceMs}ms, min ${minLength} chars)`}
    </span>
  ) : null;

  if (!hasApiKey || loadError) {
    return (
      <div>
        <Input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(className)}
          placeholder={!hasApiKey ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" : "Google Maps failed — enter address manually"}
          {...inputProps}
        />
        {debugStatus}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div>
        <Input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn(className)}
          placeholder="Loading Google Maps…"
          disabled
          {...inputProps}
        />
        {debugStatus}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value ?? ''}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        className={cn(className)}
        placeholder="Search for an address…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={activeIndex >= 0 && id ? `${id}-option-${activeIndex}` : undefined}
        {...inputProps}
      />
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-[99999] mt-1 w-full rounded-md border border-input bg-background py-1 shadow-lg max-h-60 overflow-auto"
        >
          {isLoading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : (
            suggestions.map((s, i) => {
              const text = s.placePrediction?.text?.toString?.() ?? '';
              return (
                <li
                  key={i}
                  id={id ? `${id}-option-${i}` : undefined}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm',
                    i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  )}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                >
                  {text}
                </li>
              );
            })
          )}
        </ul>
      )}
      {debugStatus}
    </div>
  );
}
