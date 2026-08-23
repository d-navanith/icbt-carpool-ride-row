import React, { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Route, Layers, Compass, Loader2 } from 'lucide-react';

// Exact GPS coordinates for Sri Lankan towns, hubs, and ICBT campuses
const ACCURATE_LOCATIONS = {
  // ICBT Campuses
  'icbt colombo campus':        [6.8906, 79.8558], // No 36, De Kretser Place, Bambalapitiya, Colombo 04
  'icbt campus':                [6.8906, 79.8558],
  'icbt':                       [6.8906, 79.8558],
  'icbt kandy campus':          [7.2934, 80.6350],
  'icbt gampaha':               [7.0917, 79.9999],
  'icbt galle':                 [6.0535, 80.2210],
  'icbt kurunegala':            [7.4863, 80.3623],
  'icbt matara':                [5.9549, 80.5550],
  'icbt jaffna':                [9.6615, 80.0255],

  // Colombo & Suburbs
  'colombo':                    [6.9271, 79.8612],
  'colombo fort':               [6.9344, 79.8428],
  'bambalapitiya':              [6.8892, 79.8566],
  'kollupitiya':                [6.9147, 79.8517],
  'wellawatte':                 [6.8741, 79.8606],
  'maradana':                   [6.9270, 79.8650],
  'borella':                    [6.9148, 79.8778],
  'town hall':                  [6.9150, 79.8636],
  'dematagoda':                 [6.9330, 79.8770],
  'orugodawatta':               [6.9450, 79.8780],
  'peliyagoda':                 [6.9680, 79.9002],
  'rajagiriya':                 [6.9080, 79.8960],
  'battaramulla':               [6.8980, 79.9200],
  'nugegoda':                   [6.8720, 79.8920],
  'maharagama':                 [6.8480, 79.9267],
  'kotte':                      [6.8870, 79.9130],
  'malabe':                     [6.9040, 79.9550],
  'kaduwela':                   [6.9380, 79.9820],
  'homagama':                   [6.8420, 80.0030],
  'pannipitiya':                [6.8470, 79.9570],
  'kottawa':                    [6.8410, 79.9650],
  'dehiwala':                   [6.8520, 79.8650],
  'mount lavinia':              [6.8378, 79.8654],
  'ratmalana':                  [6.8200, 79.8750],
  'moratuwa':                   [6.7730, 79.8816],
  'panadura':                   [6.7130, 79.9070],
  'kalutara':                   [6.5854, 79.9607],

  // Gampaha District & North corridor
  'gampaha':                    [7.0917, 79.9999],
  'gampaha town':               [7.0917, 79.9999],
  'miriswatta':                 [7.0800, 80.0150],
  'kiribathgoda':               [6.9798, 79.9284],
  'kelaniya':                   [6.9553, 79.9220],
  'kadawatha':                  [7.0016, 79.9540],
  'ragama':                     [7.0270, 79.9210],
  'mahara':                     [7.0120, 79.9400],
  'wattala':                    [6.9890, 79.8920],
  'kandana':                    [7.0410, 79.9120],
  'ja-ela':                     [7.0744, 79.8913],
  'ja ela':                     [7.0744, 79.8913],
  'seeduwa':                    [7.1230, 79.8820],
  'katunayake':                 [7.1700, 79.8850],
  'negombo':                    [7.2083, 79.8358],
  'negombo bus stand':          [7.2083, 79.8358],
  'minuwangoda':                [7.1660, 79.9530],
  'veyangoda':                  [7.1560, 80.0570],
  'nittambuwa':                 [7.1440, 80.1000],
  'yakkala':                    [7.0860, 80.0380],

  // Central & Outstation
  'kandy':                      [7.2906, 80.6337],
  'peradeniya':                 [7.2580, 80.5970],
  'kurunegala':                 [7.4863, 80.3623],
  'galle':                      [6.0535, 80.2210],
  'matara':                     [5.9549, 80.5550],
  'avissawella':                [6.9540, 80.2050],
  'kegalle':                    [7.2510, 80.3460]
};

const DEFAULT_CAMPUS = [6.8906, 79.8558]; // ICBT Colombo Campus (Bambalapitiya)

// Local memory geocode cache
const geocodeCache = new Map();

// Helper to look up or fetch exact real-world coordinates
async function resolveCoordinates(placeName) {
  if (!placeName || typeof placeName !== 'string') return null;
  const clean = placeName.trim().toLowerCase();

  // 1. Direct gazetteer match
  if (ACCURATE_LOCATIONS[clean]) {
    return ACCURATE_LOCATIONS[clean];
  }

  // 2. Partial substring search in our comprehensive dictionary
  for (const [key, coords] of Object.entries(ACCURATE_LOCATIONS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  // 3. Memory cache check
  if (geocodeCache.has(clean)) {
    return geocodeCache.get(clean);
  }

  // 4. Live OpenStreetMap Nominatim Geocoding API for real-time exact locations in Sri Lanka
  try {
    const q = encodeURIComponent(`${placeName}, Sri Lanka`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=lk&limit=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        geocodeCache.set(clean, coords);
        return coords;
      }
    }
  } catch (err) {
    console.warn('Geocoding fallback failed for:', placeName, err);
  }

  // Fallback to Colombo metro if completely unresolved
  return DEFAULT_CAMPUS;
}

export default function InteractiveMap({ selectedRide, rides = [] }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [routeDetails, setRouteDetails] = useState({ distanceKm: null, durationMins: null });
  const [resolving, setResolving] = useState(false);

  // Dynamic Leaflet CSS + JS loader
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Update map when rides, selectedRide, or leaflet state changes
  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const L = window.L;

    // Initialize map if not created yet
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(DEFAULT_CAMPUS, 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapInstance.current);

      layerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    const group = layerGroup.current;
    group.clearLayers();

    const renderMapContent = async () => {
      setResolving(true);

      // Custom marker generator
      const createMarkerIcon = (bg, text, label, isPulse = false) => L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex;align-items:center;gap:6px;transform:translate(-50%,-50%);">
            <div style="
              background:${bg};
              color:#fff;
              width:26px;
              height:26px;
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:11px;
              font-weight:800;
              box-shadow:0 3px 8px rgba(0,0,0,0.35);
              border:2.5px solid #ffffff;
              ${isPulse ? 'animation: pulse 1.8s infinite;' : ''}
            ">${text}</div>
            <div style="
              background:#0f172a;
              color:#f8fafc;
              padding:3px 8px;
              border-radius:8px;
              font-size:11px;
              font-weight:700;
              white-space:nowrap;
              box-shadow:0 2px 6px rgba(0,0,0,0.25);
              border:1px solid rgba(255,255,255,0.2);
            ">${label}</div>
          </div>
        `,
        iconAnchor: [0, 0]
      });

      if (selectedRide) {
        // Build the complete stops array
        const rawWaypoints = typeof selectedRide.route_waypoints === 'string'
          ? (function() { try { return JSON.parse(selectedRide.route_waypoints); } catch { return []; } })()
          : (Array.isArray(selectedRide.route_waypoints) ? selectedRide.route_waypoints : []);

        const stopNames = [
          selectedRide.origin,
          ...rawWaypoints,
          selectedRide.destination || 'ICBT Colombo Campus'
        ];

        // Resolve exact real-world coordinates for all stops
        const resolvedPoints = [];
        for (let i = 0; i < stopNames.length; i++) {
          const name = stopNames[i];
          const coords = await resolveCoordinates(name);
          resolvedPoints.push({ name, coords, index: i });
        }

        const validCoords = resolvedPoints.map(p => p.coords);

        // Place exact markers on each point
        resolvedPoints.forEach((point, i) => {
          const isOrigin = i === 0;
          const isDest = i === resolvedPoints.length - 1;
          const bg = isOrigin ? '#10b981' : isDest ? '#2563eb' : '#f59e0b';
          const iconText = isOrigin ? 'A' : isDest ? 'B' : `${i}`;
          const typeLabel = isOrigin ? '🚦 Origin' : isDest ? '🏫 Destination' : `📍 Stop ${i}`;

          const icon = createMarkerIcon(bg, iconText, point.name, isDest);

          L.marker(point.coords, { icon })
            .bindPopup(`
              <div style="padding:4px;font-family:system-ui,-apple-system,sans-serif;">
                <span style="font-size:10px;font-weight:700;color:${bg};text-transform:uppercase;">${typeLabel}</span>
                <h4 style="margin:2px 0 4px 0;font-size:13px;font-weight:800;color:#0f172a;">${point.name}</h4>
                <p style="margin:0;font-size:11px;color:#64748b;">GPS: ${point.coords[0].toFixed(4)}°N, ${point.coords[1].toFixed(4)}°E</p>
              </div>
            `)
            .addTo(group);
        });

        // Fetch real road route geometry from Open Source Routing Machine (OSRM)
        let routeGeoDrawn = false;
        if (validCoords.length >= 2) {
          try {
            const coordString = validCoords.map(c => `${c[1]},${c[0]}`).join(';');
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

            const osrmRes = await fetch(osrmUrl);
            if (osrmRes.ok) {
              const osrmData = await osrmRes.json();
              if (osrmData.routes && osrmData.routes.length > 0) {
                const route = osrmData.routes[0];
                const latLngs = route.geometry.coordinates.map(c => [c[1], c[0]]);

                // Glow path layer
                L.polyline(latLngs, {
                  color: '#93c5fd',
                  weight: 8,
                  opacity: 0.5,
                  lineCap: 'round'
                }).addTo(group);

                // Main precise road path
                const roadPolyline = L.polyline(latLngs, {
                  color: '#2563eb',
                  weight: 4.5,
                  opacity: 0.95,
                  lineCap: 'round'
                }).addTo(group);

                map.fitBounds(roadPolyline.getBounds(), { padding: [45, 45] });

                setRouteDetails({
                  distanceKm: (route.distance / 1000).toFixed(1),
                  durationMins: Math.round(route.duration / 60)
                });
                routeGeoDrawn = true;
              }
            }
          } catch (osrmErr) {
            console.warn('OSRM route fetch failed, using straight-line route fallback:', osrmErr);
          }
        }

        // Fallback straight-line connecting polyline if OSRM unavailable
        if (!routeGeoDrawn && validCoords.length > 1) {
          const fallbackLine = L.polyline(validCoords, {
            color: '#2563eb',
            weight: 4,
            opacity: 0.85,
            dashArray: '8,6'
          }).addTo(group);
          map.fitBounds(fallbackLine.getBounds(), { padding: [45, 45] });
        }

      } else {
        // Show campus radar overview with all available carpools
        setRouteDetails({ distanceKm: null, durationMins: null });

        // Add campus hub pin
        const campusIcon = createMarkerIcon('#0f172a', '🎓', 'ICBT Colombo Campus', true);
        L.marker(DEFAULT_CAMPUS, { icon: campusIcon })
          .bindPopup(`
            <div style="padding:4px;">
              <span style="font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;">Central Hub</span>
              <h4 style="margin:2px 0;font-size:13px;font-weight:800;color:#0f172a;">ICBT Colombo Campus</h4>
              <p style="margin:0;font-size:11px;color:#64748b;">No 36, De Kretser Place, Bambalapitiya, Colombo 04</p>
            </div>
          `)
          .addTo(group);

        const allCoords = [DEFAULT_CAMPUS];

        for (const ride of rides) {
          const origCoords = await resolveCoordinates(ride.origin);
          if (origCoords) {
            allCoords.push(origCoords);
            const ridePin = createMarkerIcon('#2563eb', '🚗', `${ride.origin} (${ride.available_seats} seats)`);
            L.marker(origCoords, { icon: ridePin })
              .bindPopup(`
                <div style="padding:4px;">
                  <span style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;">Available Carpool</span>
                  <h4 style="margin:2px 0;font-size:13px;font-weight:800;color:#0f172a;">${ride.origin} → ${ride.destination || 'ICBT Campus'}</h4>
                  <p style="margin:0;font-size:11px;color:#64748b;">Driver: <strong>${ride.driver_name}</strong> | Departs: <strong>${ride.departure_time}</strong></p>
                  <p style="margin:2px 0 0 0;font-size:11px;color:#2563eb;font-weight:700;">Fare: ${ride.price_per_seat > 0 ? `LKR ${ride.price_per_seat}` : 'Free'}</p>
                </div>
              `)
              .addTo(group);
          }
        }

        if (allCoords.length > 1) {
          map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] });
        }
      }

      setResolving(false);
    };

    renderMapContent();
  }, [leafletReady, selectedRide, rides]);

  // Handle resizing smoothly
  useEffect(() => {
    if (!mapInstance.current) return;
    const timer = setTimeout(() => mapInstance.current?.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [selectedRide]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100" style={{ height: '360px' }}>
      {/* Map container */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay when calculating real routes */}
      {resolving && (
        <div className="absolute top-3 right-3 z-[400] bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>Locating GPS...</span>
        </div>
      )}

      {/* Floating GPS Route & Distance HUD */}
      <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 text-xs text-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 min-w-0">
            <Compass className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">
              {selectedRide
                ? `${selectedRide.origin} ➔ ${selectedRide.destination || 'ICBT Colombo Campus'}`
                : `${rides.length} Active Carpool Route${rides.length !== 1 ? 's' : ''} on Campus Radar`}
            </span>
          </div>

          {/* Real distance & travel time if route is calculated */}
          {routeDetails.distanceKm && (
            <div className="flex items-center gap-2 shrink-0 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
              <span className="font-extrabold text-blue-900">{routeDetails.distanceKm} km</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-blue-700">~{routeDetails.durationMins} mins</span>
            </div>
          )}
        </div>

        <p className="text-slate-500 text-[11px] mt-1 truncate">
          {selectedRide
            ? (selectedRide.route_waypoints && selectedRide.route_waypoints.length > 0
                ? `Stops: ${Array.isArray(selectedRide.route_waypoints) ? selectedRide.route_waypoints.join(' ➔ ') : selectedRide.route_waypoints}`
                : 'Direct transit route to campus')
            : 'Select any carpool to view real-world driving directions and GPS stops.'}
        </p>
      </div>
    </div>
  );
}
