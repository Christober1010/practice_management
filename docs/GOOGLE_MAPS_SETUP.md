# Google Maps Address Autocomplete Setup

Mahaverse uses the Google Places API for address autocomplete in forms (e.g. facility address, billing address in the Launchpad).

## Prerequisites

1. A [Google Cloud](https://console.cloud.google.com/) project
2. Billing enabled (Places API has a free tier; see [pricing](https://developers.google.com/maps/billing-and-pricing))

## Setup Steps

### 1. Enable APIs

In [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library):

- Enable **Maps JavaScript API**
- Enable **Places API (New)** — required for the Place Autocomplete Data API

### 2. Create an API Key

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create **API key**
3. (Recommended) Restrict the key:
   - **Application restrictions**: HTTP referrers
   - Add your domains, e.g. `https://yourdomain.com/*`, `http://localhost:3000/*`

### 3. Add to Environment

Add to your Next.js env (e.g. `.env.local`, `.env.test`, or your deployment env):

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

`NEXT_PUBLIC_` is required because the key is used in the browser to load the Maps script.

## Usage

The `AddressAutocomplete` component is used in:

- **Launchpad LocationStep**: Facility address and billing address fields
- **Add/Edit Client Modal**: Address Line 1 for each client address

It can be reused elsewhere:

```tsx
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

<AddressAutocomplete
  value={address}
  onChange={setAddress}
  onAddressSelect={(addr) => {
    // addr: addressLine1, locality, administrativeAreaShort, postalCode, countryShort, etc.
    setCity(addr.locality);
    setState(addr.administrativeAreaShort);
    setZip(addr.postalCode);
  }}
  countryRestrictions={['us', 'ca', 'mx']}
  debounceMs={500}
  minLength={3}
  placeholder="Start typing to search address..."
/>
```

### Debouncing (fewer API calls)

The component debounces input to reduce API usage:

- **debounceMs** (default `500`): Wait this long after the user stops typing before fetching suggestions. Use `1000` or `1500` for even fewer calls.
- **minLength** (default `3`): Minimum characters before fetching (avoids wasteful calls for "a", "ab", etc.).

## Verifying the API Is Being Called

### 1. Browser DevTools → Network tab

1. Open DevTools (F12) → **Network** tab
2. Clear existing requests
3. Focus the Address Line 1 field and type (e.g. "123 Main")
4. Filter or look for requests to:
   - `maps.googleapis.com`
   - `google.com` (Paths like `/maps/rpc/` or `/maps/api/`)
   - `khms0.googleapis.com`

Predictions appear after you stop typing for ~500ms (debounce) and enter at least 3 characters. If you see no requests, the script likely didn’t load or the Autocomplete never attached.

### 2. Enable debug logging

Add `debug={true}` to `AddressAutocomplete` where it’s used. The console will log:

- `hasApiKey` – whether an API key is present
- `isLoaded` – whether the Google script finished loading
- `loadError` – any script load error
- Debug status line when `debug={true}` shows debounce/min-length and readiness

Example (temporary, remove after debugging):

```tsx
<AddressAutocomplete
  debug={true}
  value={address}
  onChange={...}
  ...
/>
```

If `hasApiKey: false` or `loadError` has a message, fix the API key or environment. If `isLoaded: false` persists, the script is not loading.

## Fallback Behavior

- If the API key is missing or invalid, the component falls back to a plain text input
- If script load fails, the user can still enter the address manually
