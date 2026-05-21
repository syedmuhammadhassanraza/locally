const express = require('express');
const router = express.Router();
const { reverseGeocode, forwardGeocode, searchPlaces, getDirections } = require('../services/maps.service');
const { protect } = require('../middleware/auth.middleware');

// Reverse geocode: lat,lng -> address
router.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng are required' });

    const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: 'No address found for coordinates' });
    }
  } catch (err) {
    console.error('Reverse geocode error:', err);
    res.status(500).json({ message: 'Geocoding service error' });
  }
});

// Forward geocode: address -> lat,lng
router.get('/forward-geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ message: 'address is required' });

    const result = await forwardGeocode(address);
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: 'No coordinates found for address' });
    }
  } catch (err) {
    console.error('Forward geocode error:', err);
    res.status(500).json({ message: 'Geocoding service error' });
  }
});

// Google Places text search
router.post('/search', async (req, res) => {
  try {
    const { query, lat, lng } = req.body;
    if (!query) return res.status(400).json({ message: 'query is required' });

    const locationBias = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const results = await searchPlaces(query, locationBias);
    res.json({ places: results });
  } catch (err) {
    console.error('Places search error:', err);
    res.status(500).json({ message: 'Places search service error' });
  }
});

// Get directions between two points
router.get('/directions', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ message: 'originLat, originLng, destLat, destLng are all required' });
    }

    const result = await getDirections(
      parseFloat(originLat), parseFloat(originLng),
      parseFloat(destLat), parseFloat(destLng)
    );

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: 'No route found' });
    }
  } catch (err) {
    console.error('Directions error:', err);
    res.status(500).json({ message: 'Directions service error' });
  }
});

module.exports = router;
