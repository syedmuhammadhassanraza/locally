/**
 * Maps Service — Google Places API (New) + Haversine Distance + Reverse Geocoding
 * Uses API key from env: MAPS_API_KEY
 */

const MAPS_API_KEY = process.env.MAPS_API_KEY || 'AIzaSyDBIvMMs4uZwx20ai_LmSfQ6zLm7FjSfJg';

// ── Haversine Distance (real geodesic km calculation) ──────────────────────
const calculateDistance = (loc1, loc2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const lat1 = parseFloat(loc1.lat || loc1.latitude || 0);
  const lng1 = parseFloat(loc1.lng || loc1.longitude || 0);
  const lat2 = parseFloat(loc2.lat || loc2.latitude || 0);
  const lng2 = parseFloat(loc2.lng || loc2.longitude || 0);

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

// ── ETA Calculation (average urban travel speed) ───────────────────────────
const calculateETA = (distanceKm) => {
  // Average 20 km/h in Pakistani urban areas + 2 min buffer
  return Math.round((distanceKm / 20) * 60 + 2);
};

// ── Google Places API (New) — Text Search ──────────────────────────────────
const searchPlaces = async (textQuery, locationBias = null) => {
  try {
    const requestBody = {
      textQuery
    };

    if (locationBias) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: locationBias.lat,
            longitude: locationBias.lng
          },
          radius: 5000.0 // 5km radius
        }
      };
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('[Places API] Error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return (data.places || []).map(p => ({
      name: p.displayName?.text || 'Unknown',
      address: p.formattedAddress || '',
      lat: p.location?.latitude || 0,
      lng: p.location?.longitude || 0,
      rating: p.rating || 0,
      priceLevel: p.priceLevel || 'N/A'
    }));
  } catch (err) {
    console.error('[Places API] Fetch error:', err.message);
    return [];
  }
};

// ── Google Geocoding API — Reverse Geocode (lat,lng -> address) ────────────
const reverseGeocode = async (lat, lng) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Geocoding API] Error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return {
        formattedAddress: data.results[0].formatted_address,
        components: data.results[0].address_components
      };
    }
    return null;
  } catch (err) {
    console.error('[Geocoding API] Fetch error:', err.message);
    return null;
  }
};

// ── Google Geocoding API — Forward Geocode (address -> lat,lng) ────────────
const forwardGeocode = async (address) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Geocoding API Forward] Error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lng: loc.lng,
        formattedAddress: data.results[0].formatted_address
      };
    }
    return null;
  } catch (err) {
    console.error('[Geocoding API Forward] Fetch error:', err.message);
    return null;
  }
};

// ── Google Directions API — Get Route Between Two Points ──────────────────
const getDirections = async (originLat, originLng, destLat, destLng) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Directions API] Error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      return {
        distance: leg.distance.text,
        distanceValue: leg.distance.value, // meters
        duration: leg.duration.text,
        durationValue: leg.duration.value, // seconds
        polyline: route.overview_polyline.points,
        steps: leg.steps.map(s => ({
          instruction: s.html_instructions,
          distance: s.distance.text,
          duration: s.duration.text
        }))
      };
    }
    return null;
  } catch (err) {
    console.error('[Directions API] Fetch error:', err.message);
    return null;
  }
};

module.exports = {
  calculateDistance,
  calculateETA,
  searchPlaces,
  reverseGeocode,
  forwardGeocode,
  getDirections
};
