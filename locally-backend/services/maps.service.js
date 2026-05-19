const calculateDistance = (loc1, loc2) => {
  // Realistic mock distance in km (0.5 to 5 km)
  return parseFloat((Math.random() * 4.5 + 0.5).toFixed(2));
};

const calculateETA = (distanceKm) => {
  // Average speed travel time estimation (e.g. ~3 minutes per km + 2 min buffer)
  return Math.round(distanceKm * 3 + 2);
};

module.exports = { calculateDistance, calculateETA };
