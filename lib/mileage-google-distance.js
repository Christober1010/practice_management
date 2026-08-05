/**
 * Mileage distance helpers for static Next export (no /api routes).
 * Geocode via Photon (OSM), driving miles via public OSRM — all from the browser.
 */

export function normalizeMileageAddress(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Drop unit/apt — geocoders often return zero results with these
  s = s
    .replace(/\b(apt|apartment|unit|suite|ste|#)\s*[.]?\s*[a-z0-9-]+\b/gi, "")
    .replace(/\bUSA\b/gi, "")
    .replace(/\bUnited States( of America)?\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/^,\s*|,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (out.some((o) => o.toLowerCase() === lower)) continue;
    if (out.some((o) => o.toLowerCase().includes(lower) && o.length > p.length)) continue;
    const idx = out.findIndex(
      (o) => lower.includes(o.toLowerCase()) && p.length > o.length
    );
    if (idx >= 0) {
      out[idx] = p;
      continue;
    }
    out.push(p);
  }
  return out.join(", ");
}

async function photonGeocode(address) {
  const q = normalizeMileageAddress(address);
  if (!q || q.length < 5) return null;
  const url =
    "https://photon.komoot.io/api/?" +
    new URLSearchParams({ q, limit: "1", lang: "en" });
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const coords = json?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Rough continental US check
  if (lat < 24 || lat > 50 || lng < -125 || lng > -66) return null;
  return { lat, lng };
}

async function osrmDrivingMiles(lat1, lng1, lat2, lng2) {
  if (Math.abs(lat1 - lat2) < 1e-7 && Math.abs(lng1 - lng2) < 1e-7) return 0;
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false&alternatives=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.code !== "Ok" || json?.routes?.[0]?.distance == null) return null;
  return Math.round((Number(json.routes[0].distance) / 1609.344) * 100) / 100;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const a = Number(lat1);
  const b = Number(lng1);
  const c = Number(lat2);
  const d = Number(lng2);
  if (![a, b, c, d].every((n) => Number.isFinite(n))) return null;
  const R = 3958.8;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 100) / 100;
}

/**
 * Enrich stops (geocode) and legs (driving miles) in the browser.
 */
export async function enrichMileageWithGoogle(stops, legs) {
  if (!Array.isArray(stops)) {
    return { stops, legs, usedGoogle: false, error: "bad_stops" };
  }

  const geocodeCache = new Map();
  async function coordsFor(address) {
    const key = normalizeMileageAddress(address).toLowerCase();
    if (!key) return null;
    if (geocodeCache.has(key)) return geocodeCache.get(key);
    const coords = await photonGeocode(key);
    geocodeCache.set(key, coords);
    return coords;
  }

  const nextStops = [];
  for (const s of stops) {
    const address = normalizeMileageAddress(s.address || "") || s.address || null;
    let lat = s.lat;
    let lng = s.lng;
    const missing =
      lat == null ||
      lng == null ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lng));
    if (missing && address) {
      const c = await coordsFor(address);
      if (c) {
        lat = c.lat;
        lng = c.lng;
      }
    }
    nextStops.push({
      ...s,
      // Keep original display address if present; normalized used for geocode only
      address: s.address || address,
      lat: lat ?? null,
      lng: lng ?? null,
    });
  }

  const stopMap = new Map(nextStops.map((s) => [s.stop_key || s.id, s]));
  const mileCache = new Map();

  async function milesBetween(from, to) {
    const key = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
    if (mileCache.has(key)) return mileCache.get(key);
    let miles = await osrmDrivingMiles(from.lat, from.lng, to.lat, to.lng);
    let mode = "driving";
    if (miles == null) {
      miles = haversineMiles(from.lat, from.lng, to.lat, to.lng);
      mode = "straight";
    }
    if (miles != null && miles > 500) {
      miles = null;
      mode = "invalid";
    }
    const result = { miles, mode };
    mileCache.set(key, result);
    return result;
  }

  const nextLegs = [];
  for (const leg of legs || []) {
    const from = stopMap.get(leg.from_stop_key);
    const to = stopMap.get(leg.to_stop_key);
    const fromAddr = from?.address || leg.from_address || "";
    const toAddr = to?.address || leg.to_address || "";

    let miles = null;
    let mode = leg.distance_mode || null;

    if (
      from?.lat != null &&
      from?.lng != null &&
      to?.lat != null &&
      to?.lng != null
    ) {
      const r = await milesBetween(
        { lat: Number(from.lat), lng: Number(from.lng) },
        { lat: Number(to.lat), lng: Number(to.lng) }
      );
      miles = r.miles;
      mode = r.mode;
    }

    nextLegs.push({
      ...leg,
      from_address: fromAddr || leg.from_address,
      to_address: toAddr || leg.to_address,
      from_lat: from?.lat ?? leg.from_lat ?? null,
      from_lng: from?.lng ?? leg.from_lng ?? null,
      to_lat: to?.lat ?? leg.to_lat ?? null,
      to_lng: to?.lng ?? leg.to_lng ?? null,
      miles: miles != null ? miles : leg.miles,
      distance_mode: mode,
    });
  }

  const mapped = nextStops.filter((s) => s.lat != null && s.lng != null).length;
  const anyMiles = nextLegs.some((l) => l.miles != null && Number(l.miles) >= 0 && l.distance_mode);
  return {
    stops: nextStops,
    legs: nextLegs,
    usedGoogle: false,
    usedBrowserMaps: true,
    error: mapped === 0 ? "geocode_failed" : null,
    mappedStops: mapped,
    anyMiles,
  };
}
