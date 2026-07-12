"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Users, Phone, Mail, Navigation, RefreshCw, AlertCircle } from "lucide-react";

const MAP_LIBRARIES = ["places"];
const MAP_STYLE = { width: "100%", height: "300px", borderRadius: "8px" };
const RADIUS_OPTIONS = [5, 10, 25, 50];

/** Haversine distance between two lat/lng points, in miles. */
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Build a geocodable address string from address fields. */
function buildAddressString(obj) {
  if (!obj) return null;
  const parts = [
    obj.address_line_1 || obj.address || "",
    obj.city || "",
    obj.state || "",
    obj.zipcode || obj.zip || "",
    obj.country || "",
  ].map((s) => String(s).trim()).filter(Boolean);
  return parts.length >= 2 ? parts.join(", ") : null;
}

/** Geocode via in-page Google Maps Geocoder callback API. */
async function geocodeAddressViaJs(geocoder, address, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ coords: null, status: "TIMEOUT" });
    }, timeoutMs);
    geocoder.geocode({ address }, (results, status) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({ coords: { lat: loc.lat(), lng: loc.lng() }, status });
      } else {
        resolve({ coords: null, status: status || "UNKNOWN_ERROR" });
      }
    });
  });
}

/** Fallback geocoding via REST API for timeout cases. */
async function geocodeAddressViaHttp(address, apiKey, timeoutMs = 8000) {
  if (!apiKey) return { coords: null, status: "MISSING_API_KEY" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { coords: null, status: `HTTP_${res.status}` };
    }
    const json = await res.json();
    const status = json?.status || "UNKNOWN_ERROR";
    if (status === "OK" && json?.results?.[0]?.geometry?.location) {
      const loc = json.results[0].geometry.location;
      return { coords: { lat: Number(loc.lat), lng: Number(loc.lng) }, status };
    }
    return { coords: null, status };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { coords: null, status: "TIMEOUT" };
    }
    return { coords: null, status: "NETWORK_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}

/** Geocode with JS API first, then REST fallback on timeout/network stalls. */
async function geocodeAddress(geocoder, address, apiKey, timeoutMs = 8000) {
  const jsResult = await geocodeAddressViaJs(geocoder, address, timeoutMs);
  if (jsResult.coords) return jsResult;
  if (jsResult.status === "TIMEOUT") {
    return geocodeAddressViaHttp(address, apiKey, timeoutMs);
  }
  return jsResult;
}

function geocodeStatusMessage(status, address) {
  switch (status) {
    case "ZERO_RESULTS":
      return `Could not locate "${address}" on the map. Check address/city/state/zip/country values.`;
    case "REQUEST_DENIED":
      return "Google geocoding request denied. Check API key, referrer restrictions, and Geocoding API access.";
    case "OVER_QUERY_LIMIT":
      return "Google geocoding query limit reached. Please retry in a moment.";
    case "INVALID_REQUEST":
      return "Invalid geocoding request. Some address fields may be malformed.";
    case "TIMEOUT":
      return "Geocoding timed out. Please retry.";
    case "NETWORK_ERROR":
      return "Network error while geocoding. Check internet/adblock/firewall and retry.";
    case "MISSING_API_KEY":
      return "Google Maps API key is missing.";
    default:
      return `Could not locate "${address}" on the map (status: ${status || "UNKNOWN"}).`;
  }
}

function staffTypeColor(staffType) {
  const t = (staffType || "").toLowerCase();
  if (t.includes("bcba") || t.includes("supervisor")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (t.includes("rbt") || t.includes("technician")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (t.includes("admin")) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function NearbyStaffPanel({ client, staffList = [] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Reuse the same loader id as AddressAutocomplete to avoid "Loader called again
  // with different options" — the singleton returns the cached instance.
  const { isLoaded } = useJsApiLoader({
    id: "google-maps-address-autocomplete",
    googleMapsApiKey: apiKey || "",
    libraries: MAP_LIBRARIES,
  });

  const [radius, setRadius] = useState(25);
  const [nearbyStaff, setNearbyStaff] = useState([]);
  const [clientCoords, setClientCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [progressText, setProgressText] = useState("");
  const mapRef = useRef(null);

  const clientAddress = buildAddressString(
    client?.addresses?.[0] || client
  );

  const computeNearby = useCallback(async () => {
    if (!isLoaded || !window.google?.maps) return;
    if (!clientAddress) {
      setError("This client has no saved address. Add one to see nearby staff.");
      setNearbyStaff([]);
      setClientCoords(null);
      setProgressText("");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedStaff(null);
    setProgressText("Locating client address...");

    try {
      const geocoder = new window.google.maps.Geocoder();

      // Geocode the client
      const clientGeo = await geocodeAddress(geocoder, clientAddress, apiKey);
      if (!clientGeo.coords) {
        setError(geocodeStatusMessage(clientGeo.status, clientAddress));
        setNearbyStaff([]);
        setClientCoords(null);
        setProgressText("");
        return;
      }
      const cCoords = clientGeo.coords;
      setClientCoords(cCoords);

      // Filter to active, non-archived staff that have an address
      const candidateStaff = staffList.filter(
        (s) =>
          !s.archived &&
          s.status !== "Terminated" &&
          buildAddressString(s)
      );

      if (candidateStaff.length === 0) {
        setNearbyStaff([]);
        setProgressText("");
        return;
      }

      // Geocode in small batches to avoid over-query throttling stalls.
      const batchSize = 8;
      const geocoded = [];
      for (let i = 0; i < candidateStaff.length; i += batchSize) {
        const batch = candidateStaff.slice(i, i + batchSize);
        setProgressText(
          `Geocoding staff addresses ${Math.min(i + batch.length, candidateStaff.length)}/${candidateStaff.length}...`
        );
        const batchResults = await Promise.all(
          batch.map(async (s) => {
            const addr = buildAddressString(s);
            const geo = await geocodeAddress(geocoder, addr, apiKey);
            if (!geo.coords) return null;
            const coords = geo.coords;
            const distMiles = haversineMiles(cCoords.lat, cCoords.lng, coords.lat, coords.lng);
            return { ...s, _coords: coords, _distMiles: distMiles };
          })
        );
        geocoded.push(...batchResults.filter(Boolean));
      }

      const filtered = geocoded
        .filter((s) => s._distMiles <= radius)
        .sort((a, b) => a._distMiles - b._distMiles);

      setNearbyStaff(filtered);
      setProgressText("");
    } catch (err) {
      console.error("Nearby staff geocoding failed:", err);
      setError("Failed to compute nearby staff. Please refresh and try again.");
      setNearbyStaff([]);
      setClientCoords(null);
      setProgressText("");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, clientAddress, staffList, radius]);

  useEffect(() => {
    if (isLoaded) computeNearby();
  }, [computeNearby, isLoaded]);

  // Fit map bounds when data changes
  useEffect(() => {
    if (!mapRef.current || !clientCoords || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(clientCoords);
    nearbyStaff.forEach((s) => s._coords && bounds.extend(s._coords));
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 60);
  }, [clientCoords, nearbyStaff]);

  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "Client";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Navigation className="h-4 w-4 text-teal-600" />
          <span className="font-medium text-sm">Nearby Staff</span>
          {clientAddress && (
            <span className="text-xs text-slate-400 hidden sm:inline truncate max-w-[260px]">
              — based on: {clientAddress}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Radius:</span>
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadius(r)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors border ${
                radius === r
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-teal-400"
              }`}
            >
              {r} mi
            </button>
          ))}
          <button
            type="button"
            onClick={computeNearby}
            disabled={loading || !isLoaded}
            title="Refresh"
            className="ml-1 p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error notice */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400"
          style={{ height: 300 }}
        >
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          {progressText || "Geocoding addresses..."}
        </div>
      )}

      {/* Map */}
      {!loading && !error && isLoaded && clientCoords && (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <GoogleMap
            mapContainerStyle={MAP_STYLE}
            onLoad={(map) => { mapRef.current = map; }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              zoomControl: true,
            }}
          >
            {/* Client pin */}
            <Marker
              position={clientCoords}
              icon="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
              title={clientName}
              onClick={() => setSelectedStaff(null)}
            />

            {/* Staff pins */}
            {nearbyStaff.map((s) =>
              s._coords ? (
                <Marker
                  key={s.id}
                  position={s._coords}
                  icon="https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                  title={s.fullName || `${s.firstName} ${s.lastName}`}
                  onClick={() => setSelectedStaff(s)}
                />
              ) : null
            )}

            {/* InfoWindow */}
            {selectedStaff?._coords && (
              <InfoWindow
                position={selectedStaff._coords}
                onCloseClick={() => setSelectedStaff(null)}
              >
                <div className="text-sm space-y-0.5 min-w-[150px]">
                  <p className="font-semibold text-slate-800">
                    {selectedStaff.fullName || `${selectedStaff.firstName} ${selectedStaff.lastName}`}
                  </p>
                  <p className="text-slate-500">{selectedStaff.staffType || "Staff"}</p>
                  <p className="text-teal-700 font-medium">
                    {selectedStaff._distMiles.toFixed(1)} mi away
                  </p>
                  {selectedStaff.city && (
                    <p className="text-slate-400 text-xs">
                      {selectedStaff.city}{selectedStaff.state ? `, ${selectedStaff.state}` : ""}
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      )}

      {/* Legend */}
      {!loading && !error && clientCoords && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            {clientName}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            Staff ({nearbyStaff.length} within {radius} mi)
          </span>
        </div>
      )}

      {/* Staff list */}
      {!loading && !error && (
        <div className="space-y-2">
          {nearbyStaff.length === 0 && clientCoords && (
            <p className="text-sm text-slate-500 py-1">
              No staff with saved addresses found within {radius} miles.{" "}
              {staffList.filter((s) => !s.archived && s.status !== "Terminated" && buildAddressString(s)).length === 0 &&
                "Make sure staff have city/state/zipcode filled in."}
            </p>
          )}
          {nearbyStaff.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedStaff(s)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                selectedStaff?.id === s.id
                  ? "border-teal-300 bg-teal-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="bg-slate-100 rounded-full p-1.5 flex-shrink-0">
                <Users className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-800">
                    {s.fullName || `${s.firstName} ${s.lastName}`}
                  </span>
                  {s.staffType && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${staffTypeColor(s.staffType)}`}>
                      {s.staffType}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                  {(s.city || s.state) && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {[s.city, s.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {s.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />
                      {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-0.5 min-w-0">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{s.email}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-xs font-semibold text-teal-700">
                  {s._distMiles.toFixed(1)} mi
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
